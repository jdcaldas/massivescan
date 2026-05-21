import { GoogleGenAI } from '@google/genai';

if (!process.env.API_KEY) {
  throw new Error('API_KEY environment variable is not set.');
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ── Concurrency limiter ──────────────────────────────────────────────────────

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;
  constructor(private readonly max: number) {}
  acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.running < this.max) { this.running++; resolve(); }
      else this.queue.push(resolve);
    });
  }
  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) { this.running++; next(); }
  }
}

const sem = new Semaphore(5);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === attempts - 1) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
  throw new Error('unreachable');
}

// ── Styles & models ──────────────────────────────────────────────────────────

export interface ImageStyle {
  id: string;
  label: string;
  suffix: string;
}

export const IMAGE_STYLES: ImageStyle[] = [
  { id: 'low-poly',       label: 'Low Poly',      suffix: 'low poly art, geometric shapes, flat shading, vibrant palette' },
  { id: 'photorealistic', label: 'Photorealistic', suffix: 'photorealistic, cinematic lighting, ultra-detailed, 8K render' },
  { id: 'watercolor',     label: 'Watercolor',     suffix: 'watercolor painting, soft brush strokes, flowing pigments, paper texture' },
  { id: 'synthwave',      label: 'Synthwave',      suffix: 'synthwave aesthetic, neon glow, retro-futuristic, chromatic aberration' },
  { id: 'steampunk',      label: 'Steampunk',      suffix: 'steampunk style, brass and copper, Victorian era, steam and gears' },
];

// Image generation models — three tiers across two families.
//
// Tier guide:
//   • Draft    → fast iteration, low cost (Gemini 3.1 Flash image)
//   • Standard → premium Gemini image (Gemini 3 Pro image)
//   • Hero     → covers, legendary 3★ cards, key art (Imagen 4 — native
//                aspectRatio, 100% reliable portrait/wide framing)
//
// Note: Imagen 3 / Imagen 3 Fast (`imagen-3.0-*`) return 404 on the current
// v1beta API for this project, so they are intentionally excluded. Only
// Imagen 4 is enabled from the Imagen family.
export const IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Draft · Nano Banana 2 · 3.1 Flash' },
  { id: 'gemini-3-pro-image-preview',     label: 'Standard · Nano Banana Pro · 3 Pro' },
  { id: 'imagen-4.0-generate-001',        label: 'Hero · Imagen 4' },
];

// ── Core generate function ───────────────────────────────────────────────────

export const ART_FORMATS = [
  { id: '1:1',  label: 'Square',   tailwind: 'aspect-square'     },
  { id: '3:4',  label: 'Portrait', tailwind: 'aspect-[3/4]'      },
  { id: '16:9', label: 'Wide',     tailwind: 'aspect-video'       },
] as const;

export type ArtFormatId = typeof ART_FORMATS[number]['id'];

/** Strong aspect-ratio instructions injected into the prompt for Gemini models,
 *  which don't support an explicit aspectRatio API field.
 *  Phrased as hard constraints (and repeated as a prefix) because the model
 *  treats hints as suggestions otherwise. */
const ASPECT_RATIO_HINT: Record<ArtFormatId, string> = {
  '1:1':  'CRITICAL OUTPUT REQUIREMENT: The final image MUST be a perfect SQUARE (1:1 aspect ratio, equal width and height). Do not output portrait or landscape — only square.',
  '3:4':  'CRITICAL OUTPUT REQUIREMENT: The final image MUST be VERTICAL / PORTRAIT (3:4 aspect ratio, clearly taller than wide). The composition must fit a tall vertical frame. Do NOT output a square or landscape image — only portrait/vertical.',
  '16:9': 'CRITICAL OUTPUT REQUIREMENT: The final image MUST be WIDE / LANDSCAPE (16:9 aspect ratio, significantly wider than tall). The composition must fit a wide horizontal frame. Do NOT output a square or portrait image — only wide/landscape.',
};

/** Short prefix tag that prepends every prompt — Gemini respects framing
 *  declarations placed at the very start more reliably than mid-prompt. */
const ASPECT_RATIO_PREFIX: Record<ArtFormatId, string> = {
  '1:1':  '[FORMAT: SQUARE 1:1] ',
  '3:4':  '[FORMAT: VERTICAL PORTRAIT 3:4 — image MUST be taller than wide] ',
  '16:9': '[FORMAT: WIDE LANDSCAPE 16:9 — image MUST be wider than tall] ',
};

export async function generateImage(
  prompt: string,
  styleId: string,
  modelId: string,
  aspectRatio: ArtFormatId = '3:4',
  signal?: AbortSignal,
): Promise<string> {
  const suffix = IMAGE_STYLES.find(s => s.id === styleId)?.suffix ?? '';
  const base = suffix ? `${prompt}. Art style: ${suffix}.` : prompt;
  const noText = 'No text, letters, words, labels, captions, or typography of any kind in the image.';

  await sem.acquire();
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return await withRetry(async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      if (modelId.startsWith('imagen-')) {
        // Imagen supports aspectRatio natively via config — no prompt hack needed.
        const full = `${base} ${noText}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (ai.models as any).generateImages({
          model: modelId,
          prompt: full,
          config: { numberOfImages: 1, aspectRatio, outputMimeType: 'image/jpeg' },
        });
        const bytes = res?.generatedImages?.[0]?.image?.imageBytes;
        if (!bytes) throw new Error('No image bytes returned');
        if (typeof bytes === 'string') return bytes;
        // ArrayBuffer → base64
        const arr = new Uint8Array(bytes as ArrayBuffer);
        let bin = '';
        for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
        return btoa(bin);
      } else {
        // Gemini native image gen: aspect ratio is injected as TEXT into the
        // prompt — both as an opening prefix tag and as a strong closing
        // constraint — since `aspectRatio` config isn't reliably honored by
        // the multimodal Gemini image path.
        const full = `${ASPECT_RATIO_PREFIX[aspectRatio]}${base} ${ASPECT_RATIO_HINT[aspectRatio]} ${noText}`;
        const res = await ai.models.generateContent({
          model: modelId,
          contents: [{ role: 'user', parts: [{ text: full }] }],
          // Newer Gemini image-gen models accept imageConfig.aspectRatio;
          // older ones ignore it. Pass it anyway — harmless when unsupported,
          // helpful when supported.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: {
            responseModalities: ['IMAGE'] as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            imageConfig: { aspectRatio } as any,
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const part = (res.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (part as any)?.inlineData?.data;
        if (!data) throw new Error('No image data in response');
        return data as string;
      }
    });
  } finally {
    sem.release();
  }
}
