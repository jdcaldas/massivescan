import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { DesignStructure, ImageScenario } from '../types';
import { generateImage, IMAGE_STYLES, IMAGE_MODELS } from '../services/imageGenService';
import {
  SparklesIcon, ChevronDownIcon, ChevronUpIcon,
  SunIcon, MoonIcon, SettingsIcon, RefreshIcon, StarIcon, TrashIcon, ChartBarIcon,
} from './icons';
import { recordUsage } from '../services/usageService';
import PositionModal, { type PositionProperty } from './PositionModal';
import UsageDashboard from './UsageDashboard';

// ── Types ─────────────────────────────────────────────────────────────────────

type GenState = 'idle' | 'generating' | 'error';

interface DeletedSlot {
  gi: number;
  pi: number;
  si?: number;
  scenario: ImageScenario;
  groupTitle: string;
  subTitle?: string;
}

interface ModalTarget {
  gi: number;
  pi: number;
  si?: number;
}

interface CardStudioProps {
  designStructure: DesignStructure;
  theme: string;
  defaultImageModel?: string;
  onBack: () => void;
  onGoToFusion?: () => void;
  onSave: (updated: DesignStructure) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  onOpenSettings: () => void;
  projectName?: string;
}

// ── Position badge colours ────────────────────────────────────────────────────

const POS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  qrCodePosition:   { bg: '#1A1A1A', fg: '#6EE7B7', label: 'QR' },
  number_Position:  { bg: '#93C5FD', fg: '#1A1A1A', label: '#'  },
  boxColorPosition: { bg: '#C8B6FF', fg: '#1A1A1A', label: 'B'  },
  letter_Position:  { bg: '#FF4F6D', fg: '#fff',    label: 'L'  },
};

// Fixed deck tier sequence — matches GroupCard.tsx, ImageStudio.tsx and deckTypeMeta.ts
const CARD_COLORS = [
  '#FDE68A', // 01: Yellow tier
  '#86EFAC', // 02: Green tier
  '#7DD3FC', // 03: Blue tier
  '#F0ABFC', // 04: Magenta tier
  '#C4B5FD', // 05: Power-ups (violet)
  '#4B5563', // 06: Utility (charcoal)
];

// ── Position badges overlay ───────────────────────────────────────────────────

