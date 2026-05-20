/**
 * Studio identity colors — one per pipeline stage.
 * These are intentionally distinct from every deck/card color in the system
 * (see cards/deckTypeMeta.ts for the deck palette).
 */
export const STUDIO_COLORS = {
  concept: '#FF6B35', // deep orange  — Concept Studio
  image:   '#22D3EE', // electric cyan — Image Studio
  card:    '#BEF264', // electric lime — Card Studio
  fusion:  '#E879F9', // fuchsia       — Deck Fusion
} as const;

export type StudioKey = keyof typeof STUDIO_COLORS;
