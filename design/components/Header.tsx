
import React, { useState } from 'react';
import { UploadIcon, DownloadIcon, TrashIcon, SparklesIcon, ChevronUpIcon, ChevronDownIcon, HelpIcon, SunIcon, MoonIcon, SaveIcon, TranslateIcon, SettingsIcon, ImageIcon, ChartBarIcon } from './icons';
import type { ApiStats, DesignStructure } from '../types';
import EditableText from './EditableText';

interface HeaderProps {
  onBackToHome: () => void;
  activeWorldName: string | null;
  projectName?: string;
  theme: string;
  setTheme: (theme: string) => void;
  themeDescription: string;
  setThemeDescription: (description: string) => void;
  designStructure: DesignStructure | null;
  onGenerate: () => void;
  onImport: () => void;
  onExport: () => void;
  onClear: () => void;
  onUpdate: (groupIndex: number | null, field: string, value: any, subIndex?: number, subField?: string, itemIndex?: number, itemProperty?: 'prompt') => void;
  onSave: () => void;
  onGoToImages?: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  isGenerating: boolean;
  genProgress: { step: number; total: number; label: string } | null;
  canExport: boolean;
  apiStats: ApiStats;
  language: string;
  setLanguage: (lang: string) => void;
  autoAdaptTheme: boolean;
  setAutoAdaptTheme: (v: boolean) => void;
  isAdaptingTheme: boolean;
  onCancel: () => void;
  onTranslate: (targetLang: string) => void;
  isTranslating: boolean;
  onRegenerateAllSubgroups?: () => void;
  onOpenUsage?: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  defaultTranslateTo?: string;
}

const LANGUAGES = [
  { value: 'English', label: 'English (EN)' },
  { value: 'Portuguese', label: 'Portuguese (PT)' },
  { value: 'Spanish', label: 'Spanish (ES)' },
  { value: 'French', label: 'French (FR)' },
  { value: 'German', label: 'German (DE)' },
  { value: 'Italian', label: 'Italian (IT)' },
];

