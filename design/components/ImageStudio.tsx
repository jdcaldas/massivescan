import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { DesignStructure } from '../types';
import { generateImage, IMAGE_STYLES, IMAGE_MODELS } from '../services/imageGenService';
import {
  SparklesIcon, StarIcon, ChevronDownIcon, ChevronUpIcon,
  SunIcon, MoonIcon, SettingsIcon, RefreshIcon, GridIcon, ListIcon, ChartBarIcon,
} from './icons';
import { recordUsage } from '../services/usageService';
import UsageDashboard from './UsageDashboard';

const CARD_COLORS = ['#6EE7B7', '#93C5FD', '#FDE68A', '#FCA5A5', '#C4B5FD', '#F9A8D4', '#A5F3FC'];

type GenState = 'idle' | 'generating' | 'error';

interface ImageStudioProps {
  designStructure: DesignStructure;
  theme: string;
  defaultImageModel?: string;
  onBack: () => void;
  onSave: (updated: DesignStructure) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  onOpenSettings: () => void;
  projectName?: string;
}

// ── Image slot component ─────────────────────────────────────────────────────

interface ImageSlotProps {
  base64: string;
  prompt: string;
  genState: GenState;
  error?: string;
  isFavorite: boolean;
  onGenerate: () => void;
  onFavorite: () => void;
  onZoom?: () => void;
  size?: 'normal' | 'small';
}

