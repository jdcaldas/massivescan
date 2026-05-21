
import React, { useState, useRef, useEffect } from 'react';
import type { WorldMeta } from '../types';
import { SparklesIcon, PencilIcon, TrashIcon, LockClosedIcon, LockOpenIcon, DownloadIcon, SettingsIcon, HelpIcon, GridIcon, ListIcon, ChartBarIcon } from './icons';

interface HomePageProps {
  savedDesigns: WorldMeta[];
  onCreateNew: () => void;
  onLoadWorld: (meta: WorldMeta) => void;
  onDeleteWorld: (id: string) => void;
  onRenameWorld: (id: string, newTheme: string) => void;
  onToggleLock: (id: string) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenUsage: () => void;
  onOpenModelTest?: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  onBackToLauncher?: () => void;
  projectName?: string;
}

const CARD_COLORS = ['#6EE7B7', '#93C5FD', '#FDE68A', '#FCA5A5', '#C4B5FD', '#F9A8D4', '#A5F3FC'];

const LANG_BADGE: Record<string, string> = {
  English: 'EN', Portuguese: 'PT', Spanish: 'ES',
  French: 'FR', German: 'DE', Italian: 'IT',
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const InlineRename: React.FC<{ value: string; onCommit: (v: string) => void; onCancel: () => void }> = ({ value, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = () => { const v = draft.trim(); if (v && v !== value) onCommit(v); else onCancel(); };
  return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
      className="neo-input text-xl font-black uppercase tracking-wide text-brand-text bg-brand-bg px-2 py-0.5 w-full focus:outline-none"
    />
  );
};

const HomePage: React.FC<HomePageProps> = ({
  savedDesigns,
  onCreateNew,
  onLoadWorld,
  onDeleteWorld,
  onRenameWorld,
  onToggleLock,
  onOpenSettings,
  onOpenHelp,
  onOpenUsage,
  onOpenModelTest,
  isDarkMode,
  setIsDarkMode,
  onBackToLauncher,
  projectName,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = savedDesigns.filter(d =>
    d.theme.toLowerCase().includes(search.toLowerCase()) ||
    (d.themeDescription ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async (meta: WorldMeta) => {
    const res = await fetch(`/api/worlds/${meta.id}`).catch(() => null);
    if (!res?.ok) return;
    const design = await res.json();
    const dataStr = JSON.stringify(design.data ?? design, null, 2);
    const link = document.createElement('a');
    link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    link.download = `GDESIGN_${meta.theme.replace(/\s+/g, '_').toLowerCase()}.json`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Standard header ─────────────────────────────────────────────── */}
      <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary flex-shrink-0 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">

          {/* Back */}
          {onBackToLauncher && (
            <button
              onClick={onBackToLauncher}
              className="flex items-center gap-1.5 text-brand-subtle hover:text-brand-text transition-colors group flex-shrink-0"
              title="Back to Project"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest">Menu</span>
            </button>
          )}

          {/* Project badge */}
          {projectName && (
            <>
              <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>
              <div
                className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary dark:bg-brand-primary text-brand-text"
                style={{ borderRadius: 1 }}
              >
                {projectName}
              </div>
            </>
          )}

          <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>

          {/* Module identity */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-brand-subtle leading-none">Massive Scan</div>
              <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text">Design System</div>
            </div>
          </div>

          {/* Step indicator */}
{/* Right actions */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                {isDarkMode
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                }
              </svg>
            </button>
            {onOpenModelTest && (
              <button
                onClick={onOpenModelTest}
                className="flex items-center gap-1.5 px-2.5 py-1 border-2 border-black text-[10px] font-black uppercase tracking-widest text-brand-text hover:bg-brand-bg transition-colors"
                style={{ borderRadius: 1, boxShadow: '2px 2px 0 #000' }}
                title="Test image generation models"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                Model Test
              </button>
            )}
            <button
              onClick={onOpenUsage}
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
            <button
              onClick={onOpenHelp}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title="About"
            >
              <HelpIcon className="w-4 h-4" />
            </button>
            <div className="flex gap-1.5 ml-1 pl-2 border-l border-black/10 dark:border-brand-primary/20">
              {['#6EE7B7', '#FFE500', '#FF4F6D'].map(c => (
                <span key={c} className="w-2.5 h-2.5 border border-black/20 dark:border-brand-primary/20 inline-block" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`flex-grow mx-auto w-full px-8 py-10 ${viewMode === 'grid' ? 'max-w-6xl' : 'max-w-4xl'}`}>

        {savedDesigns.length === 0 ? (

          /* Empty state */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
            <div className="neo-card w-20 h-20 flex items-center justify-center bg-brand-surface">
              <SparklesIcon className="w-8 h-8 text-brand-text" />
            </div>
            <div>
              <p className="text-2xl font-black uppercase tracking-widest text-brand-text">Your creative universe starts here</p>
              <p className="text-sm text-brand-subtle mt-2">Create your first concept — a full game design bible in seconds.</p>
            </div>
            <button
              onClick={onCreateNew}
              className="neo-btn flex items-center gap-2 px-8 py-3 text-base font-black bg-brand-text text-brand-surface"
            >
              <SparklesIcon className="w-4 h-4" />
              Create New Concept
            </button>
          </div>

        ) : (

          /* Worlds list/grid */
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={onCreateNew}
                  className="flex items-center gap-1.5 border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-brand-text text-brand-surface hover:opacity-90 transition-opacity"
                  style={{ boxShadow: '2px 2px 0 #000', borderRadius: 1 }}
                >
                  <SparklesIcon className="w-3 h-3" />
                  New Concept
                </button>
                <span className="neo-section-label text-brand-subtle">Your Concepts</span>
                <span className="text-[10px] font-black bg-brand-text text-brand-surface px-1.5 py-0.5 rounded-full">
                  {savedDesigns.length}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {savedDesigns.length > 4 && (
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search designs…"
                    className="neo-input text-xs bg-brand-surface text-brand-text px-3 py-1.5 w-44 placeholder:text-brand-subtle/40 focus:outline-none"
                  />
                )}
                {/* View toggle */}
                <div className="flex items-stretch border-2 border-black dark:border-brand-primary overflow-hidden" style={{ boxShadow: '2px 2px 0 0 #000' }}>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2.5 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-brand-text text-brand-surface' : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'}`}
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

            {/* LIST VIEW */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {filtered.map((design, idx) => {
                  const color = CARD_COLORS[idx % CARD_COLORS.length];
                  const isRenaming = renamingId === design.id;
                  const isConfirmDelete = confirmDeleteId === design.id;
                  const langBadge = design.language
                    ? (LANG_BADGE[design.language] ?? design.language.slice(0, 2).toUpperCase())
                    : null;

                  return (
                    <div
                      key={design.id}
                      className="group neo-card flex bg-brand-surface overflow-hidden transition-colors hover:bg-brand-bg"
                      style={{ boxShadow: '4px 4px 0 0 #000' }}
                    >
                      <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-black text-brand-subtle/50 tracking-widest">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            {isRenaming ? (
                              <div className="mt-0.5">
                                <InlineRename
                                  value={design.theme}
                                  onCommit={v => { onRenameWorld(design.id, v); setRenamingId(null); }}
                                  onCancel={() => setRenamingId(null)}
                                />
                              </div>
                            ) : (
                              <h2
                                className="text-xl font-black uppercase tracking-wide text-brand-text truncate mt-0.5 cursor-pointer"
                                onClick={() => onLoadWorld(design)}
                              >
                                {design.theme}
                                {design.locked && <LockClosedIcon className="inline-block w-4 h-4 text-amber-500 ml-2 align-middle" />}
                              </h2>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-xs text-brand-subtle font-medium">{design.groupCount} groups</span>
                              {langBadge && (
                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary text-brand-text leading-none">
                                  {langBadge}
                                </span>
                              )}
                              <span className="text-xs text-brand-subtle">· {formatDate(design.savedAt)}</span>
                            </div>
                            {design.themeDescription && (
                              <p className="text-xs text-brand-subtle/70 mt-2 line-clamp-2 leading-relaxed max-w-xl">
                                {design.themeDescription}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                            {!design.locked && !isRenaming && (
                              <button onClick={() => { setRenamingId(design.id); setConfirmDeleteId(null); }} className="p-1.5 text-brand-subtle hover:text-brand-text transition-colors opacity-0 group-hover:opacity-100" title="Rename">
                                <PencilIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => handleExport(design)} className="p-1.5 text-brand-subtle hover:text-brand-text transition-colors opacity-0 group-hover:opacity-100" title="Export JSON">
                              <DownloadIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => { onToggleLock(design.id); setConfirmDeleteId(null); }} className={`p-1.5 transition-colors ${design.locked ? 'text-amber-500' : 'text-brand-subtle hover:text-amber-500 opacity-0 group-hover:opacity-100'}`} title={design.locked ? 'Unlock' : 'Lock'}>
                              {design.locked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                            </button>
                            {!design.locked && (
                              isConfirmDelete ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-red-500">Delete?</span>
                                  <button onClick={() => { onDeleteWorld(design.id); setConfirmDeleteId(null); }} className="neo-btn px-2 py-1 text-[10px] font-black text-white bg-red-500" style={{ boxShadow: '2px 2px 0 0 #7f1d1d' }}>Yes</button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="neo-btn px-2 py-1 text-[10px] font-bold text-brand-subtle bg-brand-surface" style={{ boxShadow: '2px 2px 0 0 #000' }}>No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteId(design.id)} className="p-1.5 text-brand-subtle hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )
                            )}
                            <button onClick={() => onLoadWorld(design)} className="neo-btn ml-2 px-4 py-2 text-sm font-black bg-brand-text text-brand-surface whitespace-nowrap" style={{ boxShadow: '3px 3px 0 0 #000' }}>
                              Open Concept →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* GRID VIEW */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((design, idx) => {
                  const color = CARD_COLORS[idx % CARD_COLORS.length];
                  const isRenaming = renamingId === design.id;
                  const isConfirmDelete = confirmDeleteId === design.id;
                  const langBadge = design.language
                    ? (LANG_BADGE[design.language] ?? design.language.slice(0, 2).toUpperCase())
                    : null;

                  return (
                    <div
                      key={design.id}
                      className="group neo-card flex flex-col bg-brand-surface overflow-hidden transition-colors hover:bg-brand-bg"
                      style={{ boxShadow: '3px 3px 0 0 #000' }}
                    >
                      {/* Color strip top */}
                      <div className="h-1.5 flex-shrink-0 w-full" style={{ backgroundColor: color }} />

                      {/* Card body */}
                      <div
                        className="flex-1 p-4 cursor-pointer"
                        onClick={() => !isRenaming && onLoadWorld(design)}
                      >
                        <span className="text-[9px] font-black text-brand-subtle/40 tracking-widest">
                          {String(idx + 1).padStart(2, '0')}
                        </span>

                        {isRenaming ? (
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            <InlineRename
                              value={design.theme}
                              onCommit={v => { onRenameWorld(design.id, v); setRenamingId(null); }}
                              onCancel={() => setRenamingId(null)}
                            />
                          </div>
                        ) : (
                          <h2 className="text-sm font-black uppercase tracking-wide text-brand-text line-clamp-2 mt-0.5 leading-snug">
                            {design.theme}
                          </h2>
                        )}

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {langBadge && (
                            <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary text-brand-text leading-none">
                              {langBadge}
                            </span>
                          )}
                          {design.locked && <LockClosedIcon className="w-3 h-3 text-amber-500" />}
                          <span className="text-[10px] text-brand-subtle">{formatDate(design.savedAt)}</span>
                        </div>

                        <p className="text-[10px] text-brand-subtle/60 mt-1.5 line-clamp-2 leading-relaxed">
                          {design.groupCount} groups
                          {design.themeDescription ? ` · ${design.themeDescription}` : ''}
                        </p>
                      </div>

                      {/* Card footer actions */}
                      <div className="border-t-2 border-black/10 dark:border-brand-primary/20 px-3 py-2 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!design.locked && !isRenaming && (
                            <button onClick={e => { e.stopPropagation(); setRenamingId(design.id); setConfirmDeleteId(null); }} className="p-1 text-brand-subtle hover:text-brand-text transition-colors" title="Rename">
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); onToggleLock(design.id); }} className={`p-1 transition-colors ${design.locked ? 'text-amber-500 opacity-100' : 'text-brand-subtle hover:text-amber-500'}`} title={design.locked ? 'Unlock' : 'Lock'}>
                            {design.locked ? <LockClosedIcon className="w-3.5 h-3.5" /> : <LockOpenIcon className="w-3.5 h-3.5" />}
                          </button>
                          {!design.locked && (
                            isConfirmDelete ? (
                              <div className="flex items-center gap-1">
                                <button onClick={e => { e.stopPropagation(); onDeleteWorld(design.id); setConfirmDeleteId(null); }} className="neo-btn px-1.5 py-0.5 text-[9px] font-black text-white bg-red-500" style={{ boxShadow: '1px 1px 0 0 #7f1d1d' }}>Del</button>
                                <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }} className="text-[9px] font-bold text-brand-subtle">✕</button>
                              </div>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(design.id); }} className="p-1 text-brand-subtle hover:text-red-500 transition-colors" title="Delete">
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); onLoadWorld(design); }}
                          className="neo-btn px-3 py-1 text-[11px] font-black bg-brand-text text-brand-surface ml-auto"
                          style={{ boxShadow: '2px 2px 0 0 #000' }}
                        >
                          Open →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.length === 0 && search && (
              <div className="py-16 text-center text-sm text-brand-subtle">
                No designs matching <strong>"{search}"</strong>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-black px-8 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">Massive Scan · Design System</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Auto-save on" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">@jdcaldas 2026</span>
      </footer>

    </div>
  );
};

export default HomePage;
