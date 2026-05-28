// ─────────────────────────────────────────────────────────────────────────────
// Prompt Polish — Phase 1.5 of CONSISTENCY_ROADMAP.md
//
// AI text validator that runs Gemini Flash over user-pasted text in the
// Image Studio "free-form" fields (Custom art style, Negative prompt, etc.)
// to prevent the most common prompt-engineering mistake: subject-matter
// leaking into a style suffix that gets appended to every card.
//
// Example — user pastes:
//   "Voxel Art, in the style of Refik Anadol, dark fantasy, soldiers,
//    war scenes, dramatic mountains"
//
// Polish returns:
//   {
//     refined: "Voxel art aesthetic in the style of Refik Anadol,
//               dark fantasy mood, dramatic atmospheric lighting",
//     warnings: [
//       "'soldiers' removed — subject matter, not style",
//       "'war scenes' removed — subject matter",
//       "'dramatic mountains' removed — scene element"
//     ]
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';

if (!process.env.API_KEY) {
  throw new Error('API_KEY environment variable is not set.');
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Gemini 2.5 Flash — cheap, fast, ample for short text refinement.
// (Gemini 3.x Flash text models may not be available in all regions yet.)
const POLISH_MODEL = 'gemini-2.5-flash';

export type PolishKind = 'style' | 'negative';
/** 'polish' subtracts noise and tightens. 'augment' adds complementary descriptors. */
export type PolishMode = 'polish' | 'augment';

export interface PolishResult {
  refined: string;
  /** For 'polish' mode: what was removed/changed. For 'augment' mode: what was added. */
  warnings: string[];
}

// ── System prompts per field kind ────────────────────────────────────────────

const SYSTEM_PROMPT_STYLE = `You are a prompt engineer for AI image generation.
The user has pasted text intended as an "Art Style" suffix that will be appended
to EVERY image prompt in their card collection. Your job is to refine it to be
a safe, reusable style suffix that does not contaminate per-card content.

KEEP these aspects:
- Medium (painting, photography, illustration, voxel, 3D render, etc.)
- Technique (cel-shading, watercolor wash, low-poly, cross-hatching, etc.)
- Palette / color treatment (monochrome, vibrant, pastel, etc.)
- Lighting (chiaroscuro, golden hour, neon, soft, etc.)
- Mood / atmosphere (eerie, joyful, melancholic, etc.)
- Era references (1970s, vintage, retro-futuristic, etc.)
- Named art-movement / artist style references ("in the style of X")
- Texture / render quality (grainy, 8K, photocopy, etc.)

REMOVE these aspects (they contaminate cards):
- Specific subjects (people, animals, objects)
- Scene elements (mountains, oceans, buildings, weather)
- Events (battles, parties, ceremonies)
- Named individuals or places (unless part of an art-style reference)

If the user wrote contradictions (e.g. "vintage" + "futuristic"), keep the
dominant one and mention the other in warnings.
If the user wrote excessive adjectives (>15 words), tighten while preserving intent.

Return JSON only, no other text:
{
  "refined": "the cleaned text, ready to append as 'Art style: …' suffix",
  "warnings": ["concise list of what was removed/changed and why; one short sentence per item"]
}`;

const SYSTEM_PROMPT_AUGMENT_STYLE = `You are a prompt engineer for AI image generation.
The user has pasted a starting "Art Style" suffix that is correct but possibly too sparse.
Your job is to AUGMENT it — add 3 to 7 complementary descriptors that REINFORCE the same
visual direction without drifting to a different style.

ADD aspects that strengthen what's there:
- Medium specificity (e.g. "oil painting" → add "thick impasto, palette knife strokes")
- Technique details (e.g. "watercolor" → add "wet-on-wet, soft edges, paper texture")
- Lighting nuance (e.g. "dramatic" → add "rim light, deep shadow contrast")
- Texture / film stock / render quality
- Era-specific touches (e.g. "1970s" → add "kodachrome saturation, grainy stock")

DO NOT:
- Drift to a different style (don't add cyberpunk if the user wrote vintage)
- Add subject matter (people, objects, scenes, events) — same rule as Polish
- Contradict the user's intent (no color words if they implied B&W)
- Inflate beyond ~7 descriptors

KEEP the user's original phrases intact. Append the new descriptors after them.

Return JSON only, no other text:
{
  "refined": "the user's original text + your additions",
  "warnings": ["concise list of what you added and why; one short sentence per item"]
}`;

const SYSTEM_PROMPT_NEGATIVE = `You are a prompt engineer for AI image generation.
The user has pasted text as a NEGATIVE prompt — things to AVOID in EVERY generated
image in their card collection. Your job is to refine it into well-formed
avoid-clauses applied as a global guardrail.

KEEP these aspects:
- Clear, universal "avoid X" statements (no logos, no text, no humans, no blood)
- Style-quality negatives (no extra fingers, no blurry edges, no watermarks)
- Era / theme negatives (no modern elements, no anachronisms)

NORMALIZE these:
- Single words → proper avoid-clauses ("Robots" → "no robots")
- Vague phrases → explicit ("bad stuff" → keep & add specificity if obvious)

REMOVE these:
- Items that don't make sense as global negatives (specific subjects that may be
  wanted in some cards, e.g. "no horses" when horses might be central to one card)
- Conflicting negatives (avoid the same thing twice)

Return JSON only, no other text:
{
  "refined": "the cleaned text, ready to append as 'Avoid: …' suffix",
  "warnings": ["concise list of what was removed/changed and why"]
}`;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Refines a user-pasted free-form text into a cleaner version suitable for
 * being appended to every image prompt in the collection.
 *
 * Returns the original text unchanged if it's empty.
 * On API / parse failure, falls back to the raw text with a warning.
 */
export async function polishText(
  rawText: string,
  kind: PolishKind,
  mode: PolishMode = 'polish',
): Promise<PolishResult> {
  const text = rawText.trim();
  if (!text) return { refined: '', warnings: [] };

  // Augment is only meaningful for 'style' — negatives don't benefit from inflation.
  if (mode === 'augment' && kind === 'negative') {
    return { refined: text, warnings: ['Augment is only available for style fields.'] };
  }

  let systemPrompt: string;
  if (mode === 'augment') systemPrompt = SYSTEM_PROMPT_AUGMENT_STYLE;
  else if (kind === 'style') systemPrompt = SYSTEM_PROMPT_STYLE;
  else systemPrompt = SYSTEM_PROMPT_NEGATIVE;

  const fullPrompt = `${systemPrompt}\n\nUser input:\n${text}`;

  try {
    const res = await ai.models.generateContent({
      model: POLISH_MODEL,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      // Ask Gemini to return strict JSON
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { responseMimeType: 'application/json' } as any,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseText: string = (res.candidates?.[0]?.content?.parts ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => p?.text ?? '')
      .join('')
      .trim();

    if (!responseText) {
      return { refined: text, warnings: ['AI returned no output — kept original.'] };
    }

    // Try to parse the JSON
    let parsed: { refined?: string; warnings?: string[] };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Sometimes the model wraps JSON in ```json ... ``` — strip and retry
      const stripped = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        parsed = JSON.parse(stripped);
      } catch {
        return { refined: text, warnings: ['Could not parse AI response — kept original.'] };
      }
    }

    return {
      refined: (parsed.refined ?? text).trim(),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(w => typeof w === 'string' && w.trim()) : [],
    };
  } catch (e) {
    const msg = (e as Error)?.message ?? 'Unknown error';
    return { refined: text, warnings: [`Polish failed: ${msg}`] };
  }
}