const ImageSlot: React.FC<ImageSlotProps> = ({
  base64, prompt, genState, error, isFavorite, onGenerate, onFavorite, onZoom, size = 'normal',
}) => {
  const isSmall = size === 'small';
  return (
    <div
      className={`neo-card overflow-hidden flex flex-col ${isFavorite ? '' : ''}`}
      style={{ boxShadow: isFavorite ? `3px 3px 0 0 #fbbf24` : '3px 3px 0 0 #000', borderColor: isFavorite ? '#fbbf24' : undefined }}
    >
      {/* Image area */}
      <div className={`relative ${isSmall ? 'aspect-square' : 'aspect-square'} bg-brand-bg overflow-hidden flex-shrink-0`}>
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
      </div>

      {/* Footer */}
      <div className={`${isSmall ? 'p-1.5' : 'p-2.5'} flex-1 flex flex-col`}>
        <p className={`${isSmall ? 'text-[8px] min-h-[2em]' : 'text-[9px] min-h-[2.5em]'} text-brand-subtle line-clamp-2 leading-relaxed flex-1`}>
          {prompt}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <button
            onClick={onFavorite}
            disabled={!base64}
            className={`flex items-center gap-0.5 ${isSmall ? 'text-[8px]' : 'text-[9px]'} font-black uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isFavorite ? 'text-amber-400' : 'text-brand-subtle hover:text-amber-400'}`}
            title={isFavorite ? 'Remove hero' : 'Set as hero reference for subgroups'}
          >
            <StarIcon isFilled={isFavorite} className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
            {isFavorite ? 'Hero' : 'Star'}
          </button>
          {base64 && (
            <button
              onClick={onGenerate}
              disabled={genState === 'generating'}
              className="p-0.5 text-brand-subtle hover:text-brand-text transition-colors disabled:opacity-30"
              title="Regenerate"
            >
              <RefreshIcon className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
            </button>
          )}
        </div>
      </div>
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
  designStructure, theme, defaultImageModel, onBack, onSave, isDarkMode, setIsDarkMode, onOpenSettings, projectName,
}) => {
  const [structure, setStructure] = useState<DesignStructure>(() =>
    JSON.parse(JSON.stringify(designStructure))
  );
  const [selectedStyle, setSelectedStyle] = useState(IMAGE_STYLES[0].id);
  const [selectedModel, setSelectedModel] = useState(() => {
    const isValid = IMAGE_MODELS.some(m => m.id === defaultImageModel);
    return isValid ? (defaultImageModel ?? IMAGE_MODELS[0].id) : IMAGE_MODELS[0].id;
  });
  const [viewMode, setViewMode] = useState<'accordion' | 'grid'>('accordion');
  const [gridZoom, setGridZoom] = useState(120); // card width in px (167% default)
  const [genStates, setGenStates] = useState<Record<string, GenState>>({});
  const [genErrors, setGenErrors] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true });
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, boolean>>({});
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const structureRef = useRef(structure);

  useEffect(() => { structureRef.current = structure; }, [structure]);

  const generatingCount = Object.values(genStates).filter(s => s === 'generating').length;
  const isAnyGenerating = generatingCount > 0;

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
        prompt, selectedStyle, selectedModel, abortRef.current?.signal,
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
  }, [selectedStyle, selectedModel, onSave]);

  // ── Group image generation ───────────────────────────────────────────────

  const generateGroupImage = useCallback((gi: number, pi: number) => {
    const key = `g${gi}_${pi}`;
    const group = structureRef.current.groups[gi];
    const scenario = group.imagePrompts[pi];
    if (!scenario) return Promise.resolve();
    const prompt = `${group.title}. ${group.description}. Art direction: ${group.mood}. Scene: ${scenario.prompt}`;
    return doGenerate(key, prompt, (base64, prev) => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      s.groups[gi].imagePrompts[pi].base64Image = base64;
      return s;
    });
  }, [doGenerate]);

  // ── Subgroup image generation ────────────────────────────────────────────

  const generateSubgroupImage = useCallback((gi: number, si: number, pi: number) => {
    const key = `g${gi}_sg${si}_${pi}`;
    const group = structureRef.current.groups[gi];
    const favIdx = group.favoriteImagePromptIndex ?? 0;
    const favPrompt = group.imagePrompts[favIdx]?.prompt ?? '';
    const sg = group.subgroups[si];
    const scenario = sg.imagePrompts[pi];
    if (!scenario) return Promise.resolve();
    const prompt = `Setting: ${group.title} universe (reference: ${favPrompt}). Subgroup: ${sg.title}. ${sg.description}. Art direction: ${sg.mood}. Scene: ${scenario.prompt}`;
    return doGenerate(key, prompt, (base64, prev) => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      s.groups[gi].subgroups[si].imagePrompts[pi].base64Image = base64;
      return s;
    });
  }, [doGenerate]);

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
      return s;
    });
  }, []);

  const toggleSubFavorite = useCallback((gi: number, si: number, pi: number) => {
    setStructure(prev => {
      const s: DesignStructure = JSON.parse(JSON.stringify(prev));
      s.groups[gi].subgroups[si].favoriteImagePromptIndex =
        s.groups[gi].subgroups[si].favoriteImagePromptIndex === pi ? null : pi;
      structureRef.current = s;
      return s;
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">

          {/* Project badge */}
          {projectName && (
            <>
              <div
                className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary dark:bg-brand-primary text-brand-text"
                style={{ borderRadius: 1 }}
                title={`Project: ${projectName}`}
              >
                {projectName}
              </div>
              <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>
            </>
          )}

          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-brand-subtle hover:text-brand-text transition-colors group flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="text-xs font-black uppercase tracking-widest">Concept</span>
          </button>

          <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>

          <span
            className="text-xs font-black tracking-[0.12em] uppercase text-brand-subtle cursor-pointer hover:text-brand-text truncate max-w-[180px] transition-colors"
            onClick={onBack}
            title={theme}
          >
            {theme}
          </span>

          <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>

          <span className="text-xs font-black tracking-widest uppercase text-brand-primary dark:text-brand-primary">
            Images
          </span>

          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode
                ? <SunIcon className="w-4 h-4" />
                : <MoonIcon className="w-4 h-4" />}
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
      </header>

      {/* ── Controls bar ────────────────────────────────────────────────── */}
      <div className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-16 z-10">
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
                    onClick={() => setSelectedStyle(style.id)}
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
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="neo-input bg-brand-bg text-xs font-black text-brand-text outline-none cursor-pointer px-3 py-1.5 flex-shrink-0"
            >
              {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            {isAnyGenerating && (
              <span className="text-xs font-mono text-brand-subtle">{generatingCount} generating…</span>
            )}
            {!isAnyGenerating && totalGroupDone > 0 && (
              <span className="text-[10px] text-brand-subtle">{totalGroupDone}/{totalGroupSlots} ready</span>
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

          {/* RIGHT — view toggle + zoom + back */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-brand-surface text-brand-text hover:bg-brand-bg transition-colors"
              style={{ boxShadow: '2px 2px 0 #000', borderRadius: 1 }}
            >
              ← Concept
            </button>

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
      </div>

      {/* ── Groups ──────────────────────────────────────────────────────── */}
      <main className="flex-grow max-w-6xl mx-auto w-full px-6 py-6">

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

                    {/* ── Pair 0: group images (IMG 1 + IMG 2) ── */}
                    <div className={`flex gap-1 ${group.subgroups.length > 0 ? 'pr-2 mr-1 border-r-2 border-black/10' : ''}`}>
                      {group.imagePrompts.map((scenario, pi) => {
                        const key = `g${gi}_${pi}`;
                        const isFav = group.favoriteImagePromptIndex === pi;
                        return (
                          <div
                            key={key}
                            className="neo-card overflow-hidden flex-shrink-0"
                            style={{ width: gridZoom, boxShadow: isFav ? '2px 2px 0 0 #fbbf24' : '2px 2px 0 0 #000', borderColor: isFav ? '#fbbf24' : undefined }}
                          >
                            <div className="h-0.5 w-full" style={{ backgroundColor: color }} />
                            <div className="relative aspect-square w-full bg-brand-bg overflow-hidden">
                              {scenario.base64Image ? (
                                <img
                                  src={`data:image/jpeg;base64,${scenario.base64Image}`}
                                  alt=""
                                  className="w-full h-full object-cover cursor-zoom-in"
                                  onClick={() => setLightbox({ src: `data:image/jpeg;base64,${scenario.base64Image}`, label: `${group.title} · IMG ${pi + 1}` })}
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
                                <div className="absolute bottom-0 right-0 flex items-center gap-0.5 p-0.5 opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                                  <button onClick={() => toggleGroupFavorite(gi, pi)} className={`p-0.5 ${isFav ? 'text-amber-400' : 'text-white'}`}>
                                    <StarIcon isFilled={isFav} className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => generateGroupImage(gi, pi)} className="p-0.5 text-white">
                                    <RefreshIcon className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="px-1.5 py-1">
                              <p className="text-[8px] font-black text-brand-subtle/50 uppercase tracking-widest truncate">
                                IMG {pi + 1}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Pairs 1…N: one pair per subgroup (SG1·1+SG1·2, SG2·1+SG2·2 …) ── */}
                    {group.subgroups.map((sg, si) => {
                      const hasFav = group.favoriteImagePromptIndex !== null && group.favoriteImagePromptIndex !== undefined;
                      const isLastPair = si === group.subgroups.length - 1;
                      return (
                        <div
                          key={si}
                          className={`flex gap-1 ${!isLastPair ? 'pr-2 mr-1 border-r-2 border-black/10' : ''}`}
                        >
                          {sg.imagePrompts.map((imgS, pi) => {
                            const key = `g${gi}_sg${si}_${pi}`;
                            const isSgFav = sg.favoriteImagePromptIndex === pi;
                            return (
                              <div
                                key={key}
                                className="neo-card overflow-hidden flex-shrink-0"
                                style={{ width: gridZoom, boxShadow: '2px 2px 0 0 #000', opacity: hasFav ? 1 : 0.4 }}
                              >
                                <div className="h-0.5 w-full bg-black/10 dark:bg-brand-primary/20" />
                                <div className="relative aspect-square w-full bg-brand-bg overflow-hidden">
                                  {imgS.base64Image ? (
                                    <img
                                      src={`data:image/jpeg;base64,${imgS.base64Image}`}
                                      alt=""
                                      className="w-full h-full object-cover cursor-zoom-in"
                                      onClick={() => setLightbox({ src: `data:image/jpeg;base64,${imgS.base64Image}`, label: `${group.title} · ${sg.title} · SG${si + 1}·${pi + 1}` })}
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
                                    <div className="absolute bottom-0 right-0 flex items-center gap-0.5 p-0.5 opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                                      <button onClick={() => toggleSubFavorite(gi, si, pi)} className={`p-0.5 ${isSgFav ? 'text-amber-400' : 'text-white'}`}>
                                        <StarIcon isFilled={isSgFav} className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => generateSubgroupImage(gi, si, pi)} className="p-0.5 text-white">
                                        <RefreshIcon className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="px-1.5 py-1">
                                  <p className="text-[8px] font-black text-brand-subtle/40 uppercase tracking-widest truncate" title={sg.title}>
                                    SG{si + 1}·{pi + 1}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
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
                  <h2 className="text-sm font-black uppercase tracking-wide text-brand-text truncate">
                    {group.title}
                  </h2>
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
                  <div className="mt-4 grid grid-cols-2 gap-3">
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
                          onGenerate={() => generateGroupImage(gi, pi)}
                          onFavorite={() => toggleGroupFavorite(gi, pi)}
                          onZoom={scenario.base64Image ? () => setLightbox({ src: `data:image/jpeg;base64,${scenario.base64Image}`, label: `${group.title} · IMG ${pi + 1}` }) : undefined}
                        />
                      );
                    })}
                  </div>

                  {/* Subgroups section */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="neo-section-label">Subgroups</span>
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
                                        onGenerate={() => generateSubgroupImage(gi, si, pi)}
                                        onFavorite={() => toggleSubFavorite(gi, si, pi)}
                                        onZoom={imgS.base64Image ? () => setLightbox({ src: `data:image/jpeg;base64,${imgS.base64Image}`, label: `${group.title} · ${sg.title} · SG${si + 1}·${pi + 1}` }) : undefined}
                                        size="small"
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
              {lightbox.label}
            </span>
          </div>
        </div>
      )}

    </div>
  );
};

export default ImageStudio;
