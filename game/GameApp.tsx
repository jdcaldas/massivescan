import React from 'react';

interface GameAppProps {
  onBackToLauncher: () => void;
  projectName?: string;
}

const GameApp: React.FC<GameAppProps> = ({ onBackToLauncher, projectName }) => (
  <div className="min-h-screen bg-brand-bg flex flex-col">

    {/* ── Standard header ─────────────────────────────────────────────── */}
    <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10 flex-shrink-0">
      <div className="px-6 h-16 flex items-center gap-3">

        {/* Back */}
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
          <div
            className="w-7 h-7 border-2 border-black flex items-center justify-center text-base leading-none"
            style={{ backgroundColor: '#C8B6FF', borderRadius: 1 }}
          >🎮</div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-brand-subtle leading-none">Massive Scan</div>
            <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text">Game Management</div>
          </div>
        </div>

        {/* Decoration dots */}
        <div className="ml-auto flex gap-1.5 flex-shrink-0">
          {['#FF4F6D', '#FFE500', '#C8B6FF'].map(c => (
            <span key={c} className="w-2.5 h-2.5 border border-black/20 inline-block" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </header>

    {/* ── Content ─────────────────────────────────────────────────────── */}
    <main className="flex-grow flex flex-col items-center justify-center gap-6 p-12 text-center">
      <div
        className="w-20 h-20 border-2 border-black flex items-center justify-center text-4xl"
        style={{ backgroundColor: '#C8B6FF', boxShadow: '4px 4px 0 0 #000' }}
      >
        🎮
      </div>
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-brand-text">
          Game Management
        </h1>
        <p className="text-sm text-brand-subtle mt-2 max-w-xs">
          Rules, scoring systems, player flows and session management — coming soon.
        </p>
      </div>
      <div
        className="px-4 py-1.5 border-2 border-black text-[10px] font-black uppercase tracking-widest"
        style={{ backgroundColor: '#C8B6FF', boxShadow: '2px 2px 0 0 #000' }}
      >
        Planned
      </div>
    </main>

    {/* ── Footer ──────────────────────────────────────────────────────── */}
    <footer className="border-t-2 border-black px-8 py-3 flex items-center justify-between flex-shrink-0">
      <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">Massive Scan · Design System</span>
      <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">@jdcaldas 2026</span>
    </footer>
  </div>
);

export default GameApp;
