
export interface ImageScenario {
  prompt: string;
  base64Image: string;
  // Positioning
  qrCodePosition?: string;
  number_Position?: string;
  number?: string;
  boxColorPosition?: string;
  boxColor?: string;
  powerPosition?: string;
  letter_Position?: string;
  // Legacy / extended
  powerLevel?: string;
  characterPosition?: string;
  character?: string;
  frameExist?: string;
  frameType?: string;
  frameColor?: string;
  frameWidth?: string;
  cardSide?: string;
  cardType?: string;
  qrCodeURL?: string;
  mediaURL?: string;
  partner?: string;
}

export interface Subgroup {
  title: string;
  description: string;
  mood: string;
  imagePrompts: ImageScenario[];
  favoriteImagePromptIndex: number | null;
  /** Per-subgroup override for the world's recurring character: when true,
   *  this subgroup's prompts will NOT include the main character (e.g. "The
   *  Spanish Armada" subgroup in a Queen Elizabeth world). Only consulted
   *  when DesignStructure.recurringCharacter.enabled is true. */
  excludeMainCharacter?: boolean;
}

export interface Group {
  id: string;
  title: string;
  description: string;
  mood: string;
  icon: string;
  subgroups: Subgroup[];
  imagePrompts: ImageScenario[];
  favoriteImagePromptIndex: number | null;
  isLoading?: boolean;
  isSubgroupsLoading?: boolean;
  /** Deck Fusion mapping key (e.g. "Grupo A", "Grupo Power-ups") */
  groupType?: string;
  /** Card Studio: show a coloured border on the back of cards in this group */
  backColoredBorder?: boolean;
}

export interface DesignStructure {
  icon: string;
  visualStyle: string;
  groups: Group[];
  /** User-pasted custom art-style suffix for the Image Studio (e.g.
   *  "Voxel Art, in the style of Refik Anadol"). Persisted with the world. */
  customImageStyle?: string;
  /** Opt-in palette discipline per color tier (Yellow/Green/Blue/Magenta).
   *  When enabled, the tier-specific text is appended to image prompts as
   *  "Dominant palette: …". Only applies to the 4 color tiers, never to
   *  Power-Ups / Utility / Activators. */
  tierPalettes?: {
    enabled: boolean;
    yellow?: string;
    green?: string;
    blue?: string;
    magenta?: string;
  };
  /** User-defined negative prompt — things to AVOID in every image.
   *  Appended as "Avoid: …" since neither Imagen nor Gemini multimodal
   *  expose a native negativePrompt field in the @google/genai SDK. */
  negativePrompt?: string;
  /** Remembered Image Studio preferences per world — so reopening the
   *  studio restores the user's last choice instead of resetting to defaults. */
  imageStyle?: string;   // IMAGE_STYLES id (low-poly / photorealistic / steampunk / custom)
  imageFormat?: string;  // ArtFormatId — '1:1' | '3:4' | '16:9'
  imageModel?: string;   // IMAGE_MODELS id (e.g. 'gemini-3.1-flash-image-preview')
  /** Opt-in: a recurring protagonist that should appear consistently across
   *  cards (e.g. Queen Elizabeth in a biographical deck). When enabled, the
   *  description is injected into every prompt and the reference image (if
   *  any) is passed as vision input to multimodal Gemini models. Per-card
   *  exclusion via Subgroup.excludeMainCharacter. */
  recurringCharacter?: {
    enabled: boolean;
    /** Free-form physical / aesthetic description used as text anchor.
     *  E.g. "Ruiva, casaco bordado dourado, expressão regal, 30 anos…" */
    description: string;
    /** Pointer to an existing image in the structure to use as visual anchor.
     *  Resolved at runtime by reading
     *  structure.groups[gi].subgroups[si].imagePrompts[pi].base64Image. */
    referenceSlot?: { gi: number; si: number; pi: number };
    /** Alternative: an uploaded reference image (base64, no MIME prefix).
     *  Takes precedence over referenceSlot when both are set. */
    referenceImageBase64?: string;
  };
}

export interface TokenUsage {
  in: number;
  out: number;
}

export interface ApiStats {
  generateAll: number;
  regenerateGroup: number;
  regenerateSubgroups: number;
  tokens: Record<string, TokenUsage>;
}

export interface SavedDesign {
  id: string;
  theme: string;
  themeDescription: string;
  savedAt: string;
  groupCount: number;
  language?: string;
  locked?: boolean;
  data: {
    theme: string;
    theme_description: string;
    structure: DesignStructure;
  };
}

// Lightweight metadata stored in index.json — no full world data
export type WorldMeta = Omit<SavedDesign, 'data'>;

export interface AppSettings {
  defaultLanguage: string;
  defaultModel: string;
  defaultImageModel: string;
  autoAdaptTheme: boolean;
  defaultTranslateTo: string;
  groupCount: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: 'English',
  defaultModel: 'gemini-2.5-flash',
  defaultImageModel: 'gemini-3.1-flash-image-preview',
  autoAdaptTheme: true,
  defaultTranslateTo: 'Portuguese',
  groupCount: 7,
};

export interface LogEntry {
  turn_id: number;
  timestamp: string;
  model_used: string;
  user_intent: string;
  status: 'Pending' | 'Success' | 'Error';
}

// ── Recycle Bin ────────────────────────────────────────────────────────────
// Holds images that were discarded (regenerated/cleared/deleted) so they can
// be adopted into any other slot later. Storage: projects/<pid>/design/recycle_bin.json

export interface RecycleBinEntry {
  id: string;                       // unique entry id
  base64Image: string;              // the image itself
  prompt: string;                   // original prompt used to generate it
  style?: string;                   // style id (low-poly, photorealistic, etc.)
  format?: string;                  // square / portrait / wide
  sourceGroupTitle?: string;        // where it came from
  sourceSubgroupTitle?: string;     // (empty if it was a group cover)
  sourceWorldId?: string;
  discardedAt: string;              // ISO timestamp
  reason: 'regenerate' | 'clear' | 'delete' | 'regenerate-all' | 'manual';
}

// ── Deck Fusion types ──────────────────────────────────────────────────────

export interface DeckDetails {
  deck_name: string;
  deck_description: string;
  version: number;
  baseUrl: string;
  utilityBaseUrl: string;
  deck_id: string;
  errorCorrectionLevel: string;
}

export interface QRCodeEntry {
  id: string;
  pathId: string;
  key: string;
  type: string;
  number?: number;
  color?: string;
  letter?: string;
  stars: number;
  card_color?: string;
}

export interface DeckConfig {
  deck_details: DeckDetails;
  qrcodes: QRCodeEntry[];
}

export interface FusionGDesignData {
  title: string;
  description: string;
  mood: string;
  visual_config: ImageScenario;
}

export interface MergedQRCode extends QRCodeEntry {
  gdesign_data?: FusionGDesignData;
}

export interface MergedDeck {
  deck_details: DeckDetails & { merge_version?: string };
  qrcodes: MergedQRCode[];
}

// ── Deck constraints (drives generation) ──────────────────────────────────────

export interface DeckGroupConstraint {
  groupType: string;      // "Grupo A", "Grupo B", etc.
  subgroupCount: number;  // exact number of game_card entries for this tier
  label: string;          // human-readable label
}

export interface DeckConstraints {
  deckFile: string;       // filename (for reference)
  deckName: string;       // human-readable deck name
  groups: DeckGroupConstraint[];
}
