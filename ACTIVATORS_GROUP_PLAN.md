# Plan — Extract `game_activator` into its own Activators Group

> Status: **APPROVED — ready for implementation**
> Author: Claude (planning session 2026-05-21)
> Approved: 2026-05-21

## Decisions locked in

1. ✅ **Color** — `#FF4F6D` brand pink (continuidade com o chip atual)
2. ✅ **Card Studio panel** — `<TBDPanel>` (coerente com Power-ups & Utility)
3. ✅ **Migration de worlds antigos** — auto-adicionar 7º grupo vazio no load
4. ✅ **Cards module** — bucket Activators separado (chip + summary + Section próprios)
5. ✅ **Fix oportunista** — Utility `subgroupCount: 5 → 4` no LLM prompt
6. ✅ **`_zip_preview_v2`** — deixar como está (app standalone isolada, não afeta o app principal)

## Goal
Today: `game_activator` is bundled inside "Utility" (Grupo Extra/Utilitários).
Target: `game_activator` becomes its own 7th group — **Activators (Grupo Activators)** — with its own card cover, color, and filter, end-to-end through Concept → Image → Card → Fusion studios and the Cards module.

Essential Plus Deck composition (post-change):

- 28 cards (4 tiers × 7) + 8 Power-ups + **4** Utility + **1 Activator** = **41 QR codes** (unchanged total, taxonomy reshuffled)

---

## A — Key decisions (recommendations)

