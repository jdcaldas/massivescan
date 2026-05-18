# Massive Scan — Design System

A browser-based AI tool for generating complete game design universes. Enter a theme, get a fully structured world with 7 thematic groups, 50+ subgroups, art direction notes, image prompts, and AI-generated images — all powered by Google Gemini and persisted to local JSON files.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [The 5-Step Workflow](#the-5-step-workflow)
5. [Architecture](#architecture)
6. [Data Model](#data-model)
7. [AI Generation Pipeline](#ai-generation-pipeline)
8. [Image Generation](#image-generation)
9. [Persistence Layer](#persistence-layer)
10. [API Usage Tracking](#api-usage-tracking)
11. [Component Reference](#component-reference)
12. [Settings](#settings)
13. [File Structure](#file-structure)

---

## Overview

Massive Scan is a **React 19 + TypeScript + Vite** single-page application that uses Google Gemini to build fully realised game-design worlds from a single text prompt. It is not a generic content generator — the output follows a strict hierarchical schema designed for a physical card game production pipeline:

```
World (theme)
  └── Group × 7          (e.g. "The Founding Monarchs", "Blades of the Reconquest")
        ├── 2 image prompts
        └── Subgroup × 6–8
              └── 2 image prompts each
```

Every piece of generated text is **immediately editable in place**. Every generated image is **auto-saved to disk**. The entire world can be exported as a single JSON file and re-imported later.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| AI text generation | Google Gemini API via `@google/genai` SDK |
| AI image generation | Gemini native (IMAGE modality) + Imagen API |
| Styling | Tailwind CSS — custom `neo-brutalism` utility classes |
| Persistence | Vite dev-server middleware writing JSON files to `archive/` |
| State | React `useState` / `useCallback` / `useRef` — no external state lib |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Gemini API key (get one at [ai.google.dev](https://ai.google.dev))

### Installation

```bash
npm install
```

### Environment

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_api_key_here
```

> The key is injected into the Vite config via the `define` option as `process.env.API_KEY`. It is used server-side by the Gemini SDK — never bundled into the client output.

### Start

```bash
npm run dev
```

App runs at **http://localhost:3000**.

---

## The 5-Step Workflow

The app header always shows a step indicator with five stages. Steps already completed are shown in full opacity; the current step is highlighted in green; future steps are dimmed.

```
[1 WORLD] — [2 GROUPS] — [3 ART] — [4 ASSETS] — [5 EXPORT]
```

| Step | Screen | What happens |
|------|--------|-------------|
| **1 — World** | HomePage | Browse, create, load, delete, rename, lock/unlock worlds |
| **2 — Groups** | Editor | AI generates the 7-group structure; edit every field inline |
| **3 — Art** | ImageStudio | AI generates images for every group and subgroup slot |
| **4 — Assets** | *(planned)* | QR codes, card frames, character placement |
| **5 — Export** | *(planned)* | Final card-ready export |

---

## Architecture

### Three-screen router

`App.tsx` manages a single `currentView` state — no URL router, no external routing library:

```typescript
type View = 'home' | 'editor' | 'images';
```

Transitions happen via callbacks passed down to each screen:
- `onCreateNew` / `onLoadWorld` → `'editor'`
- `onGoToImages` → `'images'`
- `onBack` → `'editor'` or `'home'`

### Global state (App.tsx)

All shared state lives in `App.tsx` and is threaded down as props:

| State | Type | Purpose |
|-------|------|---------|
| `theme` | `string` | The world theme text |
| `themeDescription` | `string` | AI-generated context paragraph |
| `designStructure` | `DesignStructure \| null` | The full world tree |
| `isLoading` | `boolean` | True during full world generation |
| `genProgress` | `{ step, total, label }` | Progress bar data |
| `savedDesigns` | `WorldMeta[]` | Index of all archived worlds |
| `settings` | `AppSettings` | User preferences |
| `selectedModel` | `string` | Active Gemini text model |
| `language` | `string` | Generation output language |
| `activeWorldId` | `string \| null` | UUID of the currently open world |
| `loadingSubgroupKeys` | `Set<string>` | Per-subgroup regen loading state (key: `"groupIndex-subgroupIndex"`) |
| `isUsageOpen` | `boolean` | Usage dashboard visibility |
| `logs` | `LogEntry[]` | Telemetry log for the current session |

### Telemetry wrapper

Every API call goes through `executeWithTelemetry(intent, apiFn)`, which:

1. Increments `turnCount`
2. Sets `activeModel` to the current model name
3. Appends a `LogEntry` with status `'Pending'`
4. On resolve → marks it `'Success'`
5. On reject → marks it `'Error'`, re-throws
6. Always resets `activeModel` to `'Idle'`

---

## Data Model

Defined in `types.ts`.

### ImageScenario

The base unit. An image prompt plus all the card-production metadata fields that will be filled in during the Assets step:

```typescript
interface ImageScenario {
  prompt: string;           // AI-written English image prompt
  base64Image: string;      // Generated image, stored as base64 JPEG
  qrCodePosition: 'TL' | 'TR' | 'BL' | 'BR' | '';
  powerPosition: string;
  powerLevel: string;
  characterPosition: string;
  character: string;
  frameExist: string;
  frameType: string;
  frameColor: string;
  frameWidth: string;
  cardSide: string;
  cardType: string;
  qrCodeURL: string;
  mediaURL: string;
  partner: string;
}
```

### Subgroup

```typescript
interface Subgroup {
  title: string;
  description: string;
  mood: string;                            // Art direction for this subgroup
  imagePrompts: ImageScenario[];           // Always 2 scenarios
  favoriteImagePromptIndex: number | null; // Which image is the "hero"
}
```

### Group

```typescript
interface Group {
  id: string;                              // UUID, generated client-side
  title: string;
  description: string;
  mood: string;                            // Art direction for the group
  icon: string;                            // Short visual label
  subgroups: Subgroup[];                   // 6 regular + 8 for the action group
  imagePrompts: ImageScenario[];           // 2 group-level scenarios
  favoriteImagePromptIndex: number | null;
  isLoading?: boolean;                     // True while this group is being regenerated
  isSubgroupsLoading?: boolean;            // True while all subgroups are being regenerated
}
```

### DesignStructure

```typescript
interface DesignStructure {
  icon: string;        // Global visual icon for the world
  visualStyle: string; // Global art direction
  groups: Group[];     // Always 7 groups
}
```

### SavedDesign

The complete world as it lives on disk:

```typescript
interface SavedDesign {
  id: string;
  theme: string;
  themeDescription: string;
  savedAt: string;       // ISO timestamp
  groupCount: number;
  language?: string;
  locked?: boolean;
  data: {
    theme: string;
    theme_description: string;
    structure: DesignStructure;
  };
}
```

### WorldMeta

A lightweight version of `SavedDesign` without the `data` field. This is what `index.json` stores — loading the home screen does not need to deserialise all base64 images for every world.

```typescript
type WorldMeta = Omit<SavedDesign, 'data'>;
```

---

## AI Generation Pipeline

All text generation is in `services/geminiService.ts`. It uses **structured JSON output** via Gemini's `responseSchema` config — the API is constrained to return exactly the correct shape every time. No parsing heuristics are needed.

### Image prompts are always English

All `imagePrompts` fields in every schema include the constraint: `"MUST BE WRITTEN IN ENGLISH"`. All other text (titles, descriptions, moods) is generated in the user-selected language.

### Full world generation (`generateAll`)

9 sequential API calls with a 1-second delay between each to respect rate limits:

| Step | Call | Output |
|------|------|--------|
| 1 | Base structure | `icon`, `visualStyle`, 6 group stubs (title, description, mood, icon only) |
| 2–7 | Detail each of the 6 groups | 2 `imagePrompts` + 6 `subgroups` (each with their own 2 `imagePrompts`) |
| 8 | Special group base | 7th group stub — an "Actions/Events" group distinct from all others |
| 9 | Special group detail | 2 `imagePrompts` + 8 action subgroups (4 positive, 4 negative outcomes) |

**Progressive rendering:** after each step, `onProgress` fires so the UI updates live as each group materialises.

**Cancellable:** an `AbortSignal` is threaded through. At every step, `checkCancelled()` throws `GenerationCancelledError` if the user clicked Cancel.

### Individual regeneration

| Function | Scope | Behaviour |
|----------|-------|-----------|
| `regenerateGroup` | One group | Replaces the entire group — title, description, mood, icon, all 2 image prompts, all 6 subgroups |
| `regenerateSubgroups` | All subgroups of one group | Regenerates all 6 subgroups; existing sibling titles are passed to the model to avoid duplicates |
| `regenerateSingleSubgroup` | One specific subgroup | Replaces a single subgroup; all sibling titles are passed to avoid duplicates |

### Translation

`translateDesign` sends the entire `DesignStructure` to Gemini with a target language instruction. Titles, descriptions, and moods are translated. **Image prompts are never translated** — they remain in English for image generation compatibility.

`translateText` translates only the theme title string — used by the auto-adapt feature when the user switches language mid-session.

---

## Image Generation

Handled by `services/imageGenService.ts`.

### Two model families

**Nano Banana (Gemini native)**
Uses `ai.models.generateContent` with `responseModalities: ['IMAGE']`. Returns inline base64 data directly in the response parts array.

Models:
- `gemini-2.5-flash-image` ← default
- `gemini-3.1-flash-image-preview`
- `gemini-3-pro-image-preview`

**Imagen (dedicated image engine)**
Uses `ai.models.generateImages()`. Returns `generatedImages[0].image.imageBytes` as either a base64 string or an ArrayBuffer (converted to base64 if needed).

Models:
- `imagen-4.0-generate-001`
- `imagen-3.0-generate-002`
- `imagen-3.0-fast-generate-001`

The routing check is simply `modelId.startsWith('imagen-')`.

### Art styles

Five built-in styles append a descriptive suffix to every prompt before sending:

| Style | Suffix appended to prompt |
|-------|--------------------------|
| Low Poly | `low poly art, geometric shapes, flat shading, vibrant palette` |
| Photorealistic | `photorealistic, cinematic lighting, ultra-detailed, 8K render` |
| Watercolor | `watercolor painting, soft brush strokes, flowing pigments, paper texture` |
| Synthwave | `synthwave aesthetic, neon glow, retro-futuristic, chromatic aberration` |
| Steampunk | `steampunk style, brass and copper, Victorian era, steam and gears` |

**Group image prompt:**
```
{group.title}. {group.description}. Art direction: {group.mood}. Scene: {scenario.prompt}. Art style: {suffix}.
```

**Subgroup image prompt:**
```
Setting: {group.title} universe (reference: {heroPrompt}). Subgroup: {sg.title}. {sg.description}. Art direction: {sg.mood}. Scene: {scenario.prompt}. Art style: {suffix}.
```

The hero group image prompt is injected into every subgroup prompt for visual consistency across the group's card set.

### Concurrency control

A `Semaphore` class caps concurrent image generation requests at **5 at a time**. Batch operations (`generateAllGroups`, `generateAllSubgroups`, `generateGroupSubgroups`) fire all jobs in parallel and the semaphore automatically queues the excess.

### Retry logic

Every request is wrapped in `withRetry` — 3 attempts with exponential backoff: 1 second, 2 seconds, 4 seconds.

### Auto-save after every image

Every successful generation immediately calls `onSave(updatedStructure)` → `fileArchive.saveWorld()` → `POST /api/worlds/:id`. Base64 images are stored inline in the JSON file. A fully-generated world with all group + subgroup images can be 50–100 MB on disk.

### Three-level generation (ImageStudio)

| Level | Trigger | Scope |
|-------|---------|-------|
| Single slot | Click the slot, or Retry on error | One specific image scenario |
| Group's subgroups | "✦ Subgroups" button on group label row | All 12 subgroup slots for one group |
| All groups | "✦ All Groups" in controls bar | Every group-level image across all 7 groups |
| All subgroups | "✦ All Subgroups" in controls bar | All subgroup images for groups that have a hero starred |

**Hero images:** subgroup generation is gated on the parent group having a starred hero image. Starring marks that prompt as the style reference and injects it into every subgroup prompt for that group. If no hero is starred, the "Subgroups" button is visible but disabled with a tooltip explaining why.

---

## Persistence Layer

### Rule

> Every user-configurable value MUST be persisted to a JSON file in `archive/`. `localStorage` is a cache/fallback only — never the source of truth.

### Vite server plugin (`vite.config.ts`)

A custom Vite plugin registers Node.js HTTP middleware on the dev server, providing a file-backed REST API. This is the entire backend — there is no separate server process.

#### `GET/POST/DELETE/PATCH /api/worlds`

| Method | URL | Effect |
|--------|-----|--------|
| GET | `/api/worlds` | Returns `index.json` — array of `WorldMeta` with no image data |
| GET | `/api/worlds/:id` | Returns full `SavedDesign` JSON from `archive/worlds/{id}.json` |
| POST | `/api/worlds/:id` | Writes full world JSON to disk; upserts the entry in `index.json` |
| DELETE | `/api/worlds/:id` | Deletes the world file; removes from `index.json` |
| PATCH | `/api/worlds/:id` | Partial update (used for rename, lock/unlock) — patches both the index and the world file |

#### `GET/POST /api/settings`

| Method | Effect |
|--------|--------|
| GET | Returns `archive/massivescan_settings.json` |
| POST | Overwrites it entirely |

#### `GET/POST /api/usage`

| Method | Effect |
|--------|--------|
| GET | Returns `archive/massivescan_usage.json` |
| POST | Receives `{ date, model, tokensIn, tokensOut }` and **atomically increments** the matching day/model counters |

### Client-side service (`services/fileArchiveService.ts`)

Thin `fetch` wrappers for each endpoint. All operations are fire-and-forget — errors are silently swallowed to never block the UI.

### Migration

On first run, if `archive/massivescan_archive.json` (old single-file format) exists and `archive/index.json` does not, the plugin automatically migrates all worlds to per-file format and renames the old file to `.migrated`.

### File layout on disk

```
archive/
  index.json                         ← WorldMeta[] (lightweight, no image data)
  massivescan_settings.json          ← AppSettings
  massivescan_usage.json             ← Daily API usage log
  massivescan_archive.json.migrated  ← Old format (backup only)
  worlds/
    {uuid}.json                      ← Full SavedDesign including all base64 images
    {uuid}.json
    ...
```

---

## API Usage Tracking

### What is tracked

| Call type | Tokens in | Tokens out |
|-----------|-----------|-----------|
| Gemini text generation | Actual prompt token count | Actual candidate token count |
| Image generation (any model) | 0 | 0 (image APIs do not expose token counts) |

### Storage format

`archive/massivescan_usage.json`:

```json
{
  "days": {
    "2026-05-17": {
      "models": {
        "gemini-2.5-flash": {
          "calls": 42,
          "tokensIn": 125000,
          "tokensOut": 38000
        },
        "gemini-2.5-flash-image": {
          "calls": 28,
          "tokensIn": 0,
          "tokensOut": 0
        }
      }
    },
    "2026-05-16": { ... }
  }
}
```

Each POST to `/api/usage` **increments** counters — it never replaces existing data. Day keys are `YYYY-MM-DD` strings in local time.

### UsageDashboard

Accessible via the **📊 chart icon** in every screen's header (HomePage, Editor, ImageStudio). The modal shows:

- **All-time summary card** — total calls, tokens in, tokens out, number of days tracked
- **Day-by-day rows** (newest first) — each row shows model pill tags summarising activity; click any row to expand a full per-model table with exact token counts
- **All-time by model grid** — one card per model, showing cumulative calls and total tokens

Large numbers are formatted as `1.2K` / `3.4M` for readability.

---

## Component Reference

### `HomePage`

The world library. Shows all saved worlds as a grid (default) or list.

Features:
- Search by theme title or description
- Grid / list view toggle
- Inline rename — click the title
- Lock / unlock — locked worlds cannot be deleted
- Export world as JSON download
- Delete with confirmation dialog
- Step indicator showing step 1 active, steps 2–5 dimmed

### `Header` (Editor header)

Sticky top bar for the world editor.

Features:
- Language selector (EN / PT / ES / FR / IT) with optional auto-translate of the theme title when switching
- Theme input + Generate button
- Collapsible theme description textarea with expand/collapse toggle
- Progress bar with step label and Cancel button during generation
- "All Subgroups" regeneration button — fires `regenerateSubgroups` for all 7 groups in parallel
- Save, Images →, Translate (with target language selector), Import, Export, Clear actions
- Step indicator: step 1 complete (white box), step 2 active (green), steps 3–5 dimmed
- Step 3 becomes clickable when a world has been generated — navigates to ImageStudio
- Collapse panel to maximise editor space

### `DesignCanvas`

The main editor body. Renders all 7 `GroupCard` components.

Features:
- Collapse all / Peek (description only) / Expand all controls
- Card view (3-column grid) / List view toggle
- Computes `loadingSubgroupIndices` for each group from the global `loadingSubgroupKeys` Set and passes it to the card

### `GroupCard`

Individual card for one group with three expand states:

- **Collapsed** — title bar only (index number + title + action buttons)
- **Peek** — adds description below the title
- **Expanded** — full card: description, art direction (mood), image prompts list, subgroups list

Per-subgroup capabilities:
- **Dice icon on hover** (visible per-row) → `regenerateSingleSubgroup` — replaces just that one subgroup via a targeted API call
- **Spinner overlay** on the loading subgroup while the API call is in progress
- **Dice icon in "Subgroups" section header** → `regenerateSubgroups` — replaces all subgroups for this group
- **Dice icon in card header** → `regenerateGroup` — replaces the entire group

All text fields (title, description, mood, icon, image prompts) are wrapped in `EditableText` and editable inline.

### `ImageStudio`

The image generation workspace. Two views:

**Accordion view** (default):
One collapsible card per group. Inside: 2 large group image slots, then a nested list of collapsible subgroup rows, each containing 2 image slots. "Gen All Subgroups" button per group (when hero is starred).

**Grid view**:
A compact visual overview per group. Cards are arranged as **paired containers** — IMG 1 + IMG 2 form the first pair, then SG1·1 + SG1·2, SG2·1 + SG2·2, etc. A thin vertical separator between each pair makes the "choose one from this pair" selection unit visually clear. Pairs that overflow the row wrap cleanly to the next line.

- **Zoom control** (`−` / `%` / `+`) appears in the controls bar when in grid mode. Card width steps by 16 px per click (48 px minimum, 192 px maximum). Default is **167%** (~120 px). The zoom percentage is shown live between the buttons.
- "✦ Subgroups" button on each group label row — always visible, disabled with tooltip until a hero is starred.

**Lightbox**:
Clicking any generated image (in both accordion and grid views) opens a fullscreen lightbox modal — dark blurred overlay, image scaled to `max 88vw / 80vh`, label below (e.g. *"LÂMINAS DA RECONQUISTA · IMG 1"* or *"OS MONARCAS FUNDADORES · Cavaleiros · SG1·2"*). Close with **Esc**, click outside, or the **✕** button. Only images that have been generated are clickable (cursor shows `zoom-in` on hover).

Controls bar (sticky below the header):
- Art style selector (5 styles, toggle buttons)
- Model selector dropdown (6 models)
- Live progress counter (`N generating…`)
- **Zoom control** (`−` / `%` / `+`) — grid mode only
- "✦ All Groups" / "✦ All Subgroups" split button — or Cancel during active generation
- "← Back to World" button

Auto-save footer: confirms every image is auto-saved to `archive/worlds/{id}.json`.

### `SettingsModal`

User preferences. All settings are persisted to `archive/massivescan_settings.json` immediately on change.

Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| Default Language | English | Language for all generated text |
| Default World Model | `gemini-2.5-flash` | Gemini model for text generation |
| Default Image Model | `gemini-2.5-flash-image` | Model for image generation |
| Auto-adapt Theme | On | Translate the theme title when switching language |
| Default Translate To | Portuguese | Pre-selected target language for Translate action |
| Group Count | 7 | Number of groups to generate |

On startup, if a stored model ID no longer appears in the known model list (deprecated model), the value is silently reset to the default and the correction is persisted back to the file.

### `UsageDashboard`

API usage analytics modal. See [API Usage Tracking](#api-usage-tracking) above.

### `TelemetryOverlay`

A collapsible drawer fixed to the bottom of the editor screen.

Shows:
- Active model name and session turn counter
- Full chronological log of all API calls: timestamp, model, user intent description, status badge (Pending / Success / Error)
- Live model switcher — change the active text model mid-session
- "Export logs" button — downloads the session log as a JSON file

### `EditableText`

Any `<p>`, `<h2>`, `<h4>`, or `<span>` wrapped in this component becomes click-to-edit. A textarea or input appears on click; commits on blur or Enter; cancels on Escape. Supports a `isTextarea` prop for multi-line fields.

### `icons.tsx`

All SVG icons as typed React components using Heroicons paths.

---

## Settings

```typescript
// types.ts
const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: 'English',
  defaultModel: 'gemini-2.5-flash',
  defaultImageModel: 'gemini-2.5-flash-image',
  autoAdaptTheme: true,
  defaultTranslateTo: 'Portuguese',
  groupCount: 7,
};
```

### Available text models

| ID | Display name |
|----|-------------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro |
| `gemini-3.1-flash-preview` | Gemini 3.1 Flash |
| `gemini-3.1-flash-lite-preview` | Gemini 3.1 Flash Lite |
| `gemini-3-pro-preview` | Gemini 3 Pro |
| `gemini-3-flash-preview` | Gemini 3 Flash |
| `gemini-2.5-flash` | Gemini 2.5 Flash |
| `gemini-2.5-flash-lite-latest` | Gemini 2.5 Flash Lite |

### Available image models

| ID | Display name | Family |
|----|-------------|--------|
| `gemini-2.5-flash-image` | Nano Banana · 2.5 Flash | Gemini native |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 · 3.1 Flash | Gemini native |
| `gemini-3-pro-image-preview` | Nano Banana Pro · 3 Pro | Gemini native |
| `imagen-4.0-generate-001` | Imagen 4 | Imagen |
| `imagen-3.0-generate-002` | Imagen 3 | Imagen |
| `imagen-3.0-fast-generate-001` | Imagen 3 Fast | Imagen |

---

## File Structure

```
massivescan/
│
├── index.html                       # HTML entry point
├── package.json                     # React 19, Vite 6, @google/genai
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite config + file API middleware (the whole backend)
├── CLAUDE.md                        # Project rules for AI assistants
│
├── App.tsx                          # Root component — all global state and handlers
├── index.tsx                        # ReactDOM render entry point
├── types.ts                         # All TypeScript interfaces + DEFAULT_SETTINGS
│
├── services/
│   ├── geminiService.ts             # All Gemini text API calls
│   │                                #   generateAll, generateThemeDescription,
│   │                                #   regenerateGroup, regenerateSubgroups,
│   │                                #   regenerateSingleSubgroup, translateDesign,
│   │                                #   translateText
│   ├── imageGenService.ts           # Image generation (Nano Banana + Imagen)
│   │                                #   generateImage, IMAGE_STYLES, IMAGE_MODELS
│   │                                #   Semaphore, withRetry
│   ├── fileArchiveService.ts        # fetch wrappers for /api/worlds + /api/settings
│   └── usageService.ts              # fetch wrappers for /api/usage
│
├── components/
│   ├── HomePage.tsx                 # World library (step 1)
│   ├── Header.tsx                   # Editor sticky header with all controls (step 2)
│   ├── DesignCanvas.tsx             # Grid/list container for GroupCards
│   ├── GroupCard.tsx                # Individual group card with inline editing
│   │                                #   + per-subgroup regeneration
│   ├── ImageStudio.tsx              # Image generation workspace (step 3)
│   │                                #   Accordion view + Grid view
│   │                                #   generateAllGroups, generateAllSubgroups,
│   │                                #   generateGroupSubgroups
│   ├── SettingsModal.tsx            # Preferences modal
│   ├── UsageDashboard.tsx           # API usage analytics modal
│   ├── TelemetryOverlay.tsx         # Bottom API log drawer + model switcher
│   ├── EditableText.tsx             # Click-to-edit inline text component
│   ├── HighlightOnChange.tsx        # Pulse animation on value change
│   └── icons.tsx                   # All SVG icon components
│
└── archive/                         # All persisted data (never committed to git)
    ├── index.json                   # WorldMeta[] — lightweight index, no image data
    ├── massivescan_settings.json    # AppSettings
    ├── massivescan_usage.json       # Daily API usage log
    └── worlds/
        └── {uuid}.json              # One file per world — full SavedDesign with images
```

---

## Design Language

The UI follows **Neo Brutalism**: thick borders, solid box-shadows, hard edges, all-caps labels, black-on-white with a mint green accent.

Global Tailwind utilities:
- `.neo-card` — `border-2 border-black` + `box-shadow: 4px 4px 0 0 #000`
- `.neo-btn` — same, interactive with `:active` translate
- `.neo-input` — same border treatment on form controls
- `.neo-section-label` — `text-[9px] font-black uppercase tracking-widest`

Color tokens via CSS custom properties (dark mode via `.dark` on `<html>`):

| Token | Light | Dark |
|-------|-------|------|
| `brand-bg` | Off-white | Near-black |
| `brand-surface` | White | Dark grey |
| `brand-text` | Near-black | Near-white |
| `brand-subtle` | Mid-grey | Muted |
| `brand-primary` | Black | Neon green |
| `brand-secondary` | Mint green `#6EE7B7` | Darker mint |

---

## Key Design Decisions

**Why local file persistence instead of a database?**
This tool is designed for local single-user operation. File JSON is inspectable, portable, and zero-infrastructure. The Vite middleware only runs during `npm run dev` — this is intentional. There is no production deployment target.

**Why are base64 images stored inline in the JSON?**
World files are designed to be fully self-contained and shareable as a single file. One `.json` file contains everything needed to reconstruct the full world view with all generated images. Trade-off: a fully generated world can be 50–100 MB on disk.

**Why are image prompts always in English?**
Gemini image generation models perform significantly better with English prompts. The text content of the world (titles, descriptions, mood) is localised per the user's language preference, but image prompts are always kept in English regardless of the UI language setting.

**Why a semaphore for image generation?**
The Gemini API has rate limits. Firing 100+ image requests simultaneously causes 429 errors. The semaphore caps concurrent requests at 5, with automatic retry on failure, giving smooth batch generation without any manual throttling or sleep loops.

**Why structured JSON output for text generation?**
Using Gemini's `responseSchema` constraint eliminates the need for regex or heuristic parsing of AI responses. The API is forced to return data in exactly the correct shape. If the schema validation fails on the Gemini side, it returns an error rather than malformed JSON — this is safer than trying to repair bad JSON client-side.
