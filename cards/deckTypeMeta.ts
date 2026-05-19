// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for deck-type colors, labels, and groupings.
// Used by BOTH the Cards module (Deck Summary) and the Design module
// (Deck Fusion → Deck Config Breakdown) so the two views stay coherent.
// ─────────────────────────────────────────────────────────────────────────────

/** Visual identity for one QR-code type (chip background + foreground). */
export interface TypeMeta {
  bg: string;     // chip background
  fg: string;     // chip text color
  label: string;  // human-readable name
  group: 'cards' | 'powerups' | 'utility';
}

/** Per-type metadata — keyed by the QR `type` field. */
export const DECK_TYPE_META: Record<string, TypeMeta> = {
  // ─── Game cards (the 4 color-tier playable cards + their backs) ────────────
  game_card:      { bg: '#1A1A1A', fg: '#FFFFFF', label: 'Game Card',       group: 'cards'    },
  game_card_back: { bg: '#3A3A3A', fg: '#FFFFFF', label: 'Game Card Back',  group: 'cards'    },

  // ─── Power-ups (matches Group 5 violet) ───────────────────────────────────
  power_up:       { bg: '#C4B5FD', fg: '#1A1A1A', label: 'Power-up',        group: 'powerups' },

  // ─── Utility sub-types (charcoal family + brand pink for the activator) ───
  promo_video:    { bg: '#374151', fg: '#FFFFFF', label: 'Promo Video',     group: 'utility'  },
  sponsor:        { bg: '#6B7280', fg: '#FFFFFF', label: 'Sponsor',         group: 'utility'  },
  instructions:   { bg: '#9CA3AF', fg: '#1A1A1A', label: 'Instructions',    group: 'utility'  },
  game_activator: { bg: '#FF4F6D', fg: '#FFFFFF', label: 'Game Activator',  group: 'utility'  },
};

/** Visual identity for the 4 game-card color tiers. */
export const TIER_META: Record<'yellow' | 'green' | 'blue' | 'magenta', { bg: string; fg: string }> = {
  yellow:  { bg: '#FDE68A', fg: '#1A1A1A' },
  green:   { bg: '#86EFAC', fg: '#1A1A1A' },
  blue:    { bg: '#7DD3FC', fg: '#1A1A1A' },
  magenta: { bg: '#F0ABFC', fg: '#1A1A1A' },
};

/** Top-level aggregate buckets shown in the Deck Summary "totals" row. */
export const GROUP_META = {
  cards:    { bg: '#1A1A1A', fg: '#FFFFFF', label: 'Game Cards' },
  powerups: { bg: '#C4B5FD', fg: '#1A1A1A', label: 'Power-ups'  },
  utility:  { bg: '#4B5563', fg: '#FFFFFF', label: 'Utility'    },
  total:    { bg: '#FFE500', fg: '#1A1A1A', label: 'Total QR'   },
} as const;

/** Fallback for unknown types. */
export const FALLBACK_TYPE_META: TypeMeta = {
  bg: '#E5E7EB', fg: '#1A1A1A', label: 'Unknown', group: 'utility',
};
