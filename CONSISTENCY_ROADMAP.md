# Image Generation Consistency — Roadmap

> **Status**: Design captured during conversation. Not yet implemented.
> **Date**: 2026-05-21 (updated after scenario stress-testing)
> **Scope**: How to make AI-generated images within a single collection (world)
> feel like they belong together — not the UI/UX of the app, but the **artistic
> coherence of the cards themselves**.

---

## Why this matters

Each Massive Scan project (world) generates dozens of card images via AI. The
question is: do they look like **one collection** or do they look like a random
assortment? Today the answer is "partially" — there is style suffix and the
subgroup→cover reference. That's about 40% of what's possible.

The goal is to give the user **opt-in levers** to tighten coherence when they
want it, without forcing it when it doesn't apply.

---

## Methodology

The roadmap below was stress-tested against 6 distinct collection archetypes to
validate that the mechanisms cover real-world cases:

1. **Haunted Houses** — single visual style, no protagonist
2. **Queen Elizabeth** — biographical, recurring main character
3. **French Beaches** — locations, no protagonist
4. **History of Punk** — strong aesthetic varying *per era / per tier*
5. **Corporate Brand** — strict palette guidelines + legal guardrails
6. **Solar System / Anatomy** — educational, diagrammatic, no narrative

Each scenario pushed the model to surface gaps. The final 6 mechanisms cover
all 6 scenarios at ~100% (see coverage table at end).

---

## What the app already does (no change needed)

1. **Style suffix on every prompt** — Low Poly / Photorealistic / Steampunk /
   **Custom** is appended to all images. Anchors the whole collection.
2. **Custom art style** (already implemented) — free-form text the user pastes,
   persisted on the world's `DesignStructure.customImageStyle`. The strongest
   single coherence lever today.
3. **Subgroup→cover reference** — `generateSubgroupImage()` injects the chosen
   hero cover's prompt text into every subgroup prompt as `(reference: …)`.
   Keeps cards within a tier aligned with the cover.
4. **Mood + description per group** — propagated to every image in the group.

---

## The 6 mechanisms (+ #7 meta-layer)

### #1 — Theme description injection (always-on, no toggle)

The world's `themeDescription` ("Late 16th century England was shaped by…") is
currently **NOT** in the image prompt. Will be injected as a `CONTEXT:` block
at the top of every image prompt. Safe default — narrative context, no visual
constraint.

**Why always-on:** Validated across all 6 scenarios. Adds context without
constraining visuals. No downside.

**Implementation hook:** in `ImageStudio.tsx`, where `generateGroupImage` and
`generateSubgroupImage` assemble the prompt — prefix with
`CONTEXT: ${structure.themeDescription}.` if non-empty.

**Effort:** ~30 min.

---

### #2 — Custom art style (already implemented)

Free-form text the user pastes in the "Custom" tab. Persisted on
`DesignStructure.customImageStyle`. Continues to be the strongest single
coherence lever.

**Example scenario:** *Haunted Houses* — user pastes
`"Fog-shrouded haunted house photography, monochrome black and white, heavy
mist, deep shadows, eerie atmosphere, dramatic chiaroscuro lighting"` — every
card across all 7 groups inherits this aesthetic. 100% coverage with this
mechanism alone.

**Status:** Already in production. Nothing to do.

---

### #3 — Tier palettes (opt-in, editable per tier — promoted from v2)

Originally proposed with fixed defaults. **Promoted to editable per tier in v1**
because the *Corporate Brand* scenario showed that fixed gold/forest/navy/crimson
is useless when the brand needs `#4D148C` (FedEx purple) or specific brand
colors.

When OFF (default): tier colors stay as semantic labels for game mechanics,
nothing added to prompts. Right for projects like *French Beaches* where the
Yellow tier ("Côte d'Azur") should be Mediterranean blue, not gold.

When ON: shows 4 editable text fields pre-filled with sensible defaults:

| Tier | Default text (editable) |
|---|---|
| Yellow  | `dominant palette: gold, amber, honey, warm cream` |
| Green   | `dominant palette: forest, emerald, olive, moss` |
| Blue    | `dominant palette: navy, cerulean, slate, ice` |
| Magenta | `dominant palette: crimson, plum, burgundy, rose` |