const PositionBadges: React.FC<{ scenario: ImageScenario }> = ({ scenario }) => {
  const corners: Record<string, React.ReactNode> = {};

  (['qrCodePosition', 'number_Position', 'boxColorPosition', 'letter_Position'] as PositionProperty[]).forEach(key => {
    const pos = scenario[key] as string;
    if (!pos || pos === 'none') return;
    const cfg = POS_COLORS[key];
    if (!cfg) return;
    corners[pos] = (
      <div
        key={key}
        className="absolute flex items-center justify-center text-[8px] font-black border border-black"
        style={{
          width: 22, height: 22,
          backgroundColor: cfg.bg,
          color: cfg.fg,
          ...(pos === 'TL' ? { top: 4, left: 4 } : {}),
          ...(pos === 'TR' ? { top: 4, right: 4 } : {}),
          ...(pos === 'BL' ? { bottom: 4, left: 4 } : {}),
          ...(pos === 'BR' ? { bottom: 4, right: 4 } : {}),
        }}
      >
        {cfg.label}
      </div>
    );
  });

  return (
    <>
      {Object.values(corners)}
      {scenario.powerPosition === 'center' && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[8px] font-black uppercase tracking-widest border border-black"
          style={{ backgroundColor: '#FFE500', color: '#1A1A1A' }}
        >
          PWR
        </div>
      )}
    </>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const CardStudio: React.FC<CardStudioProps> = ({
  designStructure, theme, defaultImageModel, onBack, onGoToFusion, onSave,
  isDarkMode, setIsDarkMode, onOpenSettings, projectName,
}) => {
  const [structure, setStructure] = useState<DesignStructure>(() =>
    JSON.parse(JSON.stringify(designStructure))
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true });
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, boolean>>({});
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [deletedSlots, setDeletedSlots] = useState<DeletedSlot[]>([]);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => {
    const valid = IMAGE_MODELS.some(m => m.id === defaultImageModel);
    return valid ? (defaultImageModel ?? IMAGE_MODELS[0].id) : IMAGE_MODELS[0].id;
  });
  const [selectedStyle, setSelectedStyle] = useState(IMAGE_STYLES[0].id);
  const [genStates, setGenStates] = useState<Record<string, GenState>>({});
  const [genErrors, setGenErrors] = useState<Record<string, string>>({});

  const structureRef = useRef(structure);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { structureRef.current = structure; }, [structure]);

  // ── Core helpers ─────────────────────────────────────────────────────────

  const applyAndSave = useCallback((s: DesignStructure) => {
    structureRef.current = s;
    setStructure(s);
    onSave(s);
  }, [onSave]);

  const getScenario = (s: DesignStructure, gi: number, pi: number, si?: number): ImageScenario =>
    si !== undefined
      ? s.groups[gi].subgroups[si].imagePrompts[pi]
      : s.groups[gi].imagePrompts[pi];

  // ── Position changes ──────────────────────────────────────────────────────

  const handleSetProperty = useCallback((property: PositionProperty, value: string) => {
    if (!modalTarget) return;
    const { gi, pi, si } = modalTarget;
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    const scenario = getScenario(s, gi, pi, si);
    (scenario as Record<string, string>)[property] = value;
    applyAndSave(s);
  }, [modalTarget, applyAndSave]);

  // ── Fill presets ──────────────────────────────────────────────────────────

  const applyToAll = useCallback((fn: (p: ImageScenario) => void) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    s.groups.forEach(g => {
      g.imagePrompts.forEach(fn);
      g.subgroups.forEach(sg => sg.imagePrompts.forEach(fn));
    });
    applyAndSave(s);
  }, [applyAndSave]);

  const fillAll = useCallback(() => applyToAll(p => {
    p.qrCodePosition = 'BL'; p.number_Position = 'BR';
    p.boxColorPosition = 'TL'; p.letter_Position = 'TR'; p.powerPosition = 'center';
  }), [applyToAll]);

  const fillThree = useCallback(() => applyToAll(p => {
    p.qrCodePosition = 'BL'; p.number_Position = 'none';
    p.boxColorPosition = 'none'; p.letter_Position = 'TR'; p.powerPosition = 'center';
  }), [applyToAll]);

  const fillFour = useCallback(() => applyToAll(p => {
    p.qrCodePosition = 'BL'; p.number_Position = 'TR';
    p.boxColorPosition = 'TL'; p.letter_Position = 'none'; p.powerPosition = 'center';
  }), [applyToAll]);

  const clearAll = useCallback(() => applyToAll(p => {
    p.qrCodePosition = 'none'; p.number_Position = 'none';
    p.boxColorPosition = 'none'; p.letter_Position = 'none'; p.powerPosition = 'none';
  }), [applyToAll]);

  const togglePower = useCallback(() => {
    const s = structureRef.current;
    const allPrompts = s.groups.flatMap(g => [
      ...g.imagePrompts,
      ...g.subgroups.flatMap(sg => sg.imagePrompts),
    ]);
    const anyOn = allPrompts.some(p => p.powerPosition === 'center');
    applyToAll(p => { p.powerPosition = anyOn ? 'none' : 'center'; });
  }, [applyToAll]);

  // ── Delete / restore ──────────────────────────────────────────────────────

  const handleDelete = useCallback((gi: number, pi: number, si?: number) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    const group = s.groups[gi];
    const scenario = getScenario(s, gi, pi, si);
    const deleted: DeletedSlot = {
      gi, pi, si,
      scenario: { ...scenario },
      groupTitle: group.title,
      subTitle: si !== undefined ? group.subgroups[si].title : undefined,
    };
    setDeletedSlots(prev => [deleted, ...prev]);
    scenario.base64Image = '';
    applyAndSave(s);
    if (modalTarget?.gi === gi && modalTarget?.pi === pi && modalTarget?.si === si) {
      setModalTarget(null);
    }
  }, [applyAndSave, modalTarget]);

  const handleRestore = useCallback((d: DeletedSlot) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structureRef.current));
    const target = getScenario(s, d.gi, d.pi, d.si);
    if (target.base64Image) {
      alert('Slot already has an image. Delete it first.');
      return;
    }
    Object.assign(target, d.scenario);
    applyAndSave(s);
    setDeletedSlots(prev => prev.filter(x => x !== d));
  }, [applyAndSave]);

  const handlePermanentlyDelete = useCallback((d: DeletedSlot) => {
    setDeletedSlots(prev => prev.filter(x => x !== d));
  }, []);

  // ── Image generation ──────────────────────────────────────────────────────

  const doGenerate = useCallback(async (
    key: string,
    prompt: string,
    applyResult: (base64: string, prev: DesignStructure) => DesignStructure,
  ) => {
    setGenStates(prev => ({ ...prev, [key]: 'generating' }));
    setGenErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const base64 = await generateImage(prompt, selectedStyle, selectedModel, abortRef.current?.signal);
      const updated = applyResult(base64, structureRef.current);
      applyAndSave(updated);
      recordUsage(selectedModel, 0, 0);
      setGenStates(prev => ({ ...prev, [key]: 'idle' }));
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') { setGenStates(prev => ({ ...prev, [key]: 'idle' })); return; }
      setGenStates(prev => ({ ...prev, [key]: 'error' }));
      setGenErrors(prev => ({ ...prev, [key]: err?.message ?? String(e) }));
    }
  }, [selectedStyle, selectedModel, applyAndSave]);

  const generateSlotImage = useCallback((gi: number, pi: number, si?: number, extraPrompt?: string) => {
    const key = si !== undefined ? `g${gi}_sg${si}_${pi}` : `g${gi}_${pi}`;
    const group = structureRef.current.groups[gi];
    let base: string;
    if (si !== undefined) {
      const favIdx = group.favoriteImagePromptIndex ?? 0;
      const favPrompt = group.imagePrompts[favIdx]?.prompt ?? '';
      const sg = group.subgroups[si];
      const scenario = sg.imagePrompts[pi];
      base = `Setting: ${group.title} universe (reference: ${favPrompt}). Subgroup: ${sg.title}. ${sg.description}. Art direction: ${sg.mood}. Scene: ${scenario.prompt}`;
    } else {
      const scenario = group.imagePrompts[pi];
      base = `${group.title}. ${group.description}. Art direction: ${group.mood}. Scene: ${scenario.prompt}`;
    }
    const prompt = extraPrompt ? `${base}. Additional directions: ${extraPrompt}` : base;
    return doGenerate(key, prompt, (base64, prev) => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      if (si !== undefined) s.groups[gi].subgroups[si].imagePrompts[pi].base64Image = base64;
      else s.groups[gi].imagePrompts[pi].base64Image = base64;
      return s;
    });
  }, [doGenerate]);

  // ── Download all ──────────────────────────────────────────────────────────

  const handleDownloadAll = useCallback(() => {
    const s = structureRef.current;
    let count = 0;
    const dl = (base64: string, name: string) => {
      const a = document.createElement('a');
      a.href = `data:image/jpeg;base64,${base64}`;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      count++;
    };
    s.groups.forEach((g, gi) => {
      g.imagePrompts.forEach((p, pi) => {
        if (p.base64Image) dl(p.base64Image, `${String(gi + 1).padStart(2, '0')}_${g.title.slice(0, 20)}_img${pi + 1}.jpg`);
      });
      g.subgroups.forEach((sg, si) => {
        sg.imagePrompts.forEach((p, pi) => {
          if (p.base64Image) dl(p.base64Image, `${String(gi + 1).padStart(2, '0')}_${g.title.slice(0, 12)}_sg${si + 1}_img${pi + 1}.jpg`);
        });
      });
    });
    if (count === 0) alert('No images to download.');
  }, []);

  // ── Modal scenario ────────────────────────────────────────────────────────

  const modalScenario: ImageScenario | null = modalTarget
    ? getScenario(structure, modalTarget.gi, modalTarget.pi, modalTarget.si)
    : null;

  const modalTitle = modalTarget
    ? (() => {
        const g = structure.groups[modalTarget.gi];
        const si = modalTarget.si;
        return si !== undefined
          ? `${g.title} / ${g.subgroups[si].title} · IMG ${modalTarget.pi + 1}`
          : `${g.title} · IMG ${modalTarget.pi + 1}`;
      })()
    : '';

  const generatingCount = Object.values(genStates).filter(s => s === 'generating').length;
  const isAnyGenerating = generatingCount > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">

          {/* Back arrow */}
          <button
            onClick={onBack}
            className="p-1.5 text-brand-subtle hover:text-brand-text transition-colors group flex-shrink-0"
            title="Back to Image Studio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

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
            <div className="text-[9px] font-black uppercase tracking-widest text-brand-primary leading-none">Card Studio</div>
            <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text truncate max-w-[220px]" title={theme}>{theme}</div>
          </div>

          {/* Right zone */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">

            {/* Forward CTA */}
            {onGoToFusion && (
              <button
                onClick={onGoToFusion}
                className="flex items-center gap-1.5 border-2 border-black dark:border-brand-primary px-4 py-1.5 text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all whitespace-nowrap"
                style={{ backgroundColor: '#FFE500', color: '#1A1A1A', boxShadow: '2px 2px 0 #000', borderRadius: 1 }}
                title="Go to Deck Fusion"
              >
                Deck Fusion →
              </button>
            )}

            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title={isDarkMode ? 'Light mode' : 'Dark mode'}>
              {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsUsageOpen(true)} className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title="API Usage">
              <ChartBarIcon className="w-4 h-4" />
            </button>
            <button onClick={onOpenSettings} className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title="Settings">
              <SettingsIcon className="w-4 h-4" />
            </button>
            {/* Recycle bin */}
            <button
              onClick={() => setIsRecycleBinOpen(true)}
              className="relative p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title="Recycle bin"
            >
              <TrashIcon className="w-4 h-4" />
              {deletedSlots.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[8px] font-black rounded-full bg-red-500 text-white">
                  {deletedSlots.length}
                </span>
              )}
            </button>
            {/* Download */}
            <button
              onClick={handleDownloadAll}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title="Download all images"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
            <div className="flex gap-1.5 ml-1 pl-2 border-l border-black/10 dark:border-brand-primary/20">
              {['#6EE7B7', '#FFE500', '#FF4F6D'].map(c => (
                <span key={c} className="w-2.5 h-2.5 border border-black/20 dark:border-brand-primary/20 inline-block" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-16 z-10">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-2 flex-wrap justify-between">

          {/* LEFT — presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle mr-1">Preencher:</span>
            {[
              { label: '5 Elem', action: fillAll, title: 'QR:BL · Nº:BR · Cor:TL · Letra:TR · Power' },
              { label: '3 Elem', action: fillThree, title: 'QR:BL · Letra:TR · Power' },
              { label: '4 Elem', action: fillFour, title: 'QR:BL · Nº:TR · Cor:TL · Power' },
            ].map(({ label, action, title }) => (
              <button
                key={label}
                onClick={action}
                title={title}
                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-black bg-brand-surface text-brand-text hover:bg-brand-bg transition-colors"
                style={{ boxShadow: '2px 2px 0 #000', borderRadius: 1 }}
              >{label}</button>
            ))}
            <button
              onClick={togglePower}
              title="Toggle Power bar on all images"
              className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-black text-brand-text hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#FFE500', boxShadow: '2px 2px 0 #000', borderRadius: 1 }}
            >⚡ Power</button>
            <button
              onClick={clearAll}
              title="Clear all positions"
              className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-2 border-black bg-brand-surface text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              style={{ boxShadow: '2px 2px 0 #000', borderRadius: 1 }}
            >✕ Limpar</button>
          </div>

          {/* RIGHT — model + status + fusion */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAnyGenerating && (
              <span className="text-xs font-mono text-brand-subtle">{generatingCount} generating…</span>
            )}
            <select
              value={selectedStyle}
              onChange={e => setSelectedStyle(e.target.value)}
              className="neo-input bg-brand-bg text-[10px] font-black text-brand-text outline-none cursor-pointer px-2.5 py-1.5 flex-shrink-0"
            >
              {IMAGE_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="neo-input bg-brand-bg text-[10px] font-black text-brand-text outline-none cursor-pointer px-2.5 py-1.5 flex-shrink-0"
            >
              {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>

          </div>
        </div>
      </div>

      {/* ── Groups ────────────────────────────────────────────────────────── */}
      <main className="flex-grow max-w-6xl mx-auto w-full px-6 py-6 space-y-4">
        {structure.groups.map((group, gi) => {
          const color = CARD_COLORS[gi % CARD_COLORS.length];
          const isExpanded = expandedGroups[gi] ?? false;

          return (
            <div key={group.id ?? gi} className="neo-card bg-brand-surface overflow-hidden">
              <div className="h-1 w-full" style={{ backgroundColor: color }} />

              {/* Group header */}
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, [gi]: !isExpanded }))}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-brand-bg transition-colors"
              >
                <span className="text-[10px] font-black text-brand-subtle/40 tracking-widest flex-shrink-0">
                  {String(gi + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-wide text-brand-text truncate">{group.title}</h2>
                  <p className="text-[10px] text-brand-subtle truncate mt-0.5">{group.mood}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Position set count */}
                  {(() => {
                    const set = group.imagePrompts.filter(p =>
                      p.qrCodePosition && p.qrCodePosition !== 'none' &&
                      p.qrCodePosition !== ''
                    ).length;
                    return set > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 border-2 border-black" style={{ backgroundColor: '#6EE7B7', borderRadius: 1 }}>
                        {set}/{group.imagePrompts.length} set
                      </span>
                    );
                  })()}
                  {isExpanded
                    ? <ChevronUpIcon className="w-4 h-4 text-brand-subtle" />
                    : <ChevronDownIcon className="w-4 h-4 text-brand-subtle" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-6 border-t border-black/10 dark:border-brand-primary/20">

                  {/* Group image pair */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {group.imagePrompts.map((scenario, pi) => {
                      const key = `g${gi}_${pi}`;
                      const gs = genStates[key] ?? 'idle';
                      return (
                        <CardSlot
                          key={pi}
                          scenario={scenario}
                          genState={gs}
                          error={genErrors[key]}
                          isFavorite={group.favoriteImagePromptIndex === pi}
                          label={`IMG ${pi + 1}`}
                          onPosition={() => setModalTarget({ gi, pi })}
                          onGenerate={() => generateSlotImage(gi, pi)}
                          onDelete={() => handleDelete(gi, pi)}
                        />
                      );
                    })}
                  </div>

                  {/* Subgroups */}
                  <div className="mt-5 space-y-2">
                    <span className="neo-section-label">Subgroups</span>
                    {group.subgroups.map((sg, si) => {
                      const sgKey = `g${gi}_sg${si}`;
                      const isSgExpanded = expandedSubgroups[sgKey] ?? false;

                      return (
                        <div
                          key={si}
                          className="border-2 border-black/20 dark:border-brand-primary/20 overflow-hidden"
                          style={{ borderRadius: 1 }}
                        >
                          <button
                            onClick={() => setExpandedSubgroups(prev => ({ ...prev, [sgKey]: !isSgExpanded }))}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-bg transition-colors"
                          >
                            <span className="text-[9px] font-black text-brand-subtle/40 flex-shrink-0">{String(si + 1).padStart(2, '0')}</span>
                            <span className="text-xs font-black uppercase tracking-wide text-brand-text truncate flex-1">{sg.title}</span>
                            {isSgExpanded
                              ? <ChevronUpIcon className="w-3.5 h-3.5 text-brand-subtle flex-shrink-0" />
                              : <ChevronDownIcon className="w-3.5 h-3.5 text-brand-subtle flex-shrink-0" />}
                          </button>

                          {isSgExpanded && (
                            <div className="px-4 pb-4 border-t border-black/10 dark:border-brand-primary/15">
                              <p className="text-[9px] text-brand-subtle mt-2 mb-3">{sg.mood}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {sg.imagePrompts.map((scenario, pi) => {
                                  const key = `g${gi}_sg${si}_${pi}`;
                                  const gs = genStates[key] ?? 'idle';
                                  return (
                                    <CardSlot
                                      key={pi}
                                      scenario={scenario}
                                      genState={gs}
                                      error={genErrors[key]}
                                      isFavorite={sg.favoriteImagePromptIndex === pi}
                                      label={`SG${si + 1}·${pi + 1}`}
                                      size="small"
                                      onPosition={() => setModalTarget({ gi, pi, si })}
                                      onGenerate={() => generateSlotImage(gi, pi, si)}
                                      onDelete={() => handleDelete(gi, pi, si)}
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
              )}
            </div>
          );
        })}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-black/10 dark:border-brand-primary/20 px-6 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text">Auto-save on</span>
        <span className="text-[10px] font-mono text-brand-subtle">archive/worlds/{'{id}'}.json</span>
      </footer>

      {/* ── Position Modal ─────────────────────────────────────────────────── */}
      {modalTarget && modalScenario && (
        <PositionModal
          imageScenario={modalScenario}
          title={modalTitle}
          onClose={() => setModalTarget(null)}
          onSetProperty={handleSetProperty}
        />
      )}

      {/* ── Recycle Bin ───────────────────────────────────────────────────── */}
      {isRecycleBinOpen && (
        <RecycleBin
          slots={deletedSlots}
          onClose={() => setIsRecycleBinOpen(false)}
          onRestore={handleRestore}
          onDelete={handlePermanentlyDelete}
        />
      )}

      {isUsageOpen && <UsageDashboard onClose={() => setIsUsageOpen(false)} />}
    </div>
  );
};

// ── CardSlot ──────────────────────────────────────────────────────────────────

interface CardSlotProps {
  scenario: ImageScenario;
  genState: GenState;
  error?: string;
  isFavorite: boolean;
  label: string;
  size?: 'normal' | 'small';
  onPosition: () => void;
  onGenerate: () => void;
  onDelete: () => void;
}

const CardSlot: React.FC<CardSlotProps> = ({
  scenario, genState, error, label, size = 'normal',
  onPosition, onGenerate, onDelete,
}) => {
  const isSmall = size === 'small';
  const hasImage = !!scenario.base64Image;

  const posCount = (['qrCodePosition', 'number_Position', 'boxColorPosition', 'letter_Position'] as const).filter(
    k => scenario[k] && scenario[k] !== 'none' && scenario[k] !== ''
  ).length + (scenario.powerPosition === 'center' ? 1 : 0);

  return (
    <div
      className="neo-card overflow-hidden flex flex-col"
      style={{ boxShadow: posCount > 0 ? '3px 3px 0 0 #6EE7B7' : '3px 3px 0 0 #000' }}
    >
      {/* Image area */}
      <div className={`relative ${isSmall ? 'aspect-square' : 'aspect-square'} bg-brand-bg overflow-hidden flex-shrink-0`}>
        {hasImage ? (
          <>
            <img
              src={`data:image/jpeg;base64,${scenario.base64Image}`}
              alt=""
              className="w-full h-full object-cover cursor-pointer"
              onClick={onPosition}
            />
            <PositionBadges scenario={scenario} />
          </>
        ) : genState === 'generating' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-bg">
            <div className={`${isSmall ? 'w-6 h-6' : 'w-8 h-8'} border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Generating…</span>
          </div>
        ) : genState === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center bg-brand-bg">
            <span className="text-[9px] font-bold text-red-500">Error</span>
            <span className="text-[9px] text-brand-subtle line-clamp-2">{error}</span>
            <button onClick={onGenerate} className="neo-btn px-2 py-1 text-[9px] font-black bg-brand-text text-brand-surface mt-1" style={{ boxShadow: '1px 1px 0 0 #000' }}>Retry</button>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
            <button
              onClick={onGenerate}
              className={`neo-btn flex items-center gap-1.5 ${isSmall ? 'px-3 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'} font-black bg-brand-text text-brand-surface`}
            >
              <SparklesIcon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              {isSmall ? 'Gen' : 'Generate'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`${isSmall ? 'p-1.5' : 'p-2.5'} flex-1 flex flex-col`}>
        <p className={`${isSmall ? 'text-[8px] min-h-[2em]' : 'text-[9px] min-h-[2.5em]'} text-brand-subtle line-clamp-2 leading-relaxed flex-1`}>
          {scenario.prompt}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          {/* Label + position count */}
          <div className="flex items-center gap-1">
            <span className={`${isSmall ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-widest text-brand-subtle`}>{label}</span>
            {posCount > 0 && (
              <span className="text-[7px] font-black px-1 border border-black" style={{ backgroundColor: '#6EE7B7', borderRadius: 1 }}>
                {posCount}
              </span>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1">
            {hasImage && (
              <>
                <button
                  onClick={onPosition}
                  className={`p-0.5 text-brand-subtle hover:text-brand-text transition-colors`}
                  title="Set positions"
                >
                  <svg viewBox="0 0 14 14" className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="1" y="1" width="12" height="12" rx="0.5" />
                    <circle cx="3.5" cy="3.5" r="1" fill="currentColor" stroke="none" />
                    <circle cx="10.5" cy="3.5" r="1" fill="currentColor" stroke="none" />
                    <circle cx="3.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
                    <circle cx="10.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                <button
                  onClick={onGenerate}
                  disabled={genState === 'generating'}
                  className="p-0.5 text-brand-subtle hover:text-brand-text transition-colors disabled:opacity-30"
                  title="Regenerate"
                >
                  <RefreshIcon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-0.5 text-brand-subtle hover:text-red-500 transition-colors"
                  title="Delete image"
                >
                  <TrashIcon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Recycle Bin ───────────────────────────────────────────────────────────────

interface RecycleBinProps {
  slots: DeletedSlot[];
  onClose: () => void;
  onRestore: (d: DeletedSlot) => void;
  onDelete: (d: DeletedSlot) => void;
}

const RecycleBin: React.FC<RecycleBinProps> = ({ slots, onClose, onRestore, onDelete }) => (
  <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div
      className="bg-brand-surface border-2 border-black flex flex-col"
      style={{ boxShadow: '6px 6px 0 #000', maxWidth: 640, width: '100%', maxHeight: '80vh', borderRadius: 1 }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black flex-shrink-0">
        <span className="text-xs font-black uppercase tracking-widest text-brand-text">Recycle Bin</span>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center border-2 border-black bg-brand-text text-brand-surface font-black text-sm hover:opacity-80" style={{ boxShadow: '2px 2px 0 #555', borderRadius: 1 }}>✕</button>
      </div>
      <div className="flex-grow overflow-y-auto p-4">
        {slots.length === 0 ? (
          <p className="text-brand-subtle text-xs text-center py-10 font-black uppercase tracking-widest">Empty</p>
        ) : (
          <div className="space-y-2">
            {slots.map((d, i) => (
              <div key={i} className="flex items-center gap-3 neo-card p-2">
                {d.scenario.base64Image && (
                  <img src={`data:image/jpeg;base64,${d.scenario.base64Image}`} alt="" className="w-12 h-12 object-cover flex-shrink-0 border-2 border-black" />
                )}
                <div className="flex-grow min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-text truncate">
                    {d.groupTitle}{d.subTitle ? ` / ${d.subTitle}` : ''} · IMG {d.pi + 1}
                  </p>
                  <p className="text-[9px] text-brand-subtle truncate">{d.scenario.prompt}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => onRestore(d)}
                    className="neo-btn px-2 py-1 text-[9px] font-black bg-brand-text text-brand-surface"
                    style={{ boxShadow: '1px 1px 0 0 #000' }}
                  >↩ Restore</button>
                  <button
                    onClick={() => onDelete(d)}
                    className="neo-btn px-2 py-1 text-[9px] font-black bg-red-500 text-white"
                    style={{ boxShadow: '1px 1px 0 0 #7f1d1d' }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default CardStudio;
