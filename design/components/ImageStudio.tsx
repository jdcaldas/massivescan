import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { DesignStructure, RecycleBinEntry } from '../types';
import { generateImage, IMAGE_STYLES, IMAGE_MODELS, ART_FORMATS, CUSTOM_STYLE_ID, type ArtFormatId } from '../services/imageGenService';
import {
  SparklesIcon, StarIcon, ChevronDownIcon, ChevronUpIcon,
  SunIcon, MoonIcon, SettingsIcon, RefreshIcon, GridIcon, ListIcon, ChartBarIcon, PencilIcon, TrashIcon, DownloadIcon,
} from './icons';
import { recordUsage } from '../services/usageService';
import UsageDashboard from './UsageDashboard';
import RecycleBinModal from './RecycleBinModal';
import {
  loadBin, addToBin, removeFromBin, emptyBin, urgencyFor,
  BIN_CAP, BIN_WARN_AT, BIN_URGENT_AT,
} from '../services/recycleBinService';

// Fixed deck tier sequence — must match GroupCard.tsx and deckTypeMeta.ts
const CARD_COLORS = [
  '#FDE68A', // 01: Yellow tier
  '#86EFAC', // 02: Green tier
  '#7DD3FC', // 03: Blue tier
  '#F0ABFC', // 04: Magenta tier
  '#C4B5FD', // 05: Power-ups (violet)
  '#4B5563', // 06: Utility (charcoal)
  '#FF4F6D', // 07: Activators (brand pink)
];
const CARD_COLOR_NAMES = ['Yellow', 'Green', 'Blue', 'Magenta', 'Power-ups', 'Utility', 'Activators'];

/** Maps groupType → short technical label shown in brackets next to the creative title. */
const GROUP_TYPE_LABEL: Record<string, string> = {
  'Grupo A':                 'Group 1 · Yellow',
  'Grupo B':                 'Group 2 · Green',
  'Grupo C':                 'Group 3 · Blue',
  'Grupo D':                 'Group 4 · Magenta',
  'Grupo Power-ups':         'Power-ups',
  'Grupo Extra/Utilitários': 'Utility',
  'Grupo Activators':        'Activators',
};

type GenState = 'idle' | 'generating' | 'error';

interface ImageStudioProps {
  designStructure: DesignStructure;
  theme: string;
  /** World-level narrative context. Injected as `CONTEXT: …` into every
   *  image prompt so the model knows the era / place / overall vibe even
   *  when the per-card description is short. */
  themeDescription?: string;
  defaultImageModel?: string;
  onBack: () => void;
  onGoToCards?: () => void;
  onSave: (updated: DesignStructure) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  onOpenSettings: () => void;
  projectName?: string;
  projectId: string;
  activeWorldId?: string;
}

// ── Image slot component ─────────────────────────────────────────────────────

interface ImageSlotProps {
  base64: string;
  prompt: string;
  genState: GenState;
  error?: string;
  isFavorite: boolean;
  onGenerate: (extra?: string) => void;
  onFavorite: () => void;
  onZoom?: () => void;
  size?: 'normal' | 'small';
  aspectRatio?: string; // e.g. '1/1', '3/4', '16/9'
  /** Send the current image to the recycle bin and clear this slot. */
  onDiscard?: () => void;
  /** Open the recycle bin in "adopt for this slot" mode. */
  onPickFromBin?: () => void;
}

// ── No-pick placeholder ─────────────────────────────────────────────────────
const NoPick: React.FC<{ width: number; label?: string; color?: string; aspectRatio?: string }> = ({ width, label, color = '#fbbf24', aspectRatio = '1/1' }) => (
  <div
    className="overflow-hidden flex-shrink-0 border-2 border-dashed flex flex-col"
    style={{ width, borderRadius: 1, borderColor: `${color}80` }}
  >
    <div
      className="w-full bg-brand-bg/50 flex flex-col items-center justify-center gap-1.5"
      style={{ aspectRatio }}
    >
      <StarIcon className="w-4 h-4" style={{ color: `${color}60` }} />
      <span className="text-[7px] font-black uppercase tracking-widest text-brand-subtle/40 text-center px-2 leading-tight">
        no pick yet
      </span>
    </div>
    <div className="px-1.5 py-1">
      <p className="text-[8px] font-black text-brand-subtle/30 uppercase tracking-widest">{label ?? '—'}</p>
    </div>
  </div>
);