**Example scenario:** *Corporate Brand* — user edits Yellow to
`"primary palette: FedEx purple #4D148C only"` and Green to
`"primary palette: FedEx orange #FF6600 only"`. Brand discipline locked.

**Persistence:**
```ts
DesignStructure.tierPalettes?: {
  enabled: boolean;
  yellow?: string; green?: string; blue?: string; magenta?: string;
};
```

**Effort:** ~2h.

---

### #4 — Recurring main character (opt-in, with per-subgroup override)

The killer feature for biography/protagonist-driven decks. Useless or harmful
for collections with mixed casts.

When OFF (default): no change. Every card generates independently.

When ON the user provides:
- **Character description** (text): `"Ruiva, casaco bordado dourado, expressão
  regal, 30 anos, traje renascentista"`
- **Reference image** chosen from one of:
  - **Auto** — uses the Yellow tier's legendary 3★ subgroup hero pick
  - **Manual** — user clicks any existing generated image as the anchor
  - **Upload** — user uploads an external reference (photo, sketch)

The reference image is passed as **vision input** alongside the prompt in the
Gemini multimodal call (Gemini 2.5+ supports this). The Imagen path ignores
vision input — for those models we fall back to text-only character description.

**Per-subgroup override:** when the global toggle is ON, each subgroup card has
a small checkbox `[ ] include main character` (default = checked). The user
unchecks it for cards that shouldn't feature the character (e.g. "The Armada"
— only ships, no Queen).

**Example scenario:** *Queen Elizabeth* — user defines Elizabeth I once
(description + reference). Every Yellow tier card features her consistently;
"The Spanish Armada" card unchecks the box → only ships.

**Persistence:**
```ts
DesignStructure.recurringCharacter?: {
  description: string;
  referenceImageBase64?: string;
  referenceSlot?: { gi: number; si: number; pi: number };
};
// Per-subgroup opt-out:
Subgroup.excludeMainCharacter?: boolean;
```

**Effort:** ~3-4h.

---

### #5 — Per-tier style overrides (opt-in)

Surfaced by the *History of Punk* scenario. The Custom global style is the
**same for every card**. It cannot give "70s UK ripped paper" to the Yellow tier
and "00s emo eyeliner black" to the Magenta tier simultaneously.

When ON, replaces the Custom global style **for that specific tier** with the
user-defined override text.

```
☐ Per-tier style overrides
  ├── Yellow:   [70s UK punk aesthetic, ripped polaroid, safety pins…]
  ├── Green:    [80s hardcore stark photocopy, B&W, sharpie scrawl…]
  ├── Blue:     [90s pop-punk skate park photography, vibrant colors…]
  └── Magenta:  [00s emo MySpace aesthetic, deep purple, eyeliner black…]
```

Power-Ups / Utility / Activator continue to use the Custom global style.

**Example scenario:** *History of Punk* — each tier = a decade. Without this,
Yellow and Magenta cards look like the same generic "punk" stuff. With it, the
viewer reads the decade from the visuals instantly.

**Persistence:**
```ts
DesignStructure.perTierStyleOverrides?: {
  enabled: boolean;
  yellow?: string; green?: string; blue?: string; magenta?: string;
};
```

**Effort:** ~2h.

---

### #6 — Negative prompt / guardrails (opt-in)

Surfaced by the *Corporate Brand* and *Anatomy* scenarios. Brands have legal
constraints; educational content needs to avoid blood/text/labels. Today the
app **hard-codes** only one negative prompt: `"No text, letters, words..."`.

A user-controlled negative-prompt field, applied to every image.

**Universal triggers:**
- ❌ Brand: "No visible logos or trademarks, no celebrities"
- ❌ Brand: "No competitor brand colors"
- ❌ Anatomy: "No blood, no gore, no anatomical labels or callouts"
- ❌ Anatomy: "No real patient identifying features"
- ❌ Generic: "No clichés like crystal balls or wizard hats"
- ❌ Generic: "No AI-typical artefacts: extra fingers, distorted faces"

