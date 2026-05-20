import type {
  DeckConfig, DesignStructure, Group, Subgroup,
  ImageScenario, MergedDeck, MergedQRCode, QRCodeEntry, FusionGDesignData,
  DeckConstraints, DeckGroupConstraint,
} from '../types';

// ── Image selection (mirrors zip's selectImagePrompt) ─────────────────────────

const selectScenario = (source: Group | Subgroup): ImageScenario | null => {
  if (!source?.imagePrompts?.length) return null;
  const { imagePrompts: prompts, favoriteImagePromptIndex: fav } = source;
  if (fav !== null && fav !== undefined && prompts[fav]) return prompts[fav];
  const withImg = prompts.find(p => p.base64Image?.trim());
  return withImg ?? prompts[0];
};

// ── Mapping tables ────────────────────────────────────────────────────────────
//
// The deck has 4 color tiers (Yellow/Green/Blue/Magenta), each with 7 cards.
// Stars are NOT a tier indicator — they're a rarity within each color tier:
//   • 1 card with 3★ (legendary)
//   • 1 card with 2★ (rare)
//   • 5 cards with 1★ (common)
// Plus the Power-ups group (8 action cards) and Utility group (5 meta cards).

/** Maps the deck's `color` field on each game_card → design group type. */
export const COLOR_TO_GROUP_TYPE: Record<string, string> = {
  yellow:  'Grupo A',
  green:   'Grupo B',
  blue:    'Grupo C',
  magenta: 'Grupo D',
};

/** Maps non-game-card types → their design group type. */
export const SPECIAL_TYPE_TO_GROUP_TYPE: Record<string, string> = {
  power_up:        'Grupo Power-ups',
  promo_video:     'Grupo Extra/Utilitários',
  sponsor:         'Grupo Extra/Utilitários',
  instructions:    'Grupo Extra/Utilitários',
  game_activator:  'Grupo Extra/Utilitários',
};

/** Dropdown options for assigning a group's deck role. */
export const GROUP_TYPE_OPTIONS = [
  { value: '',                        label: '— Unassigned —' },
  { value: 'Grupo A',                 label: 'Yellow Tier'    },
  { value: 'Grupo B',                 label: 'Green Tier'     },
  { value: 'Grupo C',                 label: 'Blue Tier'      },
  { value: 'Grupo D',                 label: 'Magenta Tier'   },
  { value: 'Grupo Power-ups',         label: 'Power-ups'      },
  { value: 'Grupo Extra/Utilitários', label: 'Utility'        },
];

// ── Star → subgroup-index mapping ────────────────────────────────────────────
//
// Within a single color tier, the 7 cards have a fixed rarity pattern.
// We map star count to the subgroup position so the most iconic concept
// (subgroup[0]) goes to the legendary card, etc.

/** Returns the subgroup index for a game_card given its star count.
 *  Pass a counter callback so multiple 1★ cards in the same tier get
 *  sequential indices (2, 3, 4, 5, 6). */
const subgroupIndexForGameCard = (
  stars: number,
  oneStarCounter: () => number,
): number | null => {
  if (stars === 3) return 0; // legendary → first subgroup (most iconic)
  if (stars === 2) return 1; // rare      → second subgroup
  if (stars === 1) return 2 + oneStarCounter(); // commons → subgroups[2..6]
  return null;
};

// ── Deck constraints (kept for completeness; not used in current UI) ─────────

/** Analyse a loaded DeckConfig and return the group/subgroup counts.
 *  Useful for validating a design matches a deck. */
