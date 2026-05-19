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

// Model families for image generation.
// "Nano Banana" = Gemini native multimodal image gen (generateContent + IMAGE modality).
// "Imagen" = dedicated standalone image engine (generateImages API).
// "Nano Banana" = Gemini native multimodal image gen (generateContent + IMAGE modality).
// "Imagen" = dedicated standalone image engine (generateImages API).
export const IMAGE_MODELS = [
  // ── Nano Banana family ───────────────────────────────────────────────────
  { id: 'gemini-2.5-flash-image',        label: 'Nano Banana · 2.5 Flash' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 · 3.1 Flash' },
  { id: 'gemini-3-pro-image-preview',    label: 'Nano Banana Pro · 3 Pro' },
  // ── Imagen family ────────────────────────────────────────────────────────
  { id: 'imagen-4.0-generate-001',       label: 'Imagen 4' },
  { id: 'imagen-3.0-generate-002',       label: 'Imagen 3' },
  { id: 'imagen-3.0-fast-generate-001',  label: 'Imagen 3 Fast' },
];

// ── Core generate function ───────────────────────────────────────────────────

export const ART_FORMATS = [
  { id: '1:1',  label: 'Square',   tailwind: 'aspect-square'     },
  { id: '3:4',  label: 'Portrait', tailwind: 'aspect-[3/4]'      },
  { id: '16:9', label: 'Wide',     tailwind: 'aspect-video'       },
] as const;

export type ArtFormatId = typeof ART_FORMATS[number]['id'];

/** Human-readable aspect ratio hints injected into the prompt for Gemini models,
 *  which don't support an explicit aspectRatio API field. */
const ASPECT_RATIO_HINT: Record<ArtFormatId, string> = {
  '1:1':  'Compose the image as a perfect square (1:1 aspect ratio).',
  '3:4':  'Compose the image in portrait orientation (3:4 aspect ratio, taller than wide).',
  '16:9': 'Compose the image in landscape/widescreen orientation (16:9 aspect ratio, wider than tall).',
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
        // Gemini native image gen: inject aspect ratio hint into the prompt text
        // since imageGenerationConfig.aspectRatio is not reliably supported.
        const full = `${base} ${ASPECT_RATIO_HINT[aspectRatio]} ${noText}`;
        const res = await ai.models.generateContent({
          model: modelId,
          contents: [{ role: 'user', parts: [{ text: full }] }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: { responseModalities: ['IMAGE'] as any },
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