const Header: React.FC<HeaderProps> = ({
  onBackToHome,
  activeWorldName,
  projectName,
  theme,
  setTheme,
  themeDescription,
  setThemeDescription,
  designStructure,
  onGenerate,
  onImport,
  onExport,
  onClear,
  onUpdate,
  onSave,
  onGoToImages,
  onOpenHelp,
  onOpenSettings,
  isGenerating,
  genProgress,
  canExport,
  language,
  setLanguage,
  autoAdaptTheme,
  setAutoAdaptTheme,
  isAdaptingTheme,
  isDarkMode,
  setIsDarkMode,
  defaultTranslateTo,
  onCancel,
  onTranslate,
  isTranslating,
  onRegenerateAllSubgroups,
  onOpenUsage,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [descExpanded, setDescExpanded] = useState(true);
  const [translateTo, setTranslateTo] = useState(defaultTranslateTo ?? 'Portuguese');

  return (
    <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6">

        {/* Top bar */}
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            {/* Back to worlds */}
            <button
              onClick={onBackToHome}
              className="flex items-center gap-1.5 text-brand-subtle hover:text-brand-text transition-colors group flex-shrink-0"
              title="Back to Worlds"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest">Concepts</span>
            </button>

            {/* Project badge */}
            {projectName && (
              <>
                <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>
                <div
                  className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary dark:bg-brand-primary text-brand-text"
                  style={{ borderRadius: 1 }}
                  title={`Project: ${projectName}`}
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
                <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text truncate max-w-[180px]" title={activeWorldName ?? 'Design System'}>
                  {activeWorldName ?? 'Design System'}
                </div>
              </div>
            </div>

            {isCollapsed && theme && !activeWorldName && (
              <span className="neo-input text-xs text-brand-subtle px-2.5 py-1 bg-brand-bg">
                {theme}
              </span>
            )}
          </div>


          <div className="flex items-center flex-shrink-0 gap-0.5">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            {onOpenUsage && (
              <button
                onClick={onOpenUsage}
                className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
                title="API Usage"
              >
                <ChartBarIcon className="w-4 h-4" />
              </button>
            )}
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
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
            <div className="flex gap-1.5 ml-1 pl-2 border-l border-black/10 dark:border-brand-primary/20">
              {['#6EE7B7', '#FFE500', '#FF4F6D'].map(c => (
                <span key={c} className="w-2.5 h-2.5 border border-black/20 dark:border-brand-primary/20 inline-block" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* Collapsible section */}
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-80 opacity-100'}`}>
          <div className="pb-5">

            {/* Input + Generate */}
            <div className="flex gap-3 items-center">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="neo-input bg-brand-bg text-sm font-black text-brand-text outline-none cursor-pointer px-3 py-2.5 flex-shrink-0"
                title="Generation language"
              >
                <option value="English">EN</option>
                <option value="Portuguese">PT</option>
                <option value="Spanish">ES</option>
                <option value="French">FR</option>
                <option value="Italian">IT</option>
              </select>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isGenerating && theme.trim() && onGenerate()}
                  placeholder="Enter a theme… (e.g. Futuristic Egypt, Space Pirates)"
                  className="neo-input w-full bg-brand-bg text-brand-text text-sm px-4 py-2.5 pr-24 placeholder:text-brand-subtle/40"
                  disabled={isGenerating || isAdaptingTheme}
                />
                {/* Auto-adapt toggle */}
                <button
                  onClick={() => setAutoAdaptTheme(!autoAdaptTheme)}
                  title={autoAdaptTheme ? 'Auto-adapt title ON — changing language will translate the theme' : 'Auto-adapt title OFF'}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary transition-colors ${autoAdaptTheme ? 'bg-brand-text text-brand-surface' : 'bg-brand-surface text-brand-subtle'}`}
                  style={{ borderRadius: 1 }}
                >
                  {isAdaptingTheme ? (
                    <div className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <TranslateIcon className="w-2.5 h-2.5" />
                  )}
                  Auto
                </button>
              </div>
              {!canExport && (
                <button
                  onClick={onGenerate}
                  disabled={isGenerating || !theme.trim()}
                  className="neo-btn bg-brand-text text-brand-surface px-5 py-2.5 text-sm flex items-center gap-2 whitespace-nowrap min-w-[130px] justify-center"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-brand-surface/30 border-t-brand-surface rounded-full animate-spin flex-shrink-0" />
                      {genProgress ? `${genProgress.step}/${genProgress.total}` : 'Generating…'}
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-3.5 h-3.5" />
                      Generate
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Theme description */}
            <div className="mt-2 relative">
              <textarea
                value={themeDescription}
                onChange={(e) => setThemeDescription(e.target.value)}
                placeholder="Theme context will appear here…"
                className="neo-input w-full bg-brand-bg text-brand-subtle text-xs px-4 py-2 pr-16 resize-none focus:outline-none transition-[height] duration-200"
                rows={descExpanded ? 4 : 2}
                disabled={isGenerating}
              />
              {themeDescription && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="absolute right-2 top-2 flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-subtle hover:text-brand-text border border-black/20 dark:border-brand-primary/30 hover:border-black dark:hover:border-brand-primary bg-brand-bg transition-colors"
                  style={{ borderRadius: 1 }}
                  title={descExpanded ? 'Collapse' : 'Expand'}
                >
                  {descExpanded
                    ? <><ChevronUpIcon className="w-2.5 h-2.5" />Less</>
                    : <><ChevronDownIcon className="w-2.5 h-2.5" />More</>
                  }
                </button>
              )}
            </div>

            {/* Progress bar */}
            {isGenerating && genProgress && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-text">{genProgress.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-brand-subtle/50">
                      {genProgress.step} of {genProgress.total}
                    </span>
                    <button
                      onClick={onCancel}
                      className="neo-btn px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-red-500 text-white"
                      style={{ boxShadow: '2px 2px 0 0 #7f1d1d' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="h-1 bg-brand-secondary border border-black dark:border-brand-primary rounded-none overflow-hidden">
                  <div
                    className="h-full bg-brand-text dark:bg-brand-primary rounded-none transition-all duration-700 ease-out"
                    style={{ width: `${(genProgress.step / genProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions row */}
            {onGoToImages && canExport && (
              <div className="mt-3 flex items-center">
                <button
                  onClick={onGoToImages}
                  disabled={isGenerating}
                  className="flex items-center gap-3 border-2 border-black px-6 py-2.5 text-sm font-black uppercase tracking-widest text-brand-text hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#6EE7B7', boxShadow: '4px 4px 0 #000', borderRadius: 1 }}
                >
                  <ImageIcon className="w-4 h-4" />
                  Advance for Design →
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;