**Implementation:** for Imagen, pass as `negativePrompt` in the API config (native
support). For Gemini multimodal, append `Avoid: …` block at the end of the prompt.

**Example scenario:** *Solar System / Anatomy* — user pastes
`"No text, no labels, no callouts, no arrows, no blood, no patient identifying
features"` — guarantees clean diagrammatic output.

**Persistence:**
```ts
DesignStructure.negativePrompt?: string;
```

**Effort:** ~1h.

---

### #7 — Style Polish (meta-layer over user-typed text)

Not a coherence mechanism *per se* — a **quality layer** that runs over the text
fields where the user writes free-form prompts (#2, #4, #5, #6). It prevents
the most common prompt-engineering mistake: **subject matter leaking into the
style suffix**.

#### The problem it solves

When the user pastes into Custom style:

> `"Voxel Art, in the style of Refik Anadol, dark fantasy, soldiers, war scenes,
>   dramatic mountains"`

…the Custom suffix is appended to **every card**. So "soldiers" and "war scenes"
contaminate the Romance subgroup, the Power-Up cards, the everyday scenes.
The user didn't intend that — they confused *art style* with *content*.

#### How it works

A separate AI call (Gemini 2.5 Flash or 3.1 Flash — cheap text-only) runs over
the user's pasted text with a system prompt like:

> *"You are a prompt engineer for AI image generation. Refine the user's input
>   to be a clean 'Art style' suffix that can safely be appended to every card.
>   Remove subject matter (people, objects, scenes, events). Keep only: medium,
>   technique, palette, lighting, mood, era, art-movement references. Return
>   JSON with: refined (the cleaned text) and warnings (list of removed phrases
>   with reasons)."*

The output is:

```
✓ Refined version:
"Voxel art aesthetic in the style of Refik Anadol, dark fantasy mood,
 dramatic atmospheric lighting"

⚠ Removed (would contaminate every card):
 • "soldiers" — subject matter, not style
 • "war scenes" — subject matter
 • "dramatic mountains" — scene element

💡 Move these into specific subgroup prompts instead.
```

The user chooses:
- **Keep refined** — saved as the version used at generation time
- **Keep my original** — accepts the risk, raw text used
- **Edit** — manually tune before accepting

#### Trigger mode

- **Manual** (Recommended) — explicit `✨ Polish` button next to the field
- *Auto on blur* — runs automatically; rejected as default because it can
  silently "destroy" valid input

#### Fields that benefit

| Field | Polish applicable? | Reason |
|---|---|---|
| #2 Custom style | ✅ Primary use case | High contamination risk |
| #4 Character description | ✅ | Validate it's appearance, not scenery |
| #5 Per-tier style overrides | ✅ | Same criteria as #2, per tier |
| #6 Negative prompt | ✅ | Validate it actually excludes what user means |

#### Persistence

```ts
DesignStructure.customImageStyle: string;            // raw, what user typed
DesignStructure.customImageStyleRefined?: string;    // AI-polished
DesignStructure.customImageStyleWarnings?: string[]; // shown to user
DesignStructure.useRefinedCustom?: boolean;          // which version to use

// Mirror fields for #4, #5, #6 when polish is applied to them.
```

At generation time, the prompt uses
`useRefinedCustom ? customImageStyleRefined : customImageStyle`. User stays
in control.

#### Implementation notes

- New service: `design/services/promptPolishService.ts`
- Reuses the existing `@google/genai` client and Gemini text model
- Cost: pennies per polish (Flash tier, single short request)
- No image model involved

**Example scenario:** *History of Punk* — user pastes per-tier style overrides
with specific bands' names ("Sex Pistols in concert, Joey Ramone with leather
jacket"). Polish would warn: `"Sex Pistols", "Joey Ramone" are subject matter
— they will appear in every card of this tier. Move to specific subgroup prompts.`
The user thanks the AI and keeps only `"70s UK punk aesthetic, ripped polaroid,
safety pins, photocopy texture"` as the tier style.

**Effort:** ~2-3h. Equivalent complexity to #6.

---

## Scenario coverage table

| Scenario | #1 Theme | #2 Custom | #3 Palettes | #4 Character | #5 Per-tier | #6 Negative | Coverage |
|---|---|---|---|---|---|---|---|
| Haunted Houses | ✅ | ✅ | — | — | — | optional | **100%** |
| Queen Elizabeth | ✅ | ✅ | optional | ✅ | — | optional | **100%** |
| French Beaches | ✅ | ✅ | — | — | — | optional | **100%** |
| History of Punk | ✅ | ✅ | — | — | ✅ | optional | **100%** |
| Corporate Brand | ✅ | ✅ | ✅ | optional | optional | ✅ | **100%** |
| Solar System / Anatomy | ✅ | ✅ | optional | — | — | ✅ | **100%** |

The 6 mechanisms cover every scenario tested. The Custom style alone gets to
~70% — the other 5 close the remaining gap depending on the collection's needs.

---

## Where the controls live in the UI

Single **"Consistency" panel** in the Image Studio, near the existing Custom
style input. Theme description injection is invisible (always on, no UI).

```
┌─ CONSISTENCY (per world) ────────────────────────────┐
│                                                       │
│  ☑ Custom art style       [text field]    [✨Polish] │  ← #2 + #7
│                                                       │
│  ☐ Tier palettes          [Y][G][B][M] editable      │  ← #3 (v1 editable)
│                                                       │
│  ☐ Recurring character    [description]   [✨Polish] │  ← #4 + #7
│                           [📷 ref]                    │
│      └── per-subgroup checkbox when ON               │
│                                                       │
│  ☐ Per-tier style overrides  [Y][G][B][M] [✨Polish] │  ← #5 + #7
│                                                       │
│  ☐ Custom guardrails      [textarea]      [✨Polish] │  ← #6 + #7
│                                                       │
└───────────────────────────────────────────────────────┘

✨ Polish — runs AI validation on free-form text to remove subject-matter
contamination and surface warnings before saving.
```

---

## Example: full prompt assembly

### Collection: Queen Elizabeth (all relevant toggles ON)

```
[FORMAT: VERTICAL PORTRAIT 3:4 — image MUST be taller than wide]

CONTEXT: Late 16th century England was shaped by the formidable reign of
Elizabeth I, a Protestant monarch navigating a realm fraught with religious
upheaval and international intrigue…

MAIN CHARACTER (recurring across cards): Ruiva, casaco bordado dourado,
expressão regal, 30 anos, traje renascentista
[vision reference: <hero cover base64>]

Setting: Foundations of Power universe (reference: …cover prompt…).
Subgroup: The Virgin Queen's Ascent. Elizabeth I's challenging but resolute
rise to the throne. Art direction: majestic, hopeful yet tense.
Scene: A young Elizabeth being crowned in Westminster Abbey…

Dominant palette: gold, amber, honey, warm cream.
Art style: low poly art, geometric shapes, flat shading, vibrant palette.

Avoid: no modern elements, no anachronisms, no patient identifying features.

CRITICAL OUTPUT REQUIREMENT: The final image MUST be VERTICAL / PORTRAIT…
No text, letters, words, labels, captions…
```

### Collection: French Beaches (only #1 and #2 active)

```
[FORMAT: VERTICAL PORTRAIT 3:4 — image MUST be taller than wide]

CONTEXT: As praias mais famosas de França — diversidade entre Mediterrâneo,
Atlântico e Mancha…

Setting: Côte d'Azur universe. Subgroup: O Vendedor de Areia. Vibrante,
luminoso. Scene: cores quentes ao entardecer…

Art style: Voxel art, in the style of Refik Anadol.

[output requirements...]
```

Clean, no forced look beyond the global style.

---

## Implementation effort summary

| Mechanism | Effort | Priority |
|---|---|---|
| #1 Theme description injection | ~30min | Phase 1 (safe default) |
| #2 Custom art style | — | Already done |
| #3 Tier palettes (editable v1) | ~2h | Phase 1 (validated by Brand scenario) |
| #4 Recurring character + per-subgroup | ~3-4h | Phase 2 (transformative for the right collections) |
| #5 Per-tier style overrides | ~2h | Phase 2 (validated by Punk scenario) |
| #6 Negative prompt / guardrails | ~1h | Phase 1 (validated by Brand + Anatomy) |
| #7 Style Polish (AI validator) | ~2-3h | Phase 1.5 (multiplies value of #2/#4/#5/#6) |
| Consistency panel UI | ~1h | Phase 1 (discoverability) |

**Phase 1 total:** ~4-5h — Theme + Tier palettes + Negative prompt + UI panel.
Lifts coverage of ~5 of the 6 scenarios to 100%.

**Phase 1.5 total:** ~2-3h — Style Polish. Reduces the "user shoots themself in
the foot with bad prompts" failure mode. Best shipped immediately after Phase 1
since it amplifies the value of every text field added there.

**Phase 2 total:** ~5-6h — Recurring character + Per-tier styles. Closes the
remaining gaps for biographical and per-era collections.

Each mechanism is independently shippable.

---

## Critical files / extension points

- **`design/types.ts`** — add the new fields to `DesignStructure` and `Subgroup`
- **`design/components/ImageStudio.tsx`** — Consistency panel UI; thread the new
  options into `doGenerate`; pass `visionReference` for #4; wire `✨ Polish`
  buttons for #7
- **`design/services/imageGenService.ts`** — extend `generateImage` to accept
  optional `visionReference?: string` and assemble the final prompt with the
  new sections; pass `negativePrompt` to Imagen API config
- **`design/services/promptPolishService.ts`** *(new)* — AI text refiner for #7;
  reuses `@google/genai` client with a Gemini Flash text model
- **Persistence is automatic** — all fields land in the world JSON via the
  existing `onSave(structure)` flow

---

## Verification (when implemented)

1. *Haunted Houses* — Custom style only → confirm all cards share aesthetic
2. *Queen Elizabeth* — all toggles → confirm Elizabeth looks consistent across
   tiers; uncheck on "The Armada" → confirm her absence
3. *French Beaches* — all toggles OFF → confirm no forced palette
4. *History of Punk* — Per-tier style overrides ON → confirm Yellow ≠ Magenta
   aesthetic; same character would be wrong, so leave #4 off
5. *Corporate Brand* — Tier palettes editable + Negative prompt → confirm brand
   colors locked, no logos/celebrities slip through
6. *Anatomy* — Custom style + Negative prompt → confirm clean diagrammatic
   output without text/blood

---

## Decisões adiadas / descartadas

### Seed control — **descartado**

Considered: passing a fixed random seed per project to keep image generations
reproducible / share visual DNA. **Removed from roadmap** because:

1. **Only works on 1 of 3 models** — Imagen 4 accepts `seed`; Gemini Nano Banana
   (3.1 Flash, 3 Pro) does not expose seed in `generateContent` with
   `responseModalities: ['IMAGE']`
2. **Weak coherence force** — seed gives similar lighting/composition tendencies
   but does NOT lock characters or palettes. Insufficient on its own
3. **Regulatory uncertainty** — Google has shifted policies around seed
   reproducibility for safety/abuse reasons; future availability not guaranteed
4. **Higher-leverage alternatives exist** — Recurring character (vision-conditioned)
   solves character consistency directly; Custom style + Tier palettes lock the
   aesthetic. Seed adds little on top

If a real need ever emerges, the implementation is trivial (1 field + config
param). Until then, not worth the UX surface or the per-model branching.

### Per-subgroup style refinement — **out of scope**

Considered: letting users override style per-subgroup (not just per-tier).
Rejected — the subgroup `scene` prompt already accepts free-form content, so
the user can write per-card style hints there directly without a new mechanism.

### Character entity auto-detection — **out of scope**

Considered: auto-detecting named entities ("Queen Elizabeth", "Mary Stuart") in
subgroup titles and offering multi-character bibles. Powerful but complex. The
single-character mechanism (#4) covers the most common case; multi-character
needs can be revisited if real demand surfaces.

---

## Open questions still pending

None — the model has been stress-tested against 6 archetypal scenarios and
holds up. Ready for implementation phasing whenever the user is.
