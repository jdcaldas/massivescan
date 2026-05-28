import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { DesignStructure, DeckConfig, MergedDeck, MergedQRCode } from '../types';
import { mergeDecks, GROUP_TYPE_OPTIONS, COLOR_TO_GROUP_TYPE } from '../services/deckFusionService';
import { listDecks, loadDeck, saveDeck, type DeckFileMeta } from '../services/fileArchiveService';
import { SunIcon, MoonIcon, SettingsIcon, ChartBarIcon } from './icons';
import UsageDashboard from './UsageDashboard';
import { DECK_TYPE_META, FALLBACK_TYPE_META, TIER_META } from '../../cards/deckTypeMeta';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeckFusionProps {
  designStructure: DesignStructure;
  theme: string;
  projectId: string;
  onBack: () => void;
  onSave: (updated: DesignStructure) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  onOpenSettings: () => void;
  projectName?: string;
}

// ── Star display ──────────────────────────────────────────────────────────────

const Stars: React.FC<{ n: number }> = ({ n }) => (
  <span className="font-mono text-[9px] tracking-tighter">
    {'★'.repeat(Math.max(0, n))}{'☆'.repeat(Math.max(0, 5 - n))}
  </span>
);

// ── Card type badge ───────────────────────────────────────────────────────────

// Type chip colors — re-exported from the shared deck type meta so the
// Deck Config Breakdown and the Cards Deck Summary stay perfectly in sync.
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = Object.fromEntries(
  Object.entries(DECK_TYPE_META).map(([k, v]) => [k, { bg: v.bg, fg: v.fg }])
);

// ── Position mini badges ──────────────────────────────────────────────────────

const POS_META: Record<string, { bg: string; fg: string; label: string }> = {
  qrCodePosition:   { bg: '#1A1A1A', fg: '#6EE7B7', label: 'QR' },
  number_Position:  { bg: '#93C5FD', fg: '#1A1A1A', label: '#'  },
  boxColorPosition: { bg: '#C8B6FF', fg: '#1A1A1A', label: 'B'  },
  letter_Position:  { bg: '#FF4F6D', fg: '#fff',    label: 'L'  },
  powerPosition:    { bg: '#FFE500', fg: '#1A1A1A', label: '⚡'  },
};

const PosBadges: React.FC<{ scenario: DeckFusionProps['designStructure']['groups'][0]['imagePrompts'][0] }> = ({ scenario }) => {
  const active = Object.entries(POS_META).filter(([key]) => {
    const v = (scenario as any)[key];
    return v && v !== 'none';
  });
  if (!active.length) return null;
  return (
    <div className="flex gap-0.5 flex-wrap mt-1">
      {active.map(([key, { bg, fg, label }]) => (
        <span
          key={key}
          className="px-1 py-px text-[8px] font-black border border-black/30"
          style={{ backgroundColor: bg, color: fg, borderRadius: 1 }}
        >{label}</span>
      ))}
    </div>
  );
};

// ── Card preview modal ────────────────────────────────────────────────────────

interface GroupedCard { front: MergedQRCode; back?: MergedQRCode }

// Filter tab definitions — colour-coded per tier / group
const PREVIEW_FILTERS: { key: string; label: string; bg: string; fg: string }[] = [
  { key: 'all',       label: 'All',        bg: '#1A1A1A', fg: '#FFFFFF' },
  { key: 'yellow',    label: 'Yellow',     bg: '#FDE68A', fg: '#1A1A1A' },
  { key: 'green',     label: 'Green',      bg: '#86EFAC', fg: '#1A1A1A' },
  { key: 'blue',      label: 'Blue',       bg: '#7DD3FC', fg: '#1A1A1A' },
  { key: 'magenta',   label: 'Magenta',    bg: '#F0ABFC', fg: '#1A1A1A' },
  { key: 'powerup',   label: 'Power-ups',  bg: '#C4B5FD', fg: '#1A1A1A' },
  { key: 'utility',   label: 'Utility',    bg: '#4B5563', fg: '#FFFFFF' },
  { key: 'activator', label: 'Activators', bg: '#FF4F6D', fg: '#FFFFFF' },
];

