import React, { useState, useEffect } from 'react';
import type { ProjectMeta } from '../projectTypes';

type ModuleId = 'design' | 'cards' | 'game';

interface ModuleMeta {
  id: ModuleId;
  icon: string;
  title: string;
  subtitle: string;
  status: 'active' | 'planned';
  accentBg: string;
}

const MODULES: ModuleMeta[] = [
  {
    id: 'cards',
    icon: '🃏',
    title: 'Cards',
    subtitle: 'Physical Deck Config',
    status: 'active',
    accentBg: '#FFE500',
  },
  {
    id: 'design',
    icon: '🎨',
    title: 'Design',
    subtitle: 'Concept & Image Studio',
    status: 'active',
    accentBg: '#6EE7B7',
  },
  {
    id: 'game',
    icon: '🎮',
    title: 'Game',
    subtitle: 'Rules & Play Config',
    status: 'planned',
    accentBg: '#C8B6FF',
  },
];

interface ModuleCounts {
  cards: number | null;
  design: number | null;
}

interface ProjectHomeProps {
  project: ProjectMeta;
  onOpenModule: (id: ModuleId) => void;
  onBackToProjects: () => void;
}

const ProjectHome: React.FC<ProjectHomeProps> = ({ project, onOpenModule, onBackToProjects }) => {
  const [counts, setCounts] = useState<ModuleCounts>({ cards: null, design: null });

  useEffect(() => {
    const pid = project.id;

    Promise.all([
      fetch(`/api/projects/${pid}/cards/list`).then(r => r.json()).catch(() => null),
      fetch(`/api/projects/${pid}/worlds`).then(r => r.json()).catch(() => null),
    ]).then(([cardsRes, worldsRes]) => {
      setCounts({
        cards:  Array.isArray(cardsRes?.files)  ? cardsRes.files.length  : 0,
        design: Array.isArray(worldsRes)         ? worldsRes.length       : 0,
      });
    });
  }, [project.id]);

  const getStatusLine = (mod: ModuleMeta) => {
    if (mod.id === 'cards') {
      if (counts.cards === null) return { label: '…', empty: false };
      if (counts.cards === 0)   return { label: 'No decks',  empty: true };
      return { label: `${counts.cards} deck${counts.cards !== 1 ? 's' : ''}`, empty: false };
    }
    if (mod.id === 'design') {
      if (counts.design === null) return { label: '…', empty: false };
      if (counts.design === 0)   return { label: 'No concepts', empty: true };
      return { label: `${counts.design} concept${counts.design !== 1 ? 's' : ''}`, empty: false };
    }
    return { label: 'Coming soon', empty: true };
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Top-level navigation header (dark) ─────────────────────────── */}
      <header className="border-b-2 border-black bg-brand-text text-brand-surface px-8 h-16 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-1.5 text-brand-surface/60 hover:text-brand-surface transition-colors group flex-shrink-0"
            title="Back to Projects"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="text-xs font-black uppercase tracking-widest">Projects</span>
          </button>
          <div className="w-px h-5 bg-brand-surface/20" />
          <div>
            {project.client && (
              <div className="text-[10px] font-black uppercase tracking-widest text-brand-surface/50 leading-none mb-0.5">
                {project.client}
              </div>
            )}
            <div className="text-base font-black uppercase tracking-tight leading-none">
              {project.name}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {['#6EE7B7', '#FFE500', '#FF4F6D'].map(c => (
            <span key={c} className="w-2.5 h-2.5 border border-white/20 inline-block" style={{ backgroundColor: c }} />
          ))}
        </div>
      </header>

      {/* Modules */}
      <main className="flex-grow flex flex-col items-center justify-center px-8 py-16">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-subtle mb-10">
          Select a module
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {MODULES.map(mod => {
            const disabled = mod.status === 'planned';
            const { label, empty } = getStatusLine(mod);
            return (
              <div
                key={mod.id}
                onClick={() => !disabled && onOpenModule(mod.id)}
                className={`neo-card flex flex-col overflow-hidden transition-all duration-100 ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:shadow-[6px_6px_0_0_#000]'
                }`}
              >
                <div className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: mod.accentBg }} />
                <div className="p-6 flex flex-col gap-4 flex-grow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 flex-shrink-0 border-2 border-black flex items-center justify-center text-2xl" style={{ backgroundColor: mod.accentBg }}>
                      {mod.icon}
                    </div>
                    {disabled && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-brand-bg text-brand-subtle/50 border border-brand-subtle/20">
                        Planned
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-tight leading-tight text-brand-text">{mod.title}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-subtle mt-0.5">{mod.subtitle}</p>
                  </div>

                  {/* Live status */}
                  <div className="flex-grow flex items-end">
                    <div
                      className="flex items-baseline gap-2 border-l-4 pl-3"
                      style={{ borderColor: empty ? '#CCCCCC' : mod.accentBg }}
                    >
                      <span
                        className="text-xl font-black uppercase tracking-tight leading-none"
                        style={{ color: empty ? '#BBBBBB' : '#1A1A1A' }}
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`px-6 py-3 border-t-2 border-black flex items-center justify-between flex-shrink-0 ${
                  disabled ? 'bg-brand-bg text-brand-subtle/30' : 'bg-brand-text text-brand-surface'
                }`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">{disabled ? 'Coming soon' : 'Open'}</span>
                  {!disabled && <span className="font-black">→</span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="border-t-2 border-black px-8 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">Massive Scan · Design System</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">@jdcaldas 2026</span>
      </footer>
    </div>
  );
};

export default ProjectHome;