export function computeDeckConstraints(deckConfig: DeckConfig, deckFile: string): DeckConstraints {
  const counts: Record<string, number> = {};

  for (const qr of deckConfig.qrcodes) {
    if (qr.type === 'game_card') {
      const gt = qr.color ? COLOR_TO_GROUP_TYPE[qr.color] : undefined;
      if (gt) counts[gt] = (counts[gt] ?? 0) + 1;
    } else if (qr.type === 'power_up') {
      counts['Grupo Power-ups'] = (counts['Grupo Power-ups'] ?? 0) + 1;
    } else if (['promo_video', 'sponsor', 'instructions', 'game_activator'].includes(qr.type)) {
      counts['Grupo Extra/Utilitários'] = (counts['Grupo Extra/Utilitários'] ?? 0) + 1;
    }
    // game_card_back → uses group cover imagePrompt, not a subgroup
  }

  const ORDER = [
    'Grupo A', 'Grupo B', 'Grupo C', 'Grupo D',
    'Grupo Power-ups', 'Grupo Extra/Utilitários',
  ];

  const groups: DeckGroupConstraint[] = ORDER
    .filter(gt => (counts[gt] ?? 0) > 0)
    .map(gt => {
      const count = counts[gt]!;
      const option = GROUP_TYPE_OPTIONS.find(o => o.value === gt);
      return {
        groupType: gt,
        subgroupCount: count,
        label: `${option?.label ?? gt} — ${count} card${count !== 1 ? 's' : ''}`,
      };
    });

  return { deckFile, deckName: deckConfig.deck_details.deck_name, groups };
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export const mergeDecks = (
  deckConfig: DeckConfig,
  structure: DesignStructure,
): { mergedData: MergedDeck; logOutput: string[] } => {
  const log: string[] = [];

  // Build lookup by groupType (skip unassigned groups)
  const byType = new Map<string, Group>(
    structure.groups
      .filter(g => g.groupType)
      .map(g => [g.groupType!, g]),
  );

  // Counters for sequential subgroup assignment:
  //  • per-color-tier 1★ commons → indices 2..6
  //  • per-group power-ups / utility → indices 0..N
  const counters = new Map<string, number>();
  const next = (key: string): number => {
    const c = counters.get(key) ?? 0;
    counters.set(key, c + 1);
    return c;
  };

  const qrcodes: MergedQRCode[] = deckConfig.qrcodes.map((qr: QRCodeEntry) => {
    let gdesign_data: FusionGDesignData | undefined;
    let source: Group | Subgroup | undefined;

    try {
      if (qr.type === 'game_card') {
        const gt = qr.color ? COLOR_TO_GROUP_TYPE[qr.color] : undefined;
        if (!gt) {
          log.push(`No color mapping for card ${qr.id} (color: ${qr.color ?? 'none'})`);
        } else {
          const g = byType.get(gt);
          const i = subgroupIndexForGameCard(qr.stars, () => next(`${gt}_common`));
          if (i === null) {
            log.push(`Unexpected star count for card ${qr.id} in ${gt}: ${qr.stars}`);
          } else {
            source = g?.subgroups[i];
            if (!source) log.push(`Warning: No subgroup[${i}] for card ${qr.id} (${qr.color}, ${qr.stars}★) in ${gt}`);
          }
        }
      } else if (qr.type === 'game_card_back') {
        // The back of a tier uses the tier group's cover image, not a subgroup
        const gt = qr.color ? COLOR_TO_GROUP_TYPE[qr.color] : undefined;
        if (gt) {
          source = byType.get(gt);
          if (!source) log.push(`Warning: No main group for back card ${qr.id} in ${gt}`);
        } else {
          log.push(`No color mapping for back card ${qr.id} (color: ${qr.color ?? 'none'})`);
        }
      } else {
        const gt = SPECIAL_TYPE_TO_GROUP_TYPE[qr.type];
        if (gt) {
          const g = byType.get(gt);
          const i = next(gt);
          source = g?.subgroups[i];
          if (!source) log.push(`Warning: No subgroup[${i}] for special card ${qr.id} in ${gt}`);
        } else {
          log.push(`No mapping for card ${qr.id} (type: ${qr.type})`);
        }
      }

      if (source) {
        const scenario = selectScenario(source);
        if (scenario) {
          gdesign_data = {
            title: source.title,
            description: source.description,
            mood: source.mood,
            visual_config: scenario,
          };
        } else {
          log.push(`Warning: No image prompt for card ${qr.id}`);
        }
      }
    } catch (e: any) {
      log.push(`ERROR processing card ${qr.id}: ${e.message}`);
    }

    return { ...qr, gdesign_data };
  });

  // ── Synthesize game_card_back entries for groups missing them ────────────
  // Some deck configs are generated without explicit back cards. For every
  // group that has front cards in the deck, inject a synthetic back using
  // the group's cover image (favoriteImagePromptIndex).
  //
  // We use a stable synthetic `color` key so the preview modal can look up
  // the back by a consistent value:
  //   game_card tiers  → color = 'yellow' / 'green' / 'blue' / 'magenta'
  //   power_up cards   → color = '__powerup'
  //   utility cards    → color = '__utility'

  const existingBackColors = new Set(
    qrcodes
      .filter(q => q.type === 'game_card_back')
      .map(q => (q.color ?? q.card_color ?? '').toLowerCase())
  );

  // ── Color tiers ──────────────────────────────────────────────────────────
  for (const [color, groupType] of Object.entries(COLOR_TO_GROUP_TYPE)) {
    if (existingBackColors.has(color)) continue;
    const hasFronts = qrcodes.some(
      q => q.type === 'game_card' && (q.color ?? q.card_color ?? '').toLowerCase() === color
    );
    if (!hasFronts) continue;
    const group = byType.get(groupType);
    if (!group) continue;
    const scenario = selectScenario(group);
    if (!scenario) { log.push(`Warning: No cover image for synthetic back of ${color}`); continue; }
    qrcodes.push({
      id: `__synthetic_back_${color}`,
      pathId: '', key: '', type: 'game_card_back', stars: 0, color,
      gdesign_data: { title: group.title, description: group.description, mood: group.mood, visual_config: scenario },
    });
    log.push(`Synthesized game_card_back for ${color} tier from group "${group.title}"`);
  }

  // ── Power-ups ─────────────────────────────────────────────────────────────
  if (!existingBackColors.has('__powerup') && qrcodes.some(q => q.type === 'power_up')) {
    const group = byType.get('Grupo Power-ups');
    const scenario = group ? selectScenario(group) : null;
    if (group && scenario) {
      qrcodes.push({
        id: '__synthetic_back___powerup',
        pathId: '', key: '', type: 'game_card_back', stars: 0, color: '__powerup',
        gdesign_data: { title: group.title, description: group.description, mood: group.mood, visual_config: scenario },
      });
      log.push(`Synthesized game_card_back for power-ups from group "${group.title}"`);
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  const utilityTypes = new Set(['promo_video', 'sponsor', 'instructions', 'game_activator']);
  if (!existingBackColors.has('__utility') && qrcodes.some(q => utilityTypes.has(q.type))) {
    const group = byType.get('Grupo Extra/Utilitários');
    const scenario = group ? selectScenario(group) : null;
    if (group && scenario) {
      qrcodes.push({
        id: '__synthetic_back___utility',
        pathId: '', key: '', type: 'game_card_back', stars: 0, color: '__utility',
        gdesign_data: { title: group.title, description: group.description, mood: group.mood, visual_config: scenario },
      });
      log.push(`Synthesized game_card_back for utility from group "${group.title}"`);
    }
  }

  log.unshift(`Processed ${qrcodes.length} cards.`);

  return {
    mergedData: {
      deck_details: {
        ...deckConfig.deck_details,
        merge_version: `merged_v1.0_${new Date().toISOString()}`,
      },
      qrcodes,
    },
    logOutput: log,
  };
};