| # | Decision | Recommendation | Why |
|---|---|---|---|
| 1 | Group key name | `'Grupo Activators'` | Consistent with English `'Grupo Power-ups'` |
| 2 | Group color | `#FF4F6D` (brand pink) | Already the chip color for game_activator — visual continuity |
| 3 | Card Studio panel | `<TBDPanel>` for now | Consistent with Power-ups & Utility — no element positions to configure |
| 4 | Migration of old worlds (6-group) | **Auto-add an empty 7th group on load** if `'Grupo Activators'` is missing AND the design has existing groupTypes assigned | User can then generate cover from Image Studio; merger finds the group; no surprise failures |
| 5 | Cards module | Add an **Activators bucket** in CardsApp summary + a separate Section for QR management, but keep `game_activator` inside `UTILITY_TYPES` in **QRCodesManager.tsx** (that constant drives UI form-shape — no color/letter, not taxonomy) | Mirrors the new taxonomy where it matters (summary, deck breakdown) without duplicating UI logic |
| 6 | Opportunistic fix | Correct `DESIGN_PHASE_GROUPS` Utility `subgroupCount: 5 → 4` (current value doesn't match the actual deck) | Already broken; fix while we're nearby |
| 7 | `_zip_preview_v2/services/jsonMerger.ts` | Update in parallel (5-line change) | Defensive — it's a parallel implementation; keep them in sync. If dead code, we delete later |

---

## B — Files to change, by area

### B1. Shared taxonomy (single source of truth)

- **`cards/deckTypeMeta.ts`**
  - `TypeMeta.group` union: add `'activator'`
  - `game_activator` entry: `group: 'utility'` → `'activator'`
  - `GROUP_META`: insert `activator: { bg: '#FF4F6D', fg: '#FFFFFF', label: 'Activators' }` before `total`

### B2. Mapping & merge logic

- **`design/services/deckFusionService.ts`**
  - `SPECIAL_TYPE_TO_GROUP_TYPE.game_activator`: `'Grupo Extra/Utilitários'` → `'Grupo Activators'`
  - `GROUP_TYPE_OPTIONS`: add `{ value: 'Grupo Activators', label: 'Activators' }`
  - `computeDeckConstraints`: split — `game_activator` → `'Grupo Activators'` counter; `promo_video|sponsor|instructions` stay in Utility
  - `ORDER` array: add `'Grupo Activators'` after Utility
  - Synthetic back generation:
    - Shrink `utilityTypes` Set to `['promo_video', 'sponsor', 'instructions']`
    - Add new block synthesizing a back for activators (color key `'__activator'`)

- **`_zip_preview_v2/services/jsonMerger.ts`** (parallel impl) — same `SPECIAL_TYPE_TO_GROUP_TYPE` edit

### B3. LLM prompt (Concept Studio generation)

- **`design/services/geminiService.ts`**
  - `DESIGN_PHASE_GROUPS`:
    - Update Utility entry: `subgroupCount: 4`, label updated, remove "Ativador de Jogo" from `subgroupNature`
    - Add new 7th entry: `groupType: 'Grupo Activators'`, `color: 'Special'`, `subgroupCount: 1`, label "Activators — 1 activator card", `subgroupNature` describing the game-launch/activator card
  - Header comment "6 groups" → "7 groups"
  - `deckGroupsHint` text block: update intro count, update Group 6 description (no activator), add Group 7 description
  - Update inline comments mentioning "6 groups"

### B4. Studios (visuals)

- **`design/components/CardStudio.tsx`**
  - `CARD_COLORS`: add `'#FF4F6D'` as 7th entry
  - `GROUP_TYPE_LABEL`: add `'Grupo Activators': 'Activators'`
  - No change to `GAME_CARD_TYPES` (activator uses TBDPanel)

- **`design/components/ImageStudio.tsx`**
  - `CARD_COLORS`: add 7th `'#FF4F6D'`
  - `CARD_COLOR_NAMES`: add `'Activators'`
  - `GROUP_TYPE_LABEL`: add Activators entry

- **`design/components/GroupCard.tsx`** (Concept Studio cards)
  - `CARD_COLORS`: add 7th `'#FF4F6D'`
  - Update header comment listing tier order

### B5. Deck Fusion

- **`design/components/DeckFusion.tsx`**
  - `PREVIEW_FILTERS`: add `{ key: 'activator', label: 'Activators', bg: '#FF4F6D', fg: '#FFFFFF' }`
  - Define `ACTIVATOR_TYPES = new Set(['game_activator'])`, remove `game_activator` from `UTILITY_TYPES`
  - `cardMatchesFilter`: add `'activator'` branch
  - Back-key resolution: add `else if (qr.type === 'game_activator') backKey = '__activator'`
  - `CARD_COLORS`: add 7th `'#FF4F6D'`
  - `AUTO_GROUP_TYPES`: add `'Grupo Activators'` as 7th
  - **Migration**: in the `useState` initializer, if structure has 6 groups and `Grupo Activators` is missing, push a synthetic empty Activators group (with `id`, empty `imagePrompts`, 1 empty subgroup, `groupType: 'Grupo Activators'`)

### B6. Cards module

- **`cards/CardsApp.tsx`**
  - Add `ACTIVATOR_TYPES: QRCodeType[] = ['game_activator']` next to `UTILITY_TYPES`
  - Remove `game_activator` from `UTILITY_TYPES` (here only — not in QRCodesManager)
  - Add `activatorQRCodes`, `enrichedActivatorQRCodes` parallels
  - Add an "Activators" stats chip in header
  - Add an "Activators" cell in the Deck Summary totals row (consuming `GROUP_META.activator`)
  - Add a `<Section title="QR Codes — Activators [N]">` with its own `<QRCodesManager>` instance
  - Update the hardcoded description text "28 cards (4×7) + 8 power-ups + utility QR codes" → include Activators

- **`cards/components/QRCodesManager.tsx`**
  - **No change** — `UTILITY_TYPES` here is about UI form shape (which fields to render). Activator naturally fits that shape.

- **`cards/components/DeckDetailsForm.tsx`**
  - Optional: add `activatorBaseUrl?` field. **Recommendation: skip this for now** — keep them sharing `utilityBaseUrl` until there's a reason to split. Easy to add later.

### B7. Data files

- **No mass edits to existing JSON files** — `qrcode` entries are bucket-agnostic. They'll be re-bucketed by the new mapping at runtime.
- The 3 existing deck configs (`projects/*/cards/saved/*config.json`) still contain `game_activator-001` — they'll now be routed to Grupo Activators on next merge.

---

## C — Migration behavior for existing worlds

Old worlds have 6 groups with groupTypes already set. On load in Deck Fusion:

1. Detect: `structure.groups.length === 6` AND no group has `groupType === 'Grupo Activators'`
2. Push a new group:
   ```ts
   {
     id: 'auto-activators',
     title: '',
     description: '',
     mood: '',
     groupType: 'Grupo Activators',
     imagePrompts: [],
     subgroups: [{ id: '...', title: '', description: '', mood: '', imagePrompts: [] }],
   }
   ```
3. User now has a 7th group visible in all studios. To get an actual cover, they regenerate it via Image Studio.

This is non-destructive — old data remains, just gains a new (empty) group.

---

## D — Order of operations

1. **deckTypeMeta.ts** — add the `'activator'` group bucket
2. **deckFusionService.ts** — re-route activator type + synthetic back + constraint logic
3. **_zip_preview_v2/services/jsonMerger.ts** — mirror the activator routing
4. **geminiService.ts** — extend prompt to generate 7 groups
5. **CardStudio.tsx + ImageStudio.tsx + GroupCard.tsx** — add the 7th color + label
6. **DeckFusion.tsx** — filter tab + back lookup + AUTO_GROUP_TYPES + migration logic
7. **CardsApp.tsx** — Activators bucket end-to-end (chip, summary cell, section)
8. **Manual smoke test** — load old world (verify auto-add), load deck config, merge, check preview filter "Activators", download JSON

---

## E — What does NOT change

- Existing deck-config JSON files
- Existing world JSON files (on disk) — they get an extra group at load time
- `QRCodesManager.tsx` form shape (activator still uses the utility form shape)
- `utilityBaseUrl` (shared with activators for now)
- LLM regenerate-group / regenerate-subgroups defaults (tier paths only)

---

## F — Decisions (all approved 2026-05-21)

1. ✅ **Color `#FF4F6D` (brand pink)** for the Activators group
2. ✅ **TBDPanel** for the Activators group in Card Studio
3. ✅ **Auto-add a 7th empty group** when loading an old world
4. ✅ **Cards module gets a parallel Activators bucket**
5. ✅ **Fix the Utility `subgroupCount: 5 → 4`** mismatch
6. ⏸️ **`_zip_preview_v2`** — leave as-is (standalone app, isolated from main app)

---

## G — Detailed touchpoint reference (file + line)

For when implementation starts, here is the line-level map produced during planning.

### G1. `cards/deckTypeMeta.ts`

- L12 — `TypeMeta.group` union → add `'activator'`
- L28 — `game_activator` entry → `group: 'activator'`
- L40-45 — `GROUP_META` → insert `activator` row before `total`
- L49 — `FALLBACK_TYPE_META.group` stays `'utility'`

### G2. `design/services/deckFusionService.ts`

- L27-32 — `COLOR_TO_GROUP_TYPE` (no change)
- L35-41 — `SPECIAL_TYPE_TO_GROUP_TYPE` → `game_activator: 'Grupo Activators'`
- L44-52 — `GROUP_TYPE_OPTIONS` → add Activators row
- L86-88 — `computeDeckConstraints` → split activator from utility array
- L92-95 — `ORDER` → add `'Grupo Activators'`
- L247-260 — Synthetic back generation → split utility/activator paths

### G3. `design/services/geminiService.ts`

- L4-10 — header comment (6 → 7)
- L11-42 — `DESIGN_PHASE_GROUPS` → fix utility, add activators
- L87 — schema description (leave; not on active path)
- L187-189 — `deckGroupsHint` text — major rewrite
- L279 — inline comment (6 → 7)

### G4. `design/components/CardStudio.tsx`

- L11-18 — `CARD_COLORS` (add 7th)
- L22-29 — `GROUP_TYPE_LABEL` (add row)
- L32 — `GAME_CARD_TYPES` (no change)
- L588 — `CARD_COLORS[gi % …]` — modulo handles 7

### G5. `design/components/ImageStudio.tsx`

- L12-19 — `CARD_COLORS` (add 7th)
- L20 — `CARD_COLOR_NAMES` (add `'Activators'`)
- L23-30 — `GROUP_TYPE_LABEL` (add row)
- L846, 905, 990, 1060, 1125, 1208 — modulo handles 7

### G6. `design/components/GroupCard.tsx`

- L21-30 — `CARD_COLORS` (add 7th + update comment)

### G7. `design/components/DeckFusion.tsx`

- L73-81 — `PREVIEW_FILTERS` (add activator)
- L85 — `UTILITY_TYPES` (remove `game_activator`)
- L87-96 — `cardMatchesFilter` (add activator branch)
- L120-127 — back-key resolution (add activator)
- L336 — `CARD_COLORS` (add 7th)
- L339 — `AUTO_GROUP_TYPES` (add `'Grupo Activators'`)
- L347-353 — migration block (new)

### G8. `cards/CardsApp.tsx`

- L25 — `UTILITY_TYPES` (remove `game_activator`)
- new constant — `ACTIVATOR_TYPES`
- L32, L75-83 — filter + enrich parallels
- L274-287, L363, L379 — references to update
- L351-358 — `generateEssentialPlusDeck()` (no structural change)
- L434 — header chip row (add Activators chip)
- L493 — hardcoded description text
- L627-639 — Deck Summary totals row (add Activators)
- L681-697 — utility breakdown (remove activator chip; render in own section)
- L711-712 — new Section + QRCodesManager for Activators

### G9. `_zip_preview_v2/services/jsonMerger.ts`

- L32-38 — `SPECIAL_TYPE_TO_GROUP_TYPE.game_activator: 'Grupo Activators'`

### G10. World JSON files (no edits — runtime migration handles them)

- `projects/mpbqq0wbah4sj/design/worlds/*.json`
- `projects/mpen5herts0zt/design/worlds/*.json`
- `projects/mpd3q7v7f2by1/design/worlds/*.json`
- `archive/worlds/*.json`

### G11. Deck config JSON files (no edits)

- `projects/*/cards/saved/*config.json`

### G12. Stale `.tmp` files (can be deleted any time)

- `design/components/DeckFusion.tsx.tmp.*`
- `design/components/Header.tsx.tmp.*`
- `design/components/ImageStudio.tsx.tmp.*`