const ImageSlot: React.FC<ImageSlotProps> = ({
  base64, prompt, genState, error, isFavorite, onGenerate, onFavorite, onZoom, size = 'normal', aspectRatio = '1/1',
  onDiscard, onPickFromBin,
}) => {
  const isSmall = size === 'small';
  const [regenOpen, setRegenOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  return (
    <div
      className={`neo-card overflow-hidden flex flex-col ${isFavorite ? '' : ''}`}
      style={{ boxShadow: isFavorite ? `3px 3px 0 0 #fbbf24` : '3px 3px 0 0 #000', borderColor: isFavorite ? '#fbbf24' : undefined }}
    >
      {/* Image area */}
      <div className="relative bg-brand-bg overflow-hidden flex-shrink-0" style={{ aspectRatio }}>
        {base64 ? (
          <img
            src={`data:image/jpeg;base64,${base64}`}
            alt=""
            className={`w-full h-full object-cover ${onZoom ? 'cursor-zoom-in' : ''}`}
            onClick={onZoom}
          />
        ) : genState === 'generating' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-bg">
            <div className={`${isSmall ? 'w-6 h-6' : 'w-8 h-8'} border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Generating…</span>
          </div>
        ) : genState === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center bg-brand-bg">
            <span className={`${isSmall ? 'text-[9px]' : 'text-xs'} font-bold text-red-500`}>Error</span>
            <span className="text-[9px] text-brand-subtle line-clamp-3">{error}</span>
            <button
              onClick={onGenerate}
              className="neo-btn px-2 py-1 text-[9px] font-black bg-brand-text text-brand-surface mt-1"
              style={{ boxShadow: '1px 1px 0 0 #000' }}
            >Retry</button>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
            <button
              onClick={onGenerate}
              className={`neo-btn flex items-center gap-1.5 ${isSmall ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'} font-black bg-brand-text text-brand-surface`}
            >
              <SparklesIcon className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
              {isSmall ? 'Gen' : 'Generate'}
            </button>
          </div>
        )}
        {isFavorite && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 border-2 border-black text-[8px] font-black uppercase tracking-widest text-black" style={{ backgroundColor: '#fbbf24', borderRadius: 1 }}>
            <StarIcon isFilled className="w-2.5 h-2.5" />
            Hero
          </div>
        )}
      </div>

      {/* Footer — prompt */}
      <div className={`${isSmall ? 'p-1.5' : 'p-2.5'} flex-1 flex flex-col`}>
        <button
          onClick={() => setPromptExpanded(v => !v)}
          className={`text-left ${isSmall ? 'text-[8px]' : 'text-[9px]'} text-brand-subtle leading-relaxed flex-1 w-full hover:text-brand-text transition-colors`}
          title={promptExpanded ? 'Collapse prompt' : 'Expand prompt'}
        >
          <span className={promptExpanded ? undefined : 'line-clamp-2'}>{prompt}</span>
          {!promptExpanded && (
            <span className="ml-1 text-[8px] font-black uppercase tracking-widest text-brand-subtle/40 hover:text-brand-subtle">▾</span>
          )}
          {promptExpanded && (
            <span className="block text-[8px] font-black uppercase tracking-widest text-brand-subtle/40 mt-1">▴ collapse</span>
          )}
        </button>
      </div>
      {/* Action bar — full width, fills amber when hero */}
      <div
        className={`flex items-center justify-between ${isSmall ? 'px-1.5 py-1' : 'px-2.5 py-1.5'}`}
        style={isFavorite ? { backgroundColor: '#fbbf24' } : {}}
      >
        <button
          onClick={onFavorite}
          disabled={!base64}
          className={`flex items-center gap-1 ${isSmall ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isFavorite ? 'text-black' : 'text-brand-subtle hover:text-amber-400'}`}
          title={isFavorite ? 'Remove hero' : 'Set as hero reference for subgroups'}
        >
          <StarIcon isFilled={isFavorite} className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          {isFavorite ? 'Hero' : 'Star'}
        </button>
        <div className="flex items-center gap-1.5">
          {/* Pick from bin — always available if callback wired */}
          {onPickFromBin && (
            <button
              onClick={onPickFromBin}
              onMouseDown={e => e.stopPropagation()}
              className={`p-0.5 transition-colors text-brand-subtle hover:text-emerald-500`}
              title="Pick from recycle bin"
            >
              {/* Stack of photos icon — "pick from collection" */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`}>
                <rect x="8" y="3" width="13" height="13" rx="1.5" />
                <rect x="3" y="8" width="13" height="13" rx="1.5" fill="currentColor" fillOpacity="0.15" />
              </svg>
            </button>
          )}
          {/* Discard — only when there's an image to send away */}
          {base64 && onDiscard && (
            <button
              onClick={onDiscard}
              onMouseDown={e => e.stopPropagation()}
              disabled={genState === 'generating'}
              className={`p-0.5 transition-colors disabled:opacity-30 text-brand-subtle hover:text-red-500`}
              title="Discard image (send to recycle bin)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.45.061.894.124m-.894-.123L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562q.448-.064.894-.124m12.106-.438a48.108 48.108 0 0 1-3.478-.397m0 0V3.5A1.5 1.5 0 0 0 14.25 2h-4.5A1.5 1.5 0 0 0 8.25 3.5v1.94m5.628 0a48.667 48.667 0 0 0-5.628 0" />
              </svg>
            </button>
          )}
          {base64 && (
            <div className="relative">
              <button
                onClick={() => setRegenOpen(v => !v)}
                onMouseDown={e => e.stopPropagation()}
                disabled={genState === 'generating'}
                className={`p-0.5 transition-colors disabled:opacity-30 ${regenOpen ? 'text-brand-text' : 'text-brand-subtle hover:text-brand-text'}`}
                title="Regenerate options"
              >
                <RefreshIcon className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
              </button>
              {regenOpen && (
                <RegenMenu
                  onClose={() => setRegenOpen(false)}
                  onSimple={() => { onGenerate(); setRegenOpen(false); }}
                  onWithExtra={(extra) => { onGenerate(extra); setRegenOpen(false); }}
                  isGenerating={genState === 'generating'}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Regen popover menu ───────────────────────────────────────────────────────

interface RegenMenuProps {
  onClose: () => void;
  onSimple: () => void;
  onWithExtra: (extra: string) => void;
  isGenerating: boolean;
}

const RegenMenu: React.FC<RegenMenuProps> = ({ onClose, onSimple, onWithExtra, isGenerating }) => {
  const [mode, setMode] = useState<'menu' | 'extra'>('menu');
  const [extraText, setExtraText] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-1 z-30 bg-brand-surface border-2 border-black dark:border-brand-primary"
      style={{ boxShadow: '3px 3px 0 #000', borderRadius: 1, minWidth: 168 }}
    >
      {mode === 'menu' ? (
        <>
          {/* Quick regen */}
          <button
            onClick={() => { onSimple(); }}
            disabled={isGenerating}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-brand-text hover:bg-brand-bg disabled:opacity-40 border-b border-black/10 dark:border-brand-primary/20 text-left transition-colors"
          >
            <RefreshIcon className="w-3 h-3 flex-shrink-0" />
            Quick regen
          </button>
          {/* Extra prompt */}
          <button
            onClick={() => setMode('extra')}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-brand-text hover:bg-brand-bg border-b border-black/10 dark:border-brand-primary/20 text-left transition-colors"
          >
            <PencilIcon className="w-3 h-3 flex-shrink-0" />
            + Extra prompt
          </button>
          {/* Force no text */}
          <button
            onClick={() => {
              onWithExtra('CRITICAL: absolutely zero text, zero letters, zero numbers, zero words, zero captions, zero labels, no typography of any kind anywhere in the image. If you were going to add any text, replace it with a visual element instead.');
            }}
            disabled={isGenerating}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-brand-text hover:bg-brand-bg disabled:opacity-40 text-left transition-colors"
          >
            <svg viewBox="0 0 12 12" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="6" cy="6" r="5" />
              <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" />
            </svg>
            No text
          </button>
        </>
      ) : (
        /* Extra prompt input mode */
        <div className="p-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <button
              onClick={() => setMode('menu')}
              className="text-[9px] text-brand-subtle hover:text-brand-text font-black transition-colors leading-none"
              title="Back"
            >←</button>
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Extra instructions</span>
          </div>
          <textarea
            value={extraText}
            onChange={e => setExtraText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && extraText.trim()) {
                e.preventDefault();
                onWithExtra(extraText.trim());
              }
              if (e.key === 'Escape') onClose();
            }}
            placeholder="e.g. night scene, close-up, more vibrant…"
            className="neo-input w-full text-[10px] bg-brand-bg text-brand-text px-2 py-1.5 resize-none placeholder:text-brand-subtle/40"
            rows={3}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <button
            onClick={() => { if (extraText.trim()) onWithExtra(extraText.trim()); }}
            disabled={!extraText.trim() || isGenerating}
            className="neo-btn w-full mt-2 py-1.5 text-[10px] font-black bg-brand-text text-brand-surface disabled:opacity-40"
            style={{ boxShadow: '2px 2px 0 0 #000' }}
          >
            Generate ↵
          </button>
        </div>
      )}
    </div>
  );
};

// ── Steps indicator (standalone) ─────────────────────────────────────────────

const StepIndicator: React.FC = () => (
  <div className="hidden md:flex items-center gap-0 mx-auto">
    {[
      { n: 1, label: 'World' },
      { n: 2, label: 'Groups' },
      { n: 3, label: 'Art' },
      { n: 4, label: 'Assets' },
      { n: 5, label: 'Export' },
    ].map(({ n, label }, i) => {
      const active = n === 3;
      const done = n < 3;
      return (
        <React.Fragment key={n}>
          {i > 0 && (
            <div className={`w-6 h-px flex-shrink-0 bg-black/20 dark:bg-brand-primary/30`} />
          )}
          <div className={`flex flex-col items-center gap-0.5 ${active || done ? '' : 'opacity-25'}`}>
            <div
              className={`w-7 h-7 border-2 border-black dark:border-brand-primary flex items-center justify-center font-black text-xs ${
                active ? 'bg-brand-secondary text-brand-text' : 'bg-brand-surface text-brand-text'
              }`}
              style={{ borderRadius: 1 }}
            >
              {n}
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-brand-text leading-none">{label}</span>
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

// ── Main component ───────────────────────────────────────────────────────────

const ImageStudio: React.FC<ImageStudioProps> = ({
  designStructure, theme, themeDescription, defaultImageModel, onBack, onGoToCards, onSave, isDarkMode, setIsDarkMode, onOpenSettings, projectName, projectId, activeWorldId,
}) => {
  const [structure, setStructure] = useState<DesignStructure>(() =>
    JSON.parse(JSON.stringify(designStructure))
  );
  // Selected art style — initialized from the world's saved choice if valid,
  // else falls back to Low Poly (first preset). Persisted on change.
  const [selectedStyle, setSelectedStyle] = useState<string>(() => {
    const saved = designStructure.imageStyle;
    return saved && IMAGE_STYLES.some(s => s.id === saved) ? saved : IMAGE_STYLES[0].id;
  });
  // Custom art-style text — persisted on the world's DesignStructure
  const [customStyleText, setCustomStyleText] = useState<string>(designStructure.customImageStyle ?? '');
  // Tier palettes (Phase 1 #3) — opt-in, editable per tier
  const TIER_PALETTE_DEFAULTS = {
    yellow:  'gold, amber, honey, warm cream',
    green:   'forest, emerald, olive, moss',
    blue:    'navy, cerulean, slate, ice',
    magenta: 'crimson, plum, burgundy, rose',
  } as const;
  const [tierPalettesEnabled, setTierPalettesEnabled] = useState<boolean>(
    designStructure.tierPalettes?.enabled ?? false
  );
  const [tierPaletteText, setTierPaletteText] = useState<Record<'yellow'|'green'|'blue'|'magenta', string>>({
    yellow:  designStructure.tierPalettes?.yellow  ?? TIER_PALETTE_DEFAULTS.yellow,
    green:   designStructure.tierPalettes?.green   ?? TIER_PALETTE_DEFAULTS.green,
    blue:    designStructure.tierPalettes?.blue    ?? TIER_PALETTE_DEFAULTS.blue,
    magenta: designStructure.tierPalettes?.magenta ?? TIER_PALETTE_DEFAULTS.magenta,
  });
  // Negative prompt (Phase 1 #6) — opt-in, things to AVOID in every image
  const [negativePromptEnabled, setNegativePromptEnabled] = useState<boolean>(
    !!designStructure.negativePrompt && designStructure.negativePrompt.trim().length > 0
  );
  const [negativePromptText, setNegativePromptText] = useState<string>(
    designStructure.negativePrompt ?? ''
  );
  // Consistency panel collapsed by default — discoverable but unobtrusive
  const [consistencyOpen, setConsistencyOpen] = useState<boolean>(false);

  // Format — saved per world; falls back to portrait if missing.
  const [selectedFormat, setSelectedFormat] = useState<ArtFormatId>(() => {
    const saved = designStructure.imageFormat as ArtFormatId | undefined;
    return saved && ART_FORMATS.some(f => f.id === saved) ? saved : '3:4';
  });
  // Model — world's saved choice first; then global default from settings; then first valid model.
  const [selectedModel, setSelectedModel] = useState(() => {
    const worldSaved = designStructure.imageModel;
    if (worldSaved && IMAGE_MODELS.some(m => m.id === worldSaved)) return worldSaved;
    const isDefaultValid = IMAGE_MODELS.some(m => m.id === defaultImageModel);
    return isDefaultValid ? (defaultImageModel ?? IMAGE_MODELS[0].id) : IMAGE_MODELS[0].id;
  });
  const [viewMode, setViewMode] = useState<'accordion' | 'grid'>('accordion');
  const [gridZoom, setGridZoom] = useState(180); // card width in px (250% default)
  const [genStates, setGenStates] = useState<Record<string, GenState>>({});
  const [genErrors, setGenErrors] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true });
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, boolean>>({});
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; label: string; colorHex?: string } | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [gridRegenKey, setGridRegenKey] = useState<string | null>(null);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const structureRef = useRef(structure);

  useEffect(() => { structureRef.current = structure; }, [structure]);

  // ── Recycle bin state ─────────────────────────────────────────────────────
  const [binEntries, setBinEntries] = useState<RecycleBinEntry[]>([]);
  const [isBinOpen, setIsBinOpen] = useState(false);
  // When set, the bin is opened in "adopt" mode — clicking an entry replaces
  // the image at the target slot. Cleared after adoption or on close.
  const [binAdoptTarget, setBinAdoptTarget] = useState<
    | { kind: 'group'; gi: number; pi: number; label: string }
    | { kind: 'subgroup'; gi: number; si: number; pi: number; label: string }
    | null
  >(null);

  // Load bin once on mount
  useEffect(() => {
    let active = true;
    loadBin(projectId).then(entries => { if (active) setBinEntries(entries); });
    return () => { active = false; };
  }, [projectId]);

  // Helper: capture the previous image (if present) into the bin, fire-and-forget.
  const sendToBin = useCallback(async (
    prevBase64: string | undefined,
    prompt: string,
    sourceGroupTitle: string,
    sourceSubgroupTitle: string | undefined,
    reason: RecycleBinEntry['reason'],
  ) => {
    if (!prevBase64) return;
    const next = await addToBin(projectId, {
      base64Image: prevBase64,
      prompt,
      style: selectedStyle,
      format: selectedFormat,
      sourceGroupTitle,
      sourceSubgroupTitle,
      sourceWorldId: activeWorldId,
      reason,
    });
    setBinEntries(next);
  }, [projectId, selectedStyle, selectedFormat, activeWorldId]);

  const generatingCount = Object.values(genStates).filter(s => s === 'generating').length;
  const isAnyGenerating = generatingCount > 0;
  const errorCount = Object.keys(genErrors).length;

  const totalGroupDone = structure.groups.reduce((n, g) => n + g.imagePrompts.filter(p => p.base64Image).length, 0);
  const totalGroupSlots = structure.groups.reduce((n, g) => n + g.imagePrompts.length, 0);

  // ── Core generate helper ─────────────────────────────────────────────────

  const doGenerate = useCallback(async (
    key: string,
    prompt: string,
    applyResult: (base64: string, prev: DesignStructure) => DesignStructure,
  ) => {
    setGenStates(prev => ({ ...prev, [key]: 'generating' }));
    setGenErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

    try {
      const base64 = await generateImage(
        prompt, selectedStyle, selectedModel, selectedFormat, abortRef.current?.signal, customStyleText,
      );
      // Apply to latest structure (via ref to avoid stale closure)
      const updated = applyResult(base64, structureRef.current);
      structureRef.current = updated;
      setStructure(updated);
      onSave(updated);
      recordUsage(selectedModel, 0, 0); // image gen — no token counts from API
      setGenStates(prev => ({ ...prev, [key]: 'idle' }));
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') {
        setGenStates(prev => ({ ...prev, [key]: 'idle' }));
        return;
      }
      setGenStates(prev => ({ ...prev, [key]: 'error' }));
      setGenErrors(prev => ({ ...prev, [key]: err?.message ?? String(e) }));
    }
  }, [selectedStyle, selectedModel, selectedFormat, customStyleText, onSave]);

  // Persist the custom style text onto the world structure (debounced via blur/commit)
  const commitCustomStyle = useCallback((text: string) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.customImageStyle = text;
    structureRef.current = s;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  // Persist tier palettes (Phase 1 #3) — saves both the enabled flag and the
  // 4 per-tier text fields onto DesignStructure.tierPalettes
  const commitTierPalettes = useCallback((next: {
    enabled: boolean;
    yellow: string; green: string; blue: string; magenta: string;
  }) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.tierPalettes = {
      enabled: next.enabled,
      yellow:  next.yellow,
      green:   next.green,
      blue:    next.blue,
      magenta: next.magenta,
    };
    structureRef.current = s;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  // Persist negative prompt (Phase 1 #6)
  const commitNegativePrompt = useCallback((text: string) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.negativePrompt = text;
    structureRef.current = s;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  // ── Persist Image Studio preferences per world ──────────────────────────
  // Style, format and model choices live on DesignStructure so reopening the
  // studio restores the user's last picks instead of resetting to defaults.

  const handleStyleChange = useCallback((styleId: string) => {
    setSelectedStyle(styleId);
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.imageStyle = styleId;
    structureRef.current = s;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  const handleFormatChange = useCallback((formatId: ArtFormatId) => {
    setSelectedFormat(formatId);
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.imageFormat = formatId;
    structureRef.current = s;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.imageModel = modelId;
    structureRef.current = s;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  // ── Consistency blocks (Phase 1 of CONSISTENCY_ROADMAP.md) ───────────────
  //
  // Assembles 3 optional fragments injected around every image prompt:
  //   • CONTEXT block — themeDescription prefix (#1, always on)
  //   • Dominant palette — per-color-tier suffix (#3, opt-in, color tiers only)
  //   • Avoid block — user's negative prompt (#6, opt-in)
  //
  // Empty fragments collapse to no-op so the prompt stays clean for
  // collections that don't use these levers.
  const TIER_KEYS = ['yellow', 'green', 'blue', 'magenta'] as const;
  type TierKey = typeof TIER_KEYS[number];

  const assembleConsistencyBlocks = useCallback((gi: number) => {
    const contextBlock = themeDescription?.trim()
      ? `CONTEXT: ${themeDescription.trim()}.\n`
      : '';

    // Tier palette only for the 4 color tiers (gi 0..3), never for
    // power-ups / utility / activators.
    let paletteBlock = '';
    const tp = structureRef.current.tierPalettes;
    if (tp?.enabled && gi >= 0 && gi <= 3) {
      const tierName: TierKey = TIER_KEYS[gi];
      const palText = tp[tierName]?.trim();
      if (palText) paletteBlock = ` Dominant palette: ${palText}.`;
    }

    const np = structureRef.current.negativePrompt?.trim();
    const avoidBlock = np ? ` Avoid: ${np}.` : '';

    return { contextBlock, paletteBlock, avoidBlock };
  }, [themeDescription]);

  // ── Group image generation ───────────────────────────────────────────────

  const generateGroupImage = useCallback((gi: number, pi: number, extraPrompt?: string) => {
    const key = `g${gi}_${pi}`;
    const group = structureRef.current.groups[gi];
    const scenario = group.imagePrompts[pi];
    if (!scenario) return Promise.resolve();
    const { contextBlock, paletteBlock, avoidBlock } = assembleConsistencyBlocks(gi);
    const base = `${contextBlock}${group.title}. ${group.description}. Art direction: ${group.mood}. Scene: ${scenario.prompt}.${paletteBlock}${avoidBlock}`;
    const prompt = extraPrompt ? `${base} Additional directions: ${extraPrompt}` : base;
    // Capture previous image so we can send it to the bin once generation succeeds
    const prevBase64 = scenario.base64Image;
    return doGenerate(key, prompt, (base64, prev) => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      s.groups[gi].imagePrompts[pi].base64Image = base64;
      // Send the previous image (if any) to the bin — fire and forget
      void sendToBin(prevBase64, scenario.prompt, group.title, undefined, 'regenerate');
      return s;
    });
  }, [doGenerate, sendToBin, assembleConsistencyBlocks]);

  // ── Subgroup image generation ────────────────────────────────────────────

  const generateSubgroupImage = useCallback((gi: number, si: number, pi: number, extraPrompt?: string) => {
    const key = `g${gi}_sg${si}_${pi}`;
    const group = structureRef.current.groups[gi];
    const favIdx = group.favoriteImagePromptIndex ?? 0;
    const favPrompt = group.imagePrompts[favIdx]?.prompt ?? '';
    const sg = group.subgroups[si];
    const scenario = sg.imagePrompts[pi];
    if (!scenario) return Promise.resolve();
    const { contextBlock, paletteBlock, avoidBlock } = assembleConsistencyBlocks(gi);
    const base = `${contextBlock}Setting: ${group.title} universe (reference: ${favPrompt}). Subgroup: ${sg.title}. ${sg.description}. Art direction: ${sg.mood}. Scene: ${scenario.prompt}.${paletteBlock}${avoidBlock}`;
    const prompt = extraPrompt ? `${base} Additional directions: ${extraPrompt}` : base;
    const prevBase64 = scenario.base64Image;
    return doGenerate(key, prompt, (base64, prev) => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      s.groups[gi].subgroups[si].imagePrompts[pi].base64Image = base64;
      void sendToBin(prevBase64, scenario.prompt, group.title, sg.title, 'regenerate');
      return s;
    });
  }, [doGenerate, sendToBin, assembleConsistencyBlocks]);

  // ── Batch helpers ────────────────────────────────────────────────────────

  const generateAllGroups = useCallback(async () => {
    abortRef.current = new AbortController();
    const jobs: Promise<void>[] = [];
    for (let gi = 0; gi < structureRef.current.groups.length; gi++) {
      for (let pi = 0; pi < structureRef.current.groups[gi].imagePrompts.length; pi++) {
        jobs.push(generateGroupImage(gi, pi));
      }
    }
    await Promise.allSettled(jobs);
  }, [generateGroupImage]);

  const generateGroupSubgroups = useCallback(async (gi: number) => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    const group = structureRef.current.groups[gi];
    const jobs: Promise<void>[] = [];
    for (let si = 0; si < group.subgroups.length; si++) {
      for (let pi = 0; pi < group.subgroups[si].imagePrompts.length; pi++) {
        jobs.push(generateSubgroupImage(gi, si, pi));
      }
    }
    await Promise.allSettled(jobs);
  }, [generateSubgroupImage]);

  const generateAllSubgroups = useCallback(async () => {
    abortRef.current = new AbortController();
    const jobs: Promise<void>[] = [];
    for (let gi = 0; gi < structureRef.current.groups.length; gi++) {
      const g = structureRef.current.groups[gi];
      if (g.favoriteImagePromptIndex === null || g.favoriteImagePromptIndex === undefined) continue;
      for (let si = 0; si < g.subgroups.length; si++) {
        for (let pi = 0; pi < g.subgroups[si].imagePrompts.length; pi++) {
          jobs.push(generateSubgroupImage(gi, si, pi));
        }
      }
    }
    await Promise.allSettled(jobs);
  }, [generateSubgroupImage]);

  const handleCancel = useCallback(() => { abortRef.current?.abort(); }, []);

  // ── Favorite toggles ─────────────────────────────────────────────────────

  const toggleGroupFavorite = useCallback((gi: number, pi: number) => {
    setStructure(prev => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      s.groups[gi].favoriteImagePromptIndex = s.groups[gi].favoriteImagePromptIndex === pi ? null : pi;
      structureRef.current = s;
      onSave(s);
      return s;
    });
  }, [onSave]);

  const toggleSubFavorite = useCallback((gi: number, si: number, pi: number) => {
    setStructure(prev => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      s.groups[gi].subgroups[si].favoriteImagePromptIndex =
        s.groups[gi].subgroups[si].favoriteImagePromptIndex === pi ? null : pi;
      structureRef.current = s;
      onSave(s);
      return s;
    });
  }, [onSave]);

  // ── Recycle bin handlers ──────────────────────────────────────────────────

  const handleBinAdopt = useCallback(async (entry: RecycleBinEntry) => {
    if (!binAdoptTarget) {
      // Defensive — shouldn't happen because Adopt button is only rendered in adopt mode
      setIsBinOpen(false);
      return;
    }
    // 1) Write the entry's base64 into the target slot
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    if (binAdoptTarget.kind === 'group') {
      const slot = s.groups[binAdoptTarget.gi]?.imagePrompts?.[binAdoptTarget.pi];
      if (slot) slot.base64Image = entry.base64Image;
    } else {
      const slot = s.groups[binAdoptTarget.gi]?.subgroups?.[binAdoptTarget.si]?.imagePrompts?.[binAdoptTarget.pi];
      if (slot) slot.base64Image = entry.base64Image;
    }
    structureRef.current = s;
    setStructure(s);
    onSave(s);

    // 2) Remove from bin (adopt = move)
    const nextBin = await removeFromBin(projectId, entry.id);
    setBinEntries(nextBin);

    // 3) Close modal
    setIsBinOpen(false);
    setBinAdoptTarget(null);
  }, [binAdoptTarget, onSave, projectId]);

  const handleBinDeleteOne = useCallback(async (entryId: string) => {
    const next = await removeFromBin(projectId, entryId);
    setBinEntries(next);
  }, [projectId]);

  const handleBinEmptyAll = useCallback(async () => {
    const next = await emptyBin(projectId);
    setBinEntries(next);
  }, [projectId]);

  // ── Slot-level actions: explicit discard + pick-from-bin ──────────────────

  const handleDiscardGroupImage = useCallback(async (gi: number, pi: number) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    const slot = s.groups[gi]?.imagePrompts?.[pi];
    if (!slot?.base64Image) return; // nothing to discard
    const groupTitle = s.groups[gi].title;
    const oldBase64 = slot.base64Image;
    const oldPrompt = slot.prompt;
    slot.base64Image = '';
    structureRef.current = s;
    setStructure(s);
    onSave(s);
    void sendToBin(oldBase64, oldPrompt, groupTitle, undefined, 'manual');
  }, [onSave, sendToBin]);

  const handleDiscardSubgroupImage = useCallback(async (gi: number, si: number, pi: number) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    const slot = s.groups[gi]?.subgroups?.[si]?.imagePrompts?.[pi];
    if (!slot?.base64Image) return;
    const groupTitle = s.groups[gi].title;
    const subgroupTitle = s.groups[gi].subgroups[si].title;
    const oldBase64 = slot.base64Image;
    const oldPrompt = slot.prompt;
    slot.base64Image = '';
    structureRef.current = s;
    setStructure(s);
    onSave(s);
    void sendToBin(oldBase64, oldPrompt, groupTitle, subgroupTitle, 'manual');
  }, [onSave, sendToBin]);

  const openBinForGroupSlot = useCallback((gi: number, pi: number) => {
    const group = structureRef.current.groups[gi];
    setBinAdoptTarget({
      kind: 'group',
      gi,
      pi,
      label: `${group.title} · Cover ${pi + 1}`,
    });
    setIsBinOpen(true);
  }, []);

  const openBinForSubgroupSlot = useCallback((gi: number, si: number, pi: number) => {
    const group = structureRef.current.groups[gi];
    const sg = group.subgroups[si];
    setBinAdoptTarget({
      kind: 'subgroup',
      gi, si, pi,
      label: `${group.title} / ${sg.title} · ${pi + 1}`,
    });
    setIsBinOpen(true);
  }, []);

  // ── Bulk download ─────────────────────────────────────────────────────────
  // Downloads every image with content as individual JPEG files. Naming:
  //   01-yellow-cover-1.jpg  (group cover)
  //   01-yellow-sub-01-virgin-queens-ascent-1.jpg  (subgroup front)
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  const downloadAllImages = useCallback(async () => {
    const slug = (s: string) =>
      (s || 'untitled').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

    // Collect every image with content from the current structure
    const items: { base64: string; filename: string }[] = [];
    const s = structureRef.current;
    s.groups.forEach((group, gi) => {
      const gIdx = String(gi + 1).padStart(2, '0');
      const gSlug = slug(group.title);
      // Covers
      group.imagePrompts.forEach((p, pi) => {
        if (p.base64Image) items.push({
          base64: p.base64Image,
          filename: `${gIdx}-${gSlug}-cover-${pi + 1}.jpg`,
        });
      });
      // Subgroup fronts
      group.subgroups.forEach((sg, si) => {
        const sIdx = String(si + 1).padStart(2, '0');
        const sgSlug = slug(sg.title);
        sg.imagePrompts.forEach((p, pi) => {
          if (p.base64Image) items.push({
            base64: p.base64Image,
            filename: `${gIdx}-${gSlug}-sub-${sIdx}-${sgSlug}-${pi + 1}.jpg`,
          });
        });
      });
    });

    if (items.length === 0) return;
    setDownloadProgress({ done: 0, total: items.length });

    // Trigger downloads sequentially with a small delay so the browser
    // doesn't squash them all together (and so the "allow multiple downloads"
    // prompt fires only once)
    for (let i = 0; i < items.length; i++) {
      const { base64, filename } = items[i];
      const link = document.createElement('a');
      link.href = `data:image/jpeg;base64,${base64}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadProgress({ done: i + 1, total: items.length });
      await new Promise(resolve => setTimeout(resolve, 120));
    }

    // Clear progress after a short delay so the user sees the final count
    setTimeout(() => setDownloadProgress(null), 1500);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">

          {/* Project badge */}
          {projectName && (
            <div
              className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary dark:bg-brand-primary text-brand-text"
              style={{ borderRadius: 1 }}
              title={`Project: ${projectName}`}
            >
              {projectName}
            </div>
          )}

          {/* Divider */}
          <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg flex-shrink-0">|</span>

          {/* Studio identity */}
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-brand-primary leading-none">Image Studio</div>
            <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text truncate max-w-[220px]" title={theme}>{theme}</div>
          </div>

          {/* Right zone — utilities only */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">

            {/* Download all images */}
            {(() => {
              const totalReady =
                structure.groups.reduce((n, g) =>
                  n + g.imagePrompts.filter(p => p.base64Image).length
                  + g.subgroups.reduce((m, sg) => m + sg.imagePrompts.filter(p => p.base64Image).length, 0)
                , 0);
              const isDownloading = downloadProgress !== null;
              return (
                <button
                  onClick={downloadAllImages}
                  disabled={totalReady === 0 || isDownloading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-black/15 text-[10px] font-black uppercase tracking-widest text-brand-subtle hover:text-brand-text hover:border-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ borderRadius: 1 }}
                  title={isDownloading
                    ? `Downloading ${downloadProgress!.done} / ${downloadProgress!.total}…`
                    : `Download all ${totalReady} images individually`}
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  {isDownloading
                    ? <span className="tabular-nums">{downloadProgress!.done}/{downloadProgress!.total}</span>
                    : <>Download <span className="tabular-nums">{totalReady}</span></>}
                </button>
              );
            })()}

            {/* Recycle Bin button (always visible) */}
            {(() => {
              const urgency = urgencyFor(binEntries.length);
              const bg = urgency === 'urgent' ? '#FF4F6D' : urgency === 'warn' ? '#FFE500' : 'transparent';
              const fg = urgency === 'urgent' ? '#FFFFFF' : '#1A1A1A';
              return (
                <button
                  onClick={() => { setBinAdoptTarget(null); setIsBinOpen(true); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 text-[10px] font-black uppercase tracking-widest transition-all ${urgency === 'normal' ? 'border-black/15 text-brand-subtle hover:text-brand-text hover:border-black' : 'border-black'}`}
                  style={{
                    backgroundColor: bg,
                    color: urgency === 'normal' ? undefined : fg,
                    borderRadius: 1,
                    boxShadow: urgency !== 'normal' ? '2px 2px 0 #000' : undefined,
                  }}
                  title={`Recycle bin — ${binEntries.length} / ${BIN_CAP}`}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Bin
                  <span className="tabular-nums">{binEntries.length}</span>
                </button>
              );
            })()}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsUsageOpen(true)}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title="API Usage"
            >
              <ChartBarIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <div className="flex gap-1.5 ml-1 pl-2 border-l border-black/10 dark:border-brand-primary/20">
              {['#6EE7B7', '#FFE500', '#FF4F6D'].map(c => (
                <span key={c} className="w-2.5 h-2.5 border border-black/20 dark:border-brand-primary/20 inline-block" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Studio navigation band ────────────────────────────────────── */}
        <div className="h-8 flex items-center border-t-2 border-black dark:border-brand-primary" style={{ backgroundColor: '#22D3EE' }}>
          <div className="flex-1 flex items-center pl-4">
            <button onClick={onBack} className="px-2.5 py-0.5 border-2 border-black text-[10px] font-black uppercase tracking-widest text-black hover:opacity-90 active:opacity-75 transition-opacity" style={{ backgroundColor: '#FF6B35', borderRadius: 1 }}>
              ← Concept Studio
            </button>
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-black select-none flex-shrink-0">— Image Studio —</span>
          <div className="flex-1 flex items-center justify-end pr-4">
            {onGoToCards && (
              <button onClick={onGoToCards} className="px-2.5 py-0.5 border-2 border-black text-[10px] font-black uppercase tracking-widest text-black hover:opacity-90 active:opacity-75 transition-opacity" style={{ backgroundColor: '#BEF264', borderRadius: 1 }}>
                Card Studio →
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Controls bar ────────────────────────────────────────────────── */}
      <div className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-24 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4 justify-between flex-wrap">

          {/* LEFT — style + model + progress */}
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex items-stretch border-2 border-black dark:border-brand-primary overflow-hidden flex-shrink-0"
              style={{ boxShadow: '2px 2px 0 0 #000' }}
            >
              {IMAGE_STYLES.map((style, i) => (
                <React.Fragment key={style.id}>
                  {i > 0 && <div className="w-px bg-black dark:bg-brand-primary flex-shrink-0" />}
                  <button
                    onClick={() => handleStyleChange(style.id)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
                      selectedStyle === style.id
                        ? 'bg-brand-text text-brand-surface'
                        : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'
                    }`}
                  >
                    {style.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
            {/* Art format toggle */}
            {(() => {
              const FORMAT_COLORS: Record<string, { bg: string; shape: { w: number; h: number } }> = {
                '1:1':  { bg: '#6EE7B7', shape: { w: 10, h: 10 } },
                '3:4':  { bg: '#FFE500', shape: { w: 8,  h: 11 } },
                '16:9': { bg: '#7DD3FC', shape: { w: 14, h: 8  } },
              };
              return (
                <div
                  className="flex items-stretch border-2 border-black dark:border-brand-primary overflow-hidden flex-shrink-0"
                  style={{ boxShadow: '2px 2px 0 0 #000' }}
                >
                  {ART_FORMATS.map((fmt, i) => {
                    const isActive = selectedFormat === fmt.id;
                    const meta = FORMAT_COLORS[fmt.id];
                    return (
                      <React.Fragment key={fmt.id}>
                        {i > 0 && <div className="w-px bg-black dark:bg-brand-primary flex-shrink-0" />}
                        <button
                          onClick={() => handleFormatChange(fmt.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap"
                          style={{
                            backgroundColor: isActive ? meta.bg : undefined,
                            color: isActive ? '#1A1A1A' : undefined,
                          }}
                          title={`Generate images in ${fmt.label} format (${fmt.id})`}
                        >
                          {/* Tiny aspect-ratio shape icon */}
                          <span
                            className="flex-shrink-0 border-2 border-current"
                            style={{ width: meta.shape.w, height: meta.shape.h, borderRadius: 1, opacity: isActive ? 1 : 0.4 }}
                          />
                          <span className={isActive ? 'text-[#1A1A1A]' : 'text-brand-subtle'}>{fmt.label}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}

            {isAnyGenerating && (
              <span className="text-xs font-mono text-brand-subtle">{generatingCount} generating…</span>
            )}
            {!isAnyGenerating && totalGroupDone > 0 && (
              <span className="text-[10px] text-brand-subtle">{totalGroupDone}/{totalGroupSlots} ready</span>
            )}
            {errorCount > 0 && (
              <button
                onClick={() => setShowErrorLog(v => !v)}
                className="flex items-center gap-1 border-2 border-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors"
                style={{
                  backgroundColor: showErrorLog ? '#FF4F6D' : '#FEE2E2',
                  color: showErrorLog ? '#FFFFFF' : '#991B1B',
                  boxShadow: '2px 2px 0 #000', borderRadius: 1,
                }}
              >
                ⚠ {errorCount} error{errorCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* CENTRE — Generate all (main feature) */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isAnyGenerating ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 border-2 border-black px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#FF4F6D', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
              >
                Cancel
              </button>
            ) : (
              <>
                <button
                  onClick={generateAllGroups}
                  className="flex items-center gap-2 border-2 border-black px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-text hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all whitespace-nowrap"
                  style={{ backgroundColor: '#6EE7B7', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  All Groups
                </button>
                <button
                  onClick={generateAllSubgroups}
                  className="flex items-center gap-2 border-2 border-black px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-text hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all whitespace-nowrap"
                  style={{ backgroundColor: '#FFE500', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  All Subgroups
                </button>
              </>
            )}
          </div>

          {/* RIGHT — model + view toggle + zoom + back */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={selectedModel}
              onChange={e => handleModelChange(e.target.value)}
              className="neo-input bg-brand-bg text-xs font-black text-brand-text outline-none cursor-pointer px-3 py-1.5 flex-shrink-0"
            >
              {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>

            {viewMode === 'grid' && (
              <div
                className="flex items-stretch border-2 border-black dark:border-brand-primary overflow-hidden"
                style={{ boxShadow: '2px 2px 0 0 #000' }}
              >
                <button onClick={() => setGridZoom(z => Math.max(48, z - 16))} disabled={gridZoom <= 48}
                  className="px-2.5 py-1 text-sm font-black bg-brand-surface text-brand-text hover:bg-brand-bg disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Zoom out">−</button>
                <div className="w-px bg-black dark:bg-brand-primary" />
                <span className="px-2 flex items-center text-[10px] font-black text-brand-subtle tabular-nums select-none bg-brand-surface">
                  {Math.round((gridZoom / 72) * 100)}%
                </span>
                <div className="w-px bg-black dark:bg-brand-primary" />
                <button onClick={() => setGridZoom(z => Math.min(192, z + 16))} disabled={gridZoom >= 192}
                  className="px-2.5 py-1 text-sm font-black bg-brand-surface text-brand-text hover:bg-brand-bg disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Zoom in">+</button>
              </div>
            )}

            <button
              onClick={() => setShowStarredOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-black dark:border-brand-primary text-[10px] font-black uppercase tracking-widest transition-colors ${showStarredOnly ? 'bg-amber-400 text-black' : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'}`}
              style={{ boxShadow: '2px 2px 0 0 #000', borderRadius: 1 }}
              title={showStarredOnly ? 'Showing starred only — click to show all' : 'Show starred picks only'}
            >
              <StarIcon isFilled={showStarredOnly} className="w-3 h-3" />
              Starred
            </button>

            <div
              className="flex items-stretch border-2 border-black dark:border-brand-primary overflow-hidden"
              style={{ boxShadow: '2px 2px 0 0 #000' }}
            >
              <button
                onClick={() => setViewMode('accordion')}
                className={`px-2.5 py-1.5 transition-colors ${viewMode === 'accordion' ? 'bg-brand-text text-brand-surface' : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'}`}
                title="List view"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
              <div className="w-px bg-black dark:bg-brand-primary" />
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-brand-text text-brand-surface' : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'}`}
                title="Grid view"
              >
                <GridIcon className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>

        {/* ── Custom style input — shown when "Custom" is selected ────────── */}
        {selectedStyle === CUSTOM_STYLE_ID && (
          <div className="max-w-6xl mx-auto px-6 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle flex-shrink-0">Custom Style</span>
              <input
                type="text"
                value={customStyleText}
                onChange={e => setCustomStyleText(e.target.value)}
                onBlur={() => commitCustomStyle(customStyleText)}
                onKeyDown={e => { if (e.key === 'Enter') { commitCustomStyle(customStyleText); (e.target as HTMLInputElement).blur(); } }}
                placeholder="e.g. Voxel Art, in the style of Refik Anadol · Dark Fantasy, mysterious atmosphere · Tech Noir, in the style of James Gurney…"
                className="neo-input flex-1 bg-brand-bg text-xs text-brand-text px-3 py-2 placeholder:text-brand-subtle/40"
              />
              {customStyleText && (
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex-shrink-0">✓ saved</span>
              )}
            </div>
            <p className="text-[9px] text-brand-subtle/50 mt-1 ml-[88px]">
              Pasted text is appended to every prompt as the art direction, and is saved with this world.
            </p>
          </div>
        )}

        {/* ── Consistency Panel — Phase 1 of CONSISTENCY_ROADMAP.md ────── */}
        <div className="max-w-6xl mx-auto px-6 pb-3">
          <button
            onClick={() => setConsistencyOpen(v => !v)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-subtle hover:text-brand-text transition-colors"
            title="Expand collection-wide consistency controls"
          >
            <span>✨ Consistency</span>
            <span className="text-brand-subtle/60">{consistencyOpen ? '▾' : '▸'}</span>
            {(tierPalettesEnabled || negativePromptEnabled) && (
              <span className="px-1.5 py-px text-[8px] font-black uppercase tracking-widest border-2 border-black bg-emerald-300 text-black" style={{ borderRadius: 1 }}>
                {(tierPalettesEnabled ? 1 : 0) + (negativePromptEnabled ? 1 : 0)} active
              </span>
            )}
          </button>

          {consistencyOpen && (
            <div className="mt-3 space-y-4 border-2 border-black/10 dark:border-brand-primary/15 bg-brand-bg/40 p-4" style={{ borderRadius: 1 }}>

              {/* ── Tier palettes ─────────────────────────────────────── */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tierPalettesEnabled}
                    onChange={e => {
                      const enabled = e.target.checked;
                      setTierPalettesEnabled(enabled);
                      commitTierPalettes({ enabled, ...tierPaletteText });
                    }}
                    className="w-3.5 h-3.5 cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-text">Tier palettes</span>
                  <span className="text-[9px] text-brand-subtle/60">
                    Force color discipline on Yellow / Green / Blue / Magenta tiers
                  </span>
                </label>

                {tierPalettesEnabled && (
                  <div className="mt-2 ml-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['yellow', 'green', 'blue', 'magenta'] as const).map(tier => {
                      const tierColors: Record<typeof tier, string> = {
                        yellow: '#FDE68A', green: '#86EFAC', blue: '#7DD3FC', magenta: '#F0ABFC',
                      };
                      return (
                        <div key={tier} className="flex items-center gap-2">
                          <span
                            className="flex-shrink-0 px-2 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-black text-black"
                            style={{ backgroundColor: tierColors[tier], borderRadius: 1, minWidth: 64, textAlign: 'center' }}
                          >{tier}</span>
                          <input
                            type="text"
                            value={tierPaletteText[tier]}
                            onChange={e => setTierPaletteText(prev => ({ ...prev, [tier]: e.target.value }))}
                            onBlur={() => commitTierPalettes({ enabled: tierPalettesEnabled, ...tierPaletteText })}
                            onKeyDown={e => { if (e.key === 'Enter') { commitTierPalettes({ enabled: tierPalettesEnabled, ...tierPaletteText }); (e.target as HTMLInputElement).blur(); } }}
                            placeholder={TIER_PALETTE_DEFAULTS[tier]}
                            className="neo-input flex-1 bg-brand-surface text-xs text-brand-text px-2 py-1.5 placeholder:text-brand-subtle/40"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Negative prompt / guardrails ──────────────────────── */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={negativePromptEnabled}
                    onChange={e => {
                      const enabled = e.target.checked;
                      setNegativePromptEnabled(enabled);
                      // When toggling off, also clear stored text so it stops affecting prompts
                      if (!enabled) {
                        setNegativePromptText('');
                        commitNegativePrompt('');
                      } else if (negativePromptText.trim()) {
                        commitNegativePrompt(negativePromptText);
                      }
                    }}
                    className="w-3.5 h-3.5 cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-text">Negative prompt</span>
                  <span className="text-[9px] text-brand-subtle/60">
                    Things to AVOID in every generated image
                  </span>
                </label>

                {negativePromptEnabled && (
                  <div className="mt-2 ml-6">
                    <textarea
                      value={negativePromptText}
                      onChange={e => setNegativePromptText(e.target.value)}
                      onBlur={() => commitNegativePrompt(negativePromptText)}
                      placeholder="e.g. no text, no logos, no humans · no blood, no labels, no callouts · no modern elements, no anachronisms…"
                      className="neo-input w-full bg-brand-surface text-xs text-brand-text px-3 py-2 placeholder:text-brand-subtle/40 resize-none"
                      rows={2}
                    />
                    {negativePromptText.trim() && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mt-1 inline-block">✓ saved</span>
                    )}
                  </div>
                )}
              </div>

              <p className="text-[9px] text-brand-subtle/50 pt-2 border-t border-black/5 dark:border-brand-primary/10">
                Theme description is always injected as <span className="font-mono">CONTEXT</span> in every prompt — no toggle needed.
                Tier palettes apply only to Yellow/Green/Blue/Magenta tiers (not Power-Ups / Utility / Activators).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Groups ──────────────────────────────────────────────────────── */}
      <main className="flex-grow max-w-6xl mx-auto w-full px-6 py-6">

        {/* ── Error log panel ─────────────────────────────────────────────── */}
        {showErrorLog && errorCount > 0 && (
          <div
            className="mb-5 border-2 border-black overflow-hidden"
            style={{ backgroundColor: '#FFF1F2', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black/10" style={{ backgroundColor: '#FFE4E6' }}>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-700">
                ⚠ Error Log — {errorCount} failed slot{errorCount !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    Object.keys(genErrors).forEach(key => {
                      const sgM = key.match(/^g(\d+)_sg(\d+)_(\d+)$/);
                      const gM  = key.match(/^g(\d+)_(\d+)$/);
                      if (sgM) generateSubgroupImage(+sgM[1], +sgM[2], +sgM[3]);
                      else if (gM) generateGroupImage(+gM[1], +gM[2]);
                    });
                  }}
                  disabled={isAnyGenerating}
                  className="border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-white text-red-700 hover:bg-red-50 disabled:opacity-40"
                  style={{ borderRadius: 1 }}
                >
                  Retry All
                </button>
                <button
                  onClick={() => setGenErrors({})}
                  className="border-2 border-black px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-white text-red-700 hover:bg-red-50"
                  style={{ borderRadius: 1 }}
                >
                  Clear
                </button>
                <button onClick={() => setShowErrorLog(false)} className="text-red-400 hover:text-red-700 font-black text-sm leading-none transition-colors">✕</button>
              </div>
            </div>

            {/* Error rows */}
            <div className="divide-y divide-black/10 max-h-48 overflow-y-auto">
              {Object.entries(genErrors).map(([key, msg]) => {
                let label = key;
                const sgM = key.match(/^g(\d+)_sg(\d+)_(\d+)$/);
                const gM  = key.match(/^g(\d+)_(\d+)$/);
                if (sgM) {
                  const gi = +sgM[1], si = +sgM[2], pi = +sgM[3];
                  const gTitle  = structure.groups[gi]?.title  ?? `Group ${gi + 1}`;
                  const sgTitle = structure.groups[gi]?.subgroups[si]?.title ?? `SG ${si + 1}`;
                  label = `${gTitle}  ·  ${sgTitle}  ·  Slot ${pi + 1}`;
                } else if (gM) {
                  const gi = +gM[1], pi = +gM[2];
                  const gTitle = structure.groups[gi]?.title ?? `Group ${gi + 1}`;
                  label = `${gTitle}  ·  Cover ${pi + 1}`;
                }
                return (
                  <div key={key} className="flex items-start gap-3 px-4 py-2">
                    <span className="text-[10px] font-black text-red-800 flex-shrink-0 min-w-[180px]">{label}</span>
                    <span className="text-[10px] font-mono text-red-600 flex-1">{msg}</span>
                    <button
                      onClick={() => {
                        const sgM2 = key.match(/^g(\d+)_sg(\d+)_(\d+)$/);
                        const gM2  = key.match(/^g(\d+)_(\d+)$/);
                        if (sgM2) generateSubgroupImage(+sgM2[1], +sgM2[2], +sgM2[3]);
                        else if (gM2) generateGroupImage(+gM2[1], +gM2[2]);
                      }}
                      disabled={isAnyGenerating}
                      className="flex-shrink-0 border border-black/20 px-1.5 py-0.5 text-[9px] font-black bg-white text-red-700 hover:bg-red-50 disabled:opacity-40"
                      style={{ borderRadius: 1 }}
                    >↺</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── GRID VIEW ─────────────────────────────────────────────────── */}
        {viewMode === 'grid' && (
          <div className="space-y-6">
            {structure.groups.map((group, gi) => {
              const color = CARD_COLORS[gi % CARD_COLORS.length];
              return (
                <div key={group.id ?? gi}>
                  {/* Group label row */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] font-black text-brand-subtle/40 tracking-widest flex-shrink-0">
                      {String(gi + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-black uppercase tracking-wide text-brand-text truncate flex-1">
                      {group.title}
                    </span>
                    {(() => {
                      const hasFav = group.favoriteImagePromptIndex !== null && group.favoriteImagePromptIndex !== undefined;
                      return (
                        <>
                          {hasFav && <StarIcon isFilled className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                          <button
                            onClick={() => hasFav && generateGroupSubgroups(gi)}
                            disabled={isAnyGenerating || !hasFav}
                            className="neo-btn flex items-center gap-1 px-2 py-0.5 text-[9px] font-black bg-brand-text text-brand-surface disabled:opacity-30 flex-shrink-0"
                            style={{ boxShadow: '1px 1px 0 0 #000' }}
                            title={hasFav ? 'Generate all subgroup images for this group' : 'Star a hero image first (hover IMG 1 or IMG 2)'}
                          >
                            <SparklesIcon className="w-2.5 h-2.5" />
                            Subgroups
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  {/* Image grid — pairs of cards with a thin separator between each pair */}
                  <div className="flex flex-wrap gap-y-2 items-start">

                    {/* ── Pair 0: group images (COVER 1 + COVER 2) ── */}
                    <div className={`flex flex-col ${group.subgroups.length > 0 ? 'pr-3 mr-2 border-r-2 border-black/20' : ''}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-1.5 py-px text-[7px] font-black uppercase tracking-widest bg-brand-text text-brand-surface" style={{ borderRadius: 1 }}>Cover</span>
                        <span className="text-[7px] font-black text-brand-subtle/40 uppercase tracking-wide">pick 1</span>
                      </div>
                      <div className="flex gap-1">
                      {group.imagePrompts.map((scenario, pi) => {
                        const key = `g${gi}_${pi}`;
                        const isFav = group.favoriteImagePromptIndex === pi;
                        if (showStarredOnly && !isFav) return null;
                        return (
                          <div
                            key={key}
                            className="neo-card overflow-hidden flex-shrink-0"
                            style={{ width: gridZoom, boxShadow: isFav ? '2px 2px 0 0 #fbbf24' : '2px 2px 0 0 #000', borderColor: isFav ? '#fbbf24' : undefined }}
                          >
                            <div className="h-0.5 w-full" style={{ backgroundColor: color }} />
                            <div className="relative w-full bg-brand-bg overflow-hidden" style={{ aspectRatio: selectedFormat.replace(':', '/') }}>
                              {scenario.base64Image ? (
                                <img
                                  src={`data:image/jpeg;base64,${scenario.base64Image}`}
                                  alt=""
                                  className="w-full h-full object-cover cursor-zoom-in"
                                  onClick={() => setLightbox({ src: `data:image/jpeg;base64,${scenario.base64Image}`, label: `Card Cover · Group ${gi + 1} · ${CARD_COLOR_NAMES[gi % CARD_COLOR_NAMES.length]} · ${group.title}`, colorHex: CARD_COLORS[gi % CARD_COLORS.length] })}
                                />
                              ) : genStates[key] === 'generating' ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
                                  <div className="w-5 h-5 border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin" />
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
                                  <button onClick={() => generateGroupImage(gi, pi)} className="neo-btn p-1.5 bg-brand-text text-brand-surface" title="Generate">
                                    <SparklesIcon className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              {scenario.base64Image && (
                                <div className={`absolute bottom-0 right-0 flex items-center gap-1.5 p-1.5 transition-opacity bg-black/70 ${gridRegenKey === key ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
                                  <button onClick={() => toggleGroupFavorite(gi, pi)} className={`p-1 ${isFav ? 'text-amber-400' : 'text-white'}`} title={isFav ? 'Hero' : 'Set as hero'}>
                                    <StarIcon isFilled={isFav} className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => openBinForGroupSlot(gi, pi)} className="p-1 text-white hover:text-emerald-300" title="Pick from bin">
                                    {/* Stack of photos — pick from collection */}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                      <rect x="8" y="3" width="13" height="13" rx="1.5" />
                                      <rect x="3" y="8" width="13" height="13" rx="1.5" fill="currentColor" fillOpacity="0.2" />
                                    </svg>
                                  </button>
                                  <button onClick={() => handleDiscardGroupImage(gi, pi)} className="p-1 text-white hover:text-red-400" title="Discard (send to bin)">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.45.061.894.124m-.894-.123L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562q.448-.064.894-.124m12.106-.438a48.108 48.108 0 0 1-3.478-.397m0 0V3.5A1.5 1.5 0 0 0 14.25 2h-4.5A1.5 1.5 0 0 0 8.25 3.5v1.94m5.628 0a48.667 48.667 0 0 0-5.628 0" />
                                    </svg>
                                  </button>
                                  <div className="relative">
                                    <button
                                      onClick={() => setGridRegenKey(prev => prev === key ? null : key)}
                                      onMouseDown={e => e.stopPropagation()}
                                      className={`p-1 transition-colors ${gridRegenKey === key ? 'text-brand-secondary' : 'text-white'}`}
                                      title="Regenerate options"
                                    >
                                      <RefreshIcon className="w-4 h-4" />
                                    </button>
                                    {gridRegenKey === key && (
                                      <RegenMenu
                                        onClose={() => setGridRegenKey(null)}
                                        onSimple={() => { generateGroupImage(gi, pi); setGridRegenKey(null); }}
                                        onWithExtra={(extra) => { generateGroupImage(gi, pi, extra); setGridRegenKey(null); }}
                                        isGenerating={genStates[key] === 'generating'}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="px-1.5 py-1 flex items-center gap-1" style={isFav ? { backgroundColor: color } : {}}>
                              {isFav && <StarIcon isFilled className="w-2.5 h-2.5 text-black flex-shrink-0" />}
                              <p className={`text-[8px] font-black uppercase tracking-widest truncate ${isFav ? 'text-black' : 'text-brand-subtle/50'}`}>
                                Cover {pi + 1}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {showStarredOnly && group.favoriteImagePromptIndex == null && (
                        <NoPick width={gridZoom} label="Cover" color={color} aspectRatio={selectedFormat.replace(':', '/')} />
                      )}
                      </div>
                    </div>

                    {/* ── Pairs 1…N: one pair per subgroup (SG1·1+SG1·2, SG2·1+SG2·2 …) ── */}
                    {group.subgroups.map((sg, si) => {
                      const hasFav = group.favoriteImagePromptIndex !== null && group.favoriteImagePromptIndex !== undefined;
                      const isLastPair = si === group.subgroups.length - 1;
                      return (
                        <div
                          key={si}
                          className={`flex flex-col ${!isLastPair ? 'pr-3 mr-2 border-r-2 border-black/15' : ''}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[7px] font-black uppercase tracking-widest text-brand-subtle/60 truncate max-w-[90px]" title={sg.title}>{sg.title}</span>
                            <span className="text-[7px] text-brand-subtle/40 flex-shrink-0">· 1/2</span>
                          </div>
                          <div className="flex gap-1">
                          {sg.imagePrompts.map((imgS, pi) => {
                            const key = `g${gi}_sg${si}_${pi}`;
                            const isSgFav = sg.favoriteImagePromptIndex === pi;
                            if (showStarredOnly && !isSgFav) return null;
                            return (
                              <div
                                key={key}
                                className="neo-card overflow-hidden flex-shrink-0"
                                style={{ width: gridZoom, boxShadow: '2px 2px 0 0 #000', opacity: hasFav ? 1 : 0.4 }}
                              >
                                <div className="h-0.5 w-full bg-black/10 dark:bg-brand-primary/20" />
                                <div className="relative w-full bg-brand-bg overflow-hidden" style={{ aspectRatio: selectedFormat.replace(':', '/') }}>
                                  {imgS.base64Image ? (
                                    <img
                                      src={`data:image/jpeg;base64,${imgS.base64Image}`}
                                      alt=""
                                      className="w-full h-full object-cover cursor-zoom-in"
                                      onClick={() => setLightbox({ src: `data:image/jpeg;base64,${imgS.base64Image}`, label: `Card Front · Group ${gi + 1} · ${CARD_COLOR_NAMES[gi % CARD_COLOR_NAMES.length]} · ${sg.title}`, colorHex: CARD_COLORS[gi % CARD_COLORS.length] })}
                                    />
                                  ) : genStates[key] === 'generating' ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
                                      <div className="w-5 h-5 border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin" />
                                    </div>
                                  ) : hasFav ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
                                      <button onClick={() => generateSubgroupImage(gi, si, pi)} className="neo-btn p-1.5 bg-brand-text text-brand-surface" title="Generate">
                                        <SparklesIcon className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
                                      <StarIcon className="w-4 h-4 text-brand-subtle/30" />
                                    </div>
                                  )}
                                  {imgS.base64Image && (
                                    <div className={`absolute bottom-0 right-0 flex items-center gap-1.5 p-1.5 transition-opacity bg-black/70 ${gridRegenKey === key ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
                                      <button onClick={() => toggleSubFavorite(gi, si, pi)} className={`p-1 ${isSgFav ? 'text-amber-400' : 'text-white'}`} title={isSgFav ? 'Picked' : 'Pick this'}>
                                        <StarIcon isFilled={isSgFav} className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => openBinForSubgroupSlot(gi, si, pi)} className="p-1 text-white hover:text-emerald-300" title="Pick from bin">
                                        {/* Stack of photos — pick from collection */}
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                          <rect x="8" y="3" width="13" height="13" rx="1.5" />
                                          <rect x="3" y="8" width="13" height="13" rx="1.5" fill="currentColor" fillOpacity="0.2" />
                                        </svg>
                                      </button>
                                      <button onClick={() => handleDiscardSubgroupImage(gi, si, pi)} className="p-1 text-white hover:text-red-400" title="Discard (send to bin)">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.45.061.894.124m-.894-.123L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562q.448-.064.894-.124m12.106-.438a48.108 48.108 0 0 1-3.478-.397m0 0V3.5A1.5 1.5 0 0 0 14.25 2h-4.5A1.5 1.5 0 0 0 8.25 3.5v1.94m5.628 0a48.667 48.667 0 0 0-5.628 0" />
                                        </svg>
                                      </button>
                                      <div className="relative">
                                        <button
                                          onClick={() => setGridRegenKey(prev => prev === key ? null : key)}
                                          onMouseDown={e => e.stopPropagation()}
                                          className={`p-1 transition-colors ${gridRegenKey === key ? 'text-brand-secondary' : 'text-white'}`}
                                          title="Regenerate options"
                                        >
                                          <RefreshIcon className="w-4 h-4" />
                                        </button>
                                        {gridRegenKey === key && (
                                          <RegenMenu
                                            onClose={() => setGridRegenKey(null)}
                                            onSimple={() => { generateSubgroupImage(gi, si, pi); setGridRegenKey(null); }}
                                            onWithExtra={(extra) => { generateSubgroupImage(gi, si, pi, extra); setGridRegenKey(null); }}
                                            isGenerating={genStates[key] === 'generating'}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="px-1.5 py-1 flex items-center gap-1" style={isSgFav ? { backgroundColor: color } : {}}>
                                  {isSgFav && <StarIcon isFilled className="w-2.5 h-2.5 text-black flex-shrink-0" />}
                                  <p className={`text-[8px] font-black uppercase tracking-widest truncate ${isSgFav ? 'text-black' : 'text-brand-subtle/40'}`} title={sg.title}>
                                    {pi + 1} / 2
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          {showStarredOnly && sg.favoriteImagePromptIndex == null && (
                            <NoPick width={gridZoom} color={color} aspectRatio={selectedFormat.replace(':', '/')} />
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ACCORDION VIEW ────────────────────────────────────────────── */}
        {viewMode === 'accordion' && (
        <div className="space-y-4">
        {structure.groups.map((group, gi) => {
          const color = CARD_COLORS[gi % CARD_COLORS.length];
          const isExpanded = expandedGroups[gi] ?? false;
          const hasFavorite = group.favoriteImagePromptIndex !== null &&
                              group.favoriteImagePromptIndex !== undefined;
          const groupDone = group.imagePrompts.filter(p => p.base64Image).length;

          return (
            <div key={group.id ?? gi} className="neo-card bg-brand-surface overflow-hidden">
              {/* Color strip */}
              <div className="h-1 w-full flex-shrink-0" style={{ backgroundColor: color }} />

              {/* Group header (toggle) */}
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, [gi]: !isExpanded }))}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-brand-bg transition-colors"
              >
                <span className="text-[10px] font-black text-brand-subtle/40 tracking-widest flex-shrink-0">
                  {String(gi + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="text-sm font-black uppercase tracking-wide text-brand-text">
                      {group.title}
                    </h2>
                    {group.groupType && GROUP_TYPE_LABEL[group.groupType] && (
                      <span className="text-[10px] font-bold text-brand-subtle/60 whitespace-nowrap">
                        ({GROUP_TYPE_LABEL[group.groupType]})
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-brand-subtle truncate mt-0.5">{group.mood}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-black bg-brand-secondary text-brand-text px-1.5 py-0.5">
                    {groupDone}/{group.imagePrompts.length} imgs
                  </span>
                  {hasFavorite && <StarIcon isFilled className="w-3.5 h-3.5 text-amber-400" />}
                  {isExpanded
                    ? <ChevronUpIcon className="w-4 h-4 text-brand-subtle" />
                    : <ChevronDownIcon className="w-4 h-4 text-brand-subtle" />}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-5 pb-6 border-t border-black/10 dark:border-brand-primary/20">

                  {/* Group image pair */}
                  <div className="mt-4 flex items-center gap-2 mb-2">
                    <span className="neo-section-label">Card Covers</span>
                    <div className="flex-1 h-px bg-black/10 dark:bg-brand-primary/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {group.imagePrompts.map((scenario, pi) => {
                      const key = `g${gi}_${pi}`;
                      return (
                        <ImageSlot
                          key={pi}
                          base64={scenario.base64Image ?? ''}
                          prompt={scenario.prompt}
                          genState={genStates[key] ?? 'idle'}
                          error={genErrors[key]}
                          isFavorite={group.favoriteImagePromptIndex === pi}
                          onGenerate={(extra) => generateGroupImage(gi, pi, extra)}
                          onFavorite={() => toggleGroupFavorite(gi, pi)}
                          onZoom={scenario.base64Image ? () => setLightbox({ src: `data:image/jpeg;base64,${scenario.base64Image}`, label: `Card Cover · Group ${gi + 1} · ${CARD_COLOR_NAMES[gi % CARD_COLOR_NAMES.length]} · ${group.title}`, colorHex: CARD_COLORS[gi % CARD_COLORS.length] }) : undefined}
                          aspectRatio={selectedFormat.replace(':', '/')}
                          onDiscard={() => handleDiscardGroupImage(gi, pi)}
                          onPickFromBin={() => openBinForGroupSlot(gi, pi)}
                        />
                      );
                    })}
                  </div>

                  {/* Subgroups section */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="neo-section-label">Subgroups</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-brand-subtle/40">· Card Fronts</span>
                      </div>
                      {hasFavorite ? (
                        <button
                          onClick={() => generateGroupSubgroups(gi)}
                          disabled={isAnyGenerating}
                          className="neo-btn flex items-center gap-1.5 px-3 py-1 text-[10px] font-black bg-brand-text text-brand-surface disabled:opacity-30"
                          style={{ boxShadow: '2px 2px 0 0 #000' }}
                        >
                          <SparklesIcon className="w-3 h-3" />
                          Gen All Subgroups
                        </button>
                      ) : (
                        <span className="text-[10px] text-brand-subtle italic">
                          Star a hero image above to unlock
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {group.subgroups.map((sg, si) => {
                        const sgKey = `g${gi}_sg${si}`;
                        const isSgExpanded = expandedSubgroups[sgKey] ?? false;
                        const sgDone = sg.imagePrompts.filter(p => p.base64Image).length;

                        return (
                          <div
                            key={si}
                            className="border-2 border-black/20 dark:border-brand-primary/20 overflow-hidden"
                            style={{ borderRadius: 1 }}
                          >
                            <button
                              onClick={() => hasFavorite && setExpandedSubgroups(prev => ({ ...prev, [sgKey]: !isSgExpanded }))}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${hasFavorite ? 'hover:bg-brand-bg cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                            >
                              <span className="text-[9px] font-black text-brand-subtle/40 flex-shrink-0">
                                {String(si + 1).padStart(2, '0')}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-black uppercase tracking-wide text-brand-text truncate block">
                                  {sg.title}
                                </span>
                              </div>
                              {sgDone > 0 && (
                                <span className="text-[9px] font-black bg-brand-secondary text-brand-text px-1 py-0.5 flex-shrink-0">
                                  {sgDone}/{sg.imagePrompts.length}
                                </span>
                              )}
                              {hasFavorite && (
                                isSgExpanded
                                  ? <ChevronUpIcon className="w-3.5 h-3.5 text-brand-subtle flex-shrink-0" />
                                  : <ChevronDownIcon className="w-3.5 h-3.5 text-brand-subtle flex-shrink-0" />
                              )}
                            </button>

                            {isSgExpanded && hasFavorite && (
                              <div className="px-4 pb-4 border-t border-black/10 dark:border-brand-primary/15">
                                <p className="text-[9px] text-brand-subtle mt-2 mb-3">{sg.mood}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {sg.imagePrompts.map((imgS, pi) => {
                                    const key = `g${gi}_sg${si}_${pi}`;
                                    return (
                                      <ImageSlot
                                        key={pi}
                                        base64={imgS.base64Image ?? ''}
                                        prompt={imgS.prompt}
                                        genState={genStates[key] ?? 'idle'}
                                        error={genErrors[key]}
                                        isFavorite={sg.favoriteImagePromptIndex === pi}
                                        onGenerate={(extra) => generateSubgroupImage(gi, si, pi, extra)}
                                        onFavorite={() => toggleSubFavorite(gi, si, pi)}
                                        onZoom={imgS.base64Image ? () => setLightbox({ src: `data:image/jpeg;base64,${imgS.base64Image}`, label: `Card Front · Group ${gi + 1} · ${CARD_COLOR_NAMES[gi % CARD_COLOR_NAMES.length]} · ${sg.title}`, colorHex: CARD_COLORS[gi % CARD_COLORS.length] }) : undefined}
                                        size="small"
                                        aspectRatio={selectedFormat.replace(':', '/')}
                                        onDiscard={() => handleDiscardSubgroupImage(gi, si, pi)}
                                        onPickFromBin={() => openBinForSubgroupSlot(gi, si, pi)}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
        )}

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-black/10 dark:border-brand-primary/20 px-6 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text">Auto-save on</span>
        <span className="text-[10px] font-mono text-brand-subtle">archive/worlds/{'{id}'}.json</span>
      </footer>

      {isUsageOpen && <UsageDashboard onClose={() => setIsUsageOpen(false)} />}

      <RecycleBinModal
        isOpen={isBinOpen}
        onClose={() => { setIsBinOpen(false); setBinAdoptTarget(null); }}
        entries={binEntries}
        onAdopt={binAdoptTarget ? handleBinAdopt : undefined}
        onDeleteOne={handleBinDeleteOne}
        onEmptyAll={handleBinEmptyAll}
        targetHint={binAdoptTarget?.label}
      />

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          onKeyDown={e => e.key === 'Escape' && setLightbox(null)}
          tabIndex={-1}
          ref={el => el?.focus()}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 z-10 w-7 h-7 flex items-center justify-center border-2 border-black bg-brand-surface text-brand-text font-black text-sm hover:bg-brand-text hover:text-brand-surface transition-colors"
              style={{ boxShadow: '2px 2px 0 0 #000' }}
            >✕</button>

            {/* Image */}
            <img
              src={lightbox.src}
              alt={lightbox.label}
              className="max-w-[88vw] max-h-[80vh] object-contain border-2 border-black"
              style={{ boxShadow: '4px 4px 0 0 #000' }}
            />

            {/* Label */}
            <span className="text-[11px] font-black uppercase tracking-widest text-white/70">
              {lightbox.colorHex
                ? lightbox.label.split(' · ').map((part, i, arr) => (
                    <span key={i}>
                      {CARD_COLOR_NAMES.includes(part)
                        ? <span style={{ color: lightbox.colorHex }}>{part}</span>
                        : part}
                      {i < arr.length - 1 && <span className="text-white/30"> · </span>}
                    </span>
                  ))
                : lightbox.label}
            </span>
          </div>
        </div>
      )}

    </div>
  );
};

export default ImageStudio;