const GAME_CARD_TYPES = new Set(['game_card']);
const POWERUP_TYPES   = new Set(['power_up']);
const UTILITY_TYPES   = new Set(['promo_video', 'sponsor', 'instructions']);
const ACTIVATOR_TYPES = new Set(['game_activator']);

const cardMatchesFilter = (card: GroupedCard, filter: string): boolean => {
  if (filter === 'all') return true;
  const col  = (card.front.color ?? card.front.card_color ?? '').toLowerCase();
  const type = card.front.type;
  if (filter === 'yellow'  || filter === 'green' || filter === 'blue' || filter === 'magenta')
    return GAME_CARD_TYPES.has(type) && col === filter;
  if (filter === 'powerup')   return POWERUP_TYPES.has(type);
  if (filter === 'utility')   return UTILITY_TYPES.has(type);
  if (filter === 'activator') return ACTIVATOR_TYPES.has(type);
  return true;
};

const CardPreviewModal: React.FC<{ deck: MergedDeck; theme: string; onClose: () => void }> = ({ deck, theme, onClose }) => {
  const [cards, setCards] = useState<GroupedCard[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    // Back cards are separate entries with type 'game_card_back', one per color tier.
    // Build a lookup: color → back QR so we can attach the right back to every front.
    const backByColor = new Map<string, MergedQRCode>();
    deck.qrcodes.forEach(qr => {
      if (qr.type === 'game_card_back') {
        const col = (qr.color ?? qr.card_color ?? '').toLowerCase();
        if (col) backByColor.set(col, qr);
      }
    });

    const fronts: GroupedCard[] = deck.qrcodes
      .filter(qr => qr.type !== 'game_card_back')
      .map(qr => {
        // Resolve the back lookup key:
        //  • game_card       → use the card's color (yellow/green/blue/magenta)
        //  • power_up        → '__powerup'
        //  • game_activator  → '__activator'
        //  • utility (other) → '__utility'
        let backKey: string;
        if (qr.type === 'game_card') {
          backKey = (qr.color ?? qr.card_color ?? '').toLowerCase();
        } else if (qr.type === 'power_up') {
          backKey = '__powerup';
        } else if (qr.type === 'game_activator') {
          backKey = '__activator';
        } else {
          backKey = '__utility';
        }
        return { front: qr, back: backByColor.get(backKey) };
      });

    fronts.sort((a, b) => {
      const nA = a.front.number ?? Infinity;
      const nB = b.front.number ?? Infinity;
      return nA !== nB ? nA - nB : a.front.id.localeCompare(b.front.id);
    });

    setCards(fronts);
  }, [deck]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const renderSide = (qr: MergedQRCode | undefined, label: string) => {
    if (!qr) return (
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-brand-subtle">{label}</div>
        <div className="border-2 border-black/20 flex items-center justify-center aspect-[3/4] bg-brand-bg">
          <span className="text-xs text-brand-subtle/40 font-black uppercase">No data</span>
        </div>
      </div>
    );

    const tc = TYPE_COLORS[qr.type] ?? { bg: '#e5e7eb', fg: '#1A1A1A' };

    return (
      <div className="flex flex-col gap-2">
        {/* Side label + type badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-subtle">{label}</span>
          <span
            className="px-1.5 py-px text-[9px] font-black uppercase tracking-widest border border-black/30"
            style={{ backgroundColor: tc.bg, color: tc.fg, borderRadius: 1 }}
          >{qr.type.replace(/_/g, ' ')}</span>
          {qr.stars !== undefined && (
            <span className="ml-auto"><Stars n={qr.stars} /></span>
          )}
        </div>

        {/* Image */}
        {qr.gdesign_data?.visual_config?.base64Image ? (
          <img
            src={`data:image/jpeg;base64,${qr.gdesign_data.visual_config.base64Image}`}
            alt={qr.gdesign_data.title}
            className="w-full border-2 border-black"
            style={{ borderRadius: 1, display: 'block' }}
          />
        ) : (
          <div className="border-2 border-black/20 flex items-center justify-center aspect-[3/4] bg-brand-bg">
            <span className="text-[9px] text-brand-subtle/40 font-black uppercase">No image</span>
          </div>
        )}

        {/* G-Design data */}
        {qr.gdesign_data && (
          <div className="space-y-1">
            <p className="text-xs font-black text-brand-text truncate">{qr.gdesign_data.title}</p>
            <p className="text-[9px] text-brand-subtle line-clamp-2">{qr.gdesign_data.description}</p>
            {qr.gdesign_data.visual_config && <PosBadges scenario={qr.gdesign_data.visual_config} />}
          </div>
        )}

        {/* Deck config details */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 border-t-2 border-black/10 pt-2">
          {[
            ['ID',     qr.id],
            ['Path',   qr.pathId],
            ['Key',    qr.key],
            ['#',      qr.number],
            ['Color',  qr.color ?? qr.card_color],
            ['Letter', qr.letter],
          ].filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => (
            <div key={String(k)}>
              <span className="text-[8px] font-black uppercase tracking-widest text-brand-subtle/60">{k} </span>
              <span className="text-[9px] font-black text-brand-text">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const modalFronts  = deck.qrcodes.filter(q => q.type !== 'game_card_back');
  const modalBacks   = deck.qrcodes.filter(q => q.type === 'game_card_back');
  const matched      = modalFronts.filter(q => q.gdesign_data).length;
  const visibleCards = cards.filter(c => cardMatchesFilter(c, activeFilter));

  // Only show filter tabs that have at least one card
  const availableFilters = PREVIEW_FILTERS.filter(f => {
    if (f.key === 'all') return true;
    return cards.some(c => cardMatchesFilter(c, f.key));
  });

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={onClose}>
      {/* Modal chrome */}
      <div
        className="bg-brand-surface border-b-2 border-black flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Top row */}
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-brand-text">Preview</span>
            <span className="text-xs font-black text-brand-subtle truncate max-w-[240px]">{theme}</span>
            <div className="flex items-center gap-1.5">
              <div
                className="px-2 py-px text-[9px] font-black uppercase tracking-widest border-2 border-black"
                style={{ backgroundColor: '#6EE7B7', color: '#1A1A1A', borderRadius: 1 }}
              >
                {matched}/{modalFronts.length} fronts
              </div>
              <div
                className="px-2 py-px text-[9px] font-black uppercase tracking-widest border-2 border-black"
                style={{ backgroundColor: '#3A3A3A', color: '#FFFFFF', borderRadius: 1 }}
              >
                {modalBacks.length} backs
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border-2 border-black bg-brand-text text-brand-surface font-black text-sm hover:opacity-80 transition-opacity"
            style={{ boxShadow: '2px 2px 0 #555', borderRadius: 1 }}
          >✕</button>
        </div>
        {/* Filter bar */}
        <div className="flex items-center gap-1.5 px-5 pb-3 flex-wrap">
          {availableFilters.map(f => {
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black transition-all"
                style={{
                  backgroundColor: isActive ? f.bg : 'transparent',
                  color: isActive ? f.fg : undefined,
                  boxShadow: isActive ? '2px 2px 0 #000' : 'none',
                  borderRadius: 1,
                  opacity: isActive ? 1 : 0.45,
                }}
              >
                {f.label}
                {f.key !== 'all' && (
                  <span className="ml-1 opacity-60">
                    {cards.filter(c => cardMatchesFilter(c, f.key)).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="max-w-5xl mx-auto space-y-4">
          {visibleCards.map(card => (
            <div
              key={card.front.id}
              className="bg-brand-surface border-2 border-black"
              style={{ boxShadow: '4px 4px 0 #000', borderRadius: 1 }}
            >
              {/* Card header */}
              {(() => {
                const tierKey = (card.front.color ?? card.front.card_color ?? '').toLowerCase() as keyof typeof TIER_META;
                const tier = TIER_META[tierKey];
                return (
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 border-b-2 border-black"
                    style={tier ? { backgroundColor: tier.bg, color: tier.fg } : {}}
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Card</span>
                    <span className="text-sm font-black">
                      #{card.front.number ?? 'N/A'}
                    </span>
                    <span className="text-[9px] font-mono opacity-40">{card.front.id}</span>
                    {tier && (
                      <span className="ml-auto text-[8px] font-black uppercase tracking-widest opacity-60">
                        {tierKey}
                      </span>
                    )}
                  </div>
                );
              })()}
              {/* Front + Back */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black">
                <div className="bg-brand-surface p-4">{renderSide(card.front, 'Front')}</div>
                <div className="bg-brand-surface p-4">{renderSide(card.back, 'Back')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

// Fixed color sequence — must match GroupCard.tsx (deck tier order):
//   01 Yellow → 02 Green → 03 Blue → 04 Magenta → 05 Power-ups → 06 Utility → 07 Activators
const CARD_COLORS = ['#FDE68A', '#86EFAC', '#7DD3FC', '#F0ABFC', '#C4B5FD', '#4B5563', '#FF4F6D'];
// Auto-assign for designs that haven't been tagged yet — matches the
// design-phase order: Yellow, Green, Blue, Magenta, Power-ups, Utility, Activators.
const AUTO_GROUP_TYPES = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo Power-ups', 'Grupo Extra/Utilitários', 'Grupo Activators'];

const DeckFusion: React.FC<DeckFusionProps> = ({
  designStructure, theme, projectId, onBack, onSave,
  isDarkMode, setIsDarkMode, onOpenSettings, projectName,
}) => {
  // Auto-assign group types on first load if none are set yet
  const autoAssignedRef = useRef(false);
  const [structure, setStructure] = useState<DesignStructure>(() => {
    const s: DesignStructure = JSON.parse(JSON.stringify(designStructure));
    if (!s.groups.some(g => g.groupType)) {
      s.groups.forEach((g, i) => { if (AUTO_GROUP_TYPES[i]) g.groupType = AUTO_GROUP_TYPES[i]; });
      autoAssignedRef.current = true;
    }

    // Migration: old worlds had 6 groups (no Activators). If the structure
    // is missing 'Grupo Activators', auto-inject an empty 7th group so the
    // merger and studios all see a consistent 7-group taxonomy. User can
    // generate the cover image later via Image Studio.
    if (!s.groups.some(g => g.groupType === 'Grupo Activators')) {
      const newGroupId = `auto-activators-${Date.now()}`;
      s.groups.push({
        id: newGroupId,
        title: '',
        description: '',
        mood: '',
        groupType: 'Grupo Activators',
        imagePrompts: [],
        subgroups: [
          { id: `${newGroupId}-sub-0`, title: '', description: '', mood: '', imagePrompts: [] },
        ],
      } as any);
      autoAssignedRef.current = true;
    }

    return s;
  });
  const structureRef = useRef(structure);
  useEffect(() => { structureRef.current = structure; }, [structure]);

  // Persist the auto-assignment on first render
  useEffect(() => {
    if (autoAssignedRef.current) {
      onSave(structureRef.current);
      autoAssignedRef.current = false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reassign a single group's deck role
  const handleGroupTypeChange = useCallback((gi: number, newGroupType: string) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.groups[gi].groupType = newGroupType || undefined;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  const [deckList, setDeckList] = useState<DeckFileMeta[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [selectedDeckFile, setSelectedDeckFile] = useState('');
  const [deckConfig, setDeckConfig] = useState<DeckConfig | null>(null);
  const [mergedDeck, setMergedDeck] = useState<MergedDeck | null>(null);
  const [logs, setLogs] = useState<string[]>(['Select a deck from the project to begin.']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // ── Load deck list from project ────────────────────────────────────────────

  const refreshDeckList = useCallback(async () => {
    setIsLoadingDecks(true);
    const files = await listDecks(projectId);
    setDeckList(files);
    setIsLoadingDecks(false);
    if (files.length > 0 && !selectedDeckFile) {
      // auto-select the most recent deck
      setSelectedDeckFile(files[0].name);
    }
  }, [projectId, selectedDeckFile]);

  useEffect(() => { refreshDeckList(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load a selected deck from the project ─────────────────────────────────

  useEffect(() => {
    if (!selectedDeckFile) return;
    setDeckConfig(null);
    setMergedDeck(null);
    setLogs([`Loading ${selectedDeckFile}…`]);
    loadDeck(projectId, selectedDeckFile).then(data => {
      if (!data || !(data as any).deck_details || !(data as any).qrcodes) {
        setLogs(['ERROR: Invalid deck config file.']);
        return;
      }
      const cfg = data as DeckConfig;
      setDeckConfig(cfg);
      setLogs([
        `Deck: ${cfg.deck_details.deck_name}`,
        `  ${cfg.qrcodes.length} QR codes · v${cfg.deck_details.version}`,
      ]);
    });
  }, [selectedDeckFile, projectId]);

  // ── Import a new deck config into the project ──────────────────────────────

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.deck_details || !data.qrcodes) throw new Error('Invalid deck config — missing deck_details or qrcodes.');
        await saveDeck(projectId, file.name, data);
        await refreshDeckList();
        setSelectedDeckFile(file.name);
        setLogs([`Imported & saved: ${file.name}`, `  ${data.qrcodes.length} QR codes.`]);
      } catch (err: any) {
        setLogs([`ERROR: ${err.message}`]);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [projectId, refreshDeckList]);

  // ── Merge ─────────────────────────────────────────────────────────────────

  const handleMerge = useCallback(() => {
    if (!deckConfig) return;
    setIsProcessing(true);
    setLogs(['Starting merge…']);
    setTimeout(() => {
      try {
        const { mergedData, logOutput } = mergeDecks(deckConfig, structureRef.current);
        setMergedDeck(mergedData);
        setLogs([...logOutput, '✓ Merge complete.']);
      } catch (err: any) {
        setLogs([`ERROR: ${err.message}`]);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  }, [deckConfig]);

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    if (!mergedDeck) return;
    const fileName = `DECK_FUSION_${theme.replace(/ /g, '_').toUpperCase()}_MERGED.json`;
    const blob = new Blob([JSON.stringify(mergedDeck, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setLogs(prev => [...prev, `Downloaded ${fileName}`]);
  }, [mergedDeck, theme]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const frontCount   = mergedDeck?.qrcodes.filter(q => q.type !== 'game_card_back').length ?? 0;
  const backCount    = mergedDeck?.qrcodes.filter(q => q.type === 'game_card_back').length ?? 0;
  const totalCards   = mergedDeck?.qrcodes.length ?? 0;
  const matchedCards = mergedDeck?.qrcodes.filter(q => q.gdesign_data && q.type !== 'game_card_back').length ?? 0;
  const warnCount    = logs.filter(l => l.startsWith('Warning')).length;
  const errCount     = logs.filter(l => l.startsWith('ERROR')).length;
  const assignedCount = structure.groups.filter(g => g.groupType).length;

  // ── Deck summary ──────────────────────────────────────────────────────────

  const deckTypeCounts = deckConfig ? (() => {
    const counts: Record<string, number> = {};
    for (const qr of deckConfig.qrcodes) {
      counts[qr.type] = (counts[qr.type] ?? 0) + 1;
    }
    return counts;
  })() : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Hidden import input — adds new deck to project */}
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">

          {/* Project badge */}
          {projectName && (
            <div
              className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary dark:bg-brand-primary text-brand-text"
              style={{ borderRadius: 1 }}
            >
              {projectName}
            </div>
          )}

          {/* Divider */}
          <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg flex-shrink-0">|</span>

          {/* Studio identity */}
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-brand-primary leading-none">Deck Fusion</div>
            <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text truncate max-w-[220px]" title={theme}>{theme}</div>
          </div>

          {/* Right zone — utility icons (last in chain, no forward CTA) */}
          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
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
                <span key={c} className="w-2.5 h-2.5 border border-black/20 inline-block" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Studio navigation band ────────────────────────────────────── */}
        <div className="h-8 flex items-center border-t-2 border-black dark:border-brand-primary" style={{ backgroundColor: '#E879F9' }}>
          <div className="flex-1 flex items-center pl-4">
            <button
              onClick={onBack}
              className="px-2.5 py-0.5 border-2 border-black text-[10px] font-black uppercase tracking-widest text-black hover:opacity-90 active:opacity-75 transition-opacity"
              style={{ backgroundColor: '#BEF264', borderRadius: 1 }}
            >
              ← Card Studio
            </button>
          </div>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-black select-none flex-shrink-0">— Deck Fusion —</span>
          <div className="flex-1" />
        </div>
      </header>

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-24 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap justify-between">

          {/* LEFT — project deck selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle flex-shrink-0">Deck</span>

            {isLoadingDecks ? (
              <div className="flex items-center gap-1.5 px-3 py-2 border-2 border-black/30 text-[10px] text-brand-subtle">
                <div className="w-3 h-3 border-2 border-brand-subtle/30 border-t-brand-subtle rounded-full animate-spin" />
                Loading…
              </div>
            ) : deckList.length > 0 ? (
              <select
                value={selectedDeckFile}
                onChange={e => setSelectedDeckFile(e.target.value)}
                className="neo-input bg-brand-bg text-[10px] font-black text-brand-text outline-none cursor-pointer px-3 py-2 flex-shrink-0"
                style={{ minWidth: 200 }}
              >
                {deckList.map(f => (
                  <option key={f.name} value={f.name}>
                    {f.deckName || f.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-brand-subtle/60 italic">No decks in project yet</span>
            )}

            {/* Refresh */}
            <button
              onClick={refreshDeckList}
              disabled={isLoadingDecks}
              className="p-1.5 border-2 border-black/20 text-brand-subtle hover:text-brand-text hover:border-black transition-colors disabled:opacity-30"
              style={{ borderRadius: 1 }}
              title="Refresh deck list"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>

            {/* Import new deck to project */}
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-1 border-2 border-black/30 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-brand-subtle hover:text-brand-text hover:border-black transition-colors"
              style={{ borderRadius: 1 }}
              title="Import a new DECK_Config.json into this project"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Import
            </button>

            {deckConfig && (() => {
              const dcFronts = deckConfig.qrcodes.filter(q => q.type !== 'game_card_back').length;
              const dcBacks  = deckConfig.qrcodes.filter(q => q.type === 'game_card_back').length;
              return (
                <div className="flex items-center gap-1">
                  <div
                    className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-black"
                    style={{ backgroundColor: '#6EE7B7', color: '#1A1A1A', borderRadius: 1, boxShadow: '2px 2px 0 #000' }}
                  >
                    {dcFronts} Fronts
                  </div>
                  {dcBacks > 0 && (
                    <div
                      className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-black"
                      style={{ backgroundColor: '#3A3A3A', color: '#FFFFFF', borderRadius: 1, boxShadow: '2px 2px 0 #000' }}
                    >
                      {dcBacks} Backs
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* RIGHT — actions */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {mergedDeck && (
              <>
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-2 border-2 border-black px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#C8B6FF', color: '#1A1A1A', boxShadow: '2px 2px 0 #000', borderRadius: 1 }}
                >
                  Preview
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 border-2 border-black px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  style={{ backgroundColor: '#FFE500', color: '#1A1A1A', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download JSON
                </button>
              </>
            )}

            <button
              onClick={handleMerge}
              disabled={!deckConfig || isProcessing}
              className="flex items-center gap-2 border-2 border-black px-5 py-2 text-xs font-black uppercase tracking-widest hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#FF4F6D', color: '#fff', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
            >
              {isProcessing ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L9.22 5.03a.75.75 0 0 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                  </svg>
                  Merge →
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="flex-grow max-w-6xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Group type mapping ─────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-brand-text">Group Type Mapping</h2>
                <p className="text-[9px] text-brand-subtle mt-0.5">Assign each group a deck role. Changes save instantly.</p>
              </div>
              <div
                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-black"
                style={{
                  backgroundColor: assignedCount === structure.groups.length ? '#6EE7B7' : '#FFE500',
                  color: '#1A1A1A',
                  borderRadius: 1,
                  boxShadow: '2px 2px 0 #000',
                }}
              >
                {assignedCount}/{structure.groups.length} assigned
              </div>
            </div>

            <div
              className="border-2 border-black bg-brand-surface overflow-hidden"
              style={{ boxShadow: '4px 4px 0 #000', borderRadius: 1 }}
            >
              {structure.groups.map((group, gi) => {
                const color = CARD_COLORS[gi % CARD_COLORS.length];
                const assigned = !!group.groupType;
                return (
                  <div
                    key={group.id ?? gi}
                    className="flex items-center gap-3 px-4 py-3 border-b border-black/10 last:border-b-0 hover:bg-brand-bg transition-colors"
                  >
                    {/* Color dot + number */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 w-8">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[9px] font-black text-brand-subtle/40 tabular-nums">
                        {String(gi + 1).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Title + subgroup count */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-brand-text truncate">{group.title}</p>
                      <p className="text-[8px] text-brand-subtle">
                        {group.subgroups.length} subgroups · {group.imagePrompts.filter(p => p.base64Image).length}/{group.imagePrompts.length} images
                      </p>
                    </div>

                    {/* GroupType selector */}
                    <div className="flex-shrink-0">
                      <select
                        value={group.groupType ?? ''}
                        onChange={e => handleGroupTypeChange(gi, e.target.value)}
                        className="neo-input text-[9px] font-black text-brand-text bg-brand-bg outline-none cursor-pointer px-2 py-1.5"
                        style={{
                          borderColor: assigned ? color : undefined,
                          borderWidth: assigned ? 2 : undefined,
                          minWidth: 148,
                        }}
                      >
                        {GROUP_TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Deck type breakdown (when config loaded) */}
            {deckTypeCounts && (
              <div
                className="border-2 border-black bg-brand-surface p-4"
                style={{ boxShadow: '4px 4px 0 #000', borderRadius: 1 }}
              >
                <h3 className="text-[9px] font-black uppercase tracking-widest text-brand-subtle mb-3">Deck Config Breakdown</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {Object.entries(deckTypeCounts).map(([type, count]) => {
                    const meta = DECK_TYPE_META[type] ?? FALLBACK_TYPE_META;
                    return (
                      <div key={type} className="flex items-center justify-between gap-2">
                        <span
                          className="px-1.5 py-px text-[8px] font-black uppercase tracking-widest border border-black/20"
                          style={{ backgroundColor: meta.bg, color: meta.fg, borderRadius: 1 }}
                        >{meta.label}</span>
                        <span className="text-[10px] font-black text-brand-text tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Total</span>
                  <span className="text-sm font-black text-brand-text tabular-nums">{deckConfig!.qrcodes.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Merge results + log ───────────────────────────────── */}
          <div className="space-y-3">

            {/* Stats strip (post-merge) */}
            {mergedDeck && (
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Fronts',  value: frontCount,   bg: '#1A1A1A', fg: '#6EE7B7' },
                  { label: 'Backs',   value: backCount,    bg: '#3A3A3A', fg: '#FFFFFF' },
                  { label: 'Matched', value: matchedCards, bg: '#6EE7B7', fg: '#1A1A1A' },
                  { label: 'Warn',    value: warnCount,    bg: '#FFE500', fg: '#1A1A1A' },
                  { label: 'Errors',  value: errCount,     bg: errCount > 0 ? '#FF4F6D' : '#1A1A1A', fg: '#fff' },
                ].map(({ label, value, bg, fg }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center border-2 border-black py-3"
                    style={{ backgroundColor: bg, color: fg, boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
                  >
                    <span className="text-xl font-black tabular-nums leading-none">{value}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-80">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Log panel */}
            <div
              className="border-2 border-black bg-brand-surface overflow-hidden"
              style={{ boxShadow: '4px 4px 0 #000', borderRadius: 1 }}
            >
              <div className="px-4 py-2.5 border-b-2 border-black bg-brand-bg flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Processing Log</span>
                {logs.length > 0 && (
                  <span className="text-[9px] font-black text-brand-subtle/50 tabular-nums">{logs.length} entries</span>
                )}
              </div>
              <div
                ref={logRef}
                className="h-72 overflow-y-auto p-4 font-mono text-[10px] space-y-0.5 bg-brand-bg"
              >
                {logs.map((line, i) => (
                  <p
                    key={i}
                    className={
                      line.startsWith('ERROR')   ? 'text-red-500 font-black' :
                      line.startsWith('Warning') ? 'text-amber-500' :
                      line.startsWith('✓')       ? 'text-green-500 font-black' :
                      'text-brand-subtle'
                    }
                  >
                    <span className="text-brand-subtle/30 mr-2 select-none">{String(i + 1).padStart(3, '0')}</span>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* How-to hint (before any deck loaded) */}
            {!deckConfig && (
              <div
                className="border-2 border-black/30 bg-brand-surface p-5"
                style={{ borderRadius: 1 }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-subtle mb-3">How to use</p>
                <ol className="space-y-2 text-xs text-brand-subtle leading-relaxed">
                  <li><span className="font-black text-brand-text">1.</span> Assign a <span className="font-black text-brand-text">Group Type</span> to each group on the left.</li>
                  <li><span className="font-black text-brand-text">2.</span> Select a saved <span className="font-black text-brand-text">Deck Config</span> from the project — or click <span className="font-black text-brand-text">Import</span> to add a new one.</li>
                  <li><span className="font-black text-brand-text">3.</span> Click <span className="font-black text-brand-text">Merge →</span> to produce the master deck.</li>
                  <li><span className="font-black text-brand-text">4.</span> Preview the result, then <span className="font-black text-brand-text">Download JSON</span>.</li>
                </ol>

                <div className="mt-4 pt-3 border-t border-black/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-brand-subtle/60 mb-2">Color → Group mapping</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(COLOR_TO_GROUP_TYPE).map(([color, gt]) => {
                      const swatch: Record<string, string> = {
                        yellow: '#FDE68A', green: '#86EFAC', blue: '#7DD3FC', magenta: '#F0ABFC',
                      };
                      return (
                        <div key={color} className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 border border-black/30 flex-shrink-0"
                            style={{ backgroundColor: swatch[color] ?? '#ccc', borderRadius: 1 }}
                            title={color}
                          />
                          <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">{color}</span>
                          <span className="text-[9px] font-black text-brand-subtle/50">→</span>
                          <span className="text-[9px] font-black text-brand-subtle">{gt}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[8px] text-brand-subtle/60 mt-2 leading-relaxed">
                    Stars indicate rarity <em>within</em> each tier: 3★ → subgroup 1 (legendary), 2★ → subgroup 2 (rare), 1★ → subgroups 3–7 (commons).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      {isPreviewOpen && mergedDeck && (
        <CardPreviewModal
          deck={mergedDeck}
          theme={theme}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}

      {isUsageOpen && <UsageDashboard onClose={() => setIsUsageOpen(false)} />}
    </div>
  );
};

export default DeckFusion;
