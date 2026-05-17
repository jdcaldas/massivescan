
import React, { useState } from 'react';
import { UploadIcon, DownloadIcon, TrashIcon, SparklesIcon, ChevronUpIcon, ChevronDownIcon, HelpIcon, SunIcon, MoonIcon } from './icons';
import type { ApiStats, DesignStructure } from '../types';
import EditableText from './EditableText';

interface HeaderProps {
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
  onOpenHelp: () => void;
  isGenerating: boolean;
  genProgress: { step: number; total: number; label: string } | null;
  canExport: boolean;
  apiStats: ApiStats;
  language: string;
  setLanguage: (lang: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({
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
  onOpenHelp,
  isGenerating,
  genProgress,
  canExport,
  language,
  setLanguage,
  isDarkMode,
  setIsDarkMode,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <header className="bg-brand-surface border-b border-brand-secondary sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6">

        {/* Top bar */}
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-5">
            <div>
              <h1 className="text-base font-bold tracking-[0.12em] uppercase text-brand-text leading-none">
                Massive Scan
                <span className="ml-2 font-light text-brand-subtle">Design System</span>
              </h1>
              {!isCollapsed && (
                <p className="text-[11px] text-brand-subtle mt-1 leading-snug max-w-md">
                  Enter a theme to generate a full game design bible — 7 thematic groups with subgroups, art direction &amp; image prompts, ready for production.
                </p>
              )}
            </div>
            {isCollapsed && theme && (
              <span className="text-xs text-brand-subtle bg-brand-bg border border-brand-secondary px-2.5 py-1 rounded truncate max-w-[200px]">
                {theme}
              </span>
            )}
          </div>

          <div className="flex items-center flex-shrink-0">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-xs text-brand-subtle outline-none cursor-pointer hover:text-brand-text transition-colors px-2 py-2"
              title="Language"
            >
              <option value="English">EN</option>
              <option value="Portuguese">PT</option>
              <option value="Spanish">ES</option>
            </select>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-md text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-md text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title="About"
            >
              <HelpIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-md text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible section */}
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-80 opacity-100'}`}>
          <div className="pb-5">

            {/* Input + Generate */}
            <div className="flex gap-2.5">
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && theme.trim() && onGenerate()}
                placeholder="Enter a theme… (e.g. Futuristic Egypt, Space Pirates)"
                className="flex-1 bg-brand-bg border border-brand-secondary text-brand-text text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-brand-primary placeholder:text-brand-subtle/40 transition-colors"
                disabled={isGenerating}
              />
              <button
                onClick={onGenerate}
                disabled={isGenerating || !theme.trim()}
                className="px-5 py-2.5 bg-brand-primary text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity whitespace-nowrap min-w-[130px] justify-center"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                    {genProgress ? `${genProgress.step}/${genProgress.total}` : 'Generating…'}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Generate
                  </>
                )}
              </button>
            </div>

            {/* Theme description */}
            <textarea
              value={themeDescription}
              onChange={(e) => setThemeDescription(e.target.value)}
              placeholder="Theme context will appear here…"
              className="mt-2 w-full bg-brand-bg border border-brand-secondary text-brand-subtle text-xs rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary resize-none transition-colors"
              rows={2}
              disabled={isGenerating}
            />

            {/* Progress bar */}
            {isGenerating && genProgress && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-brand-subtle">{genProgress.label}</span>
                  <span className="text-[10px] font-mono text-brand-subtle/50">
                    {genProgress.step} of {genProgress.total}
                  </span>
                </div>
                <div className="h-0.5 bg-brand-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(genProgress.step / genProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions row */}
            <div className="mt-3 flex items-center">
              {designStructure && (
                <div className="flex items-center gap-2 text-xs text-brand-subtle mr-auto overflow-hidden">
                  <EditableText
                    as="span"
                    value={designStructure.icon}
                    onChange={(value) => onUpdate(null, 'icon', value)}
                    className="font-medium text-brand-text"
                    inputClassName="bg-transparent border-brand-primary"
                  />
                  <span className="text-brand-secondary">·</span>
                  <EditableText
                    as="span"
                    value={designStructure.visualStyle}
                    onChange={(value) => onUpdate(null, 'visualStyle', value)}
                    className="truncate max-w-xs"
                    inputClassName="bg-transparent border-brand-primary"
                  />
                </div>
              )}
              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={onImport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-subtle hover:text-brand-text hover:bg-brand-bg rounded-md transition-colors"
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  Import
                </button>
                <button
                  onClick={onExport}
                  disabled={!canExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-subtle hover:text-brand-text hover:bg-brand-bg rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  Export
                </button>
                <button
                  onClick={onClear}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </header>
  );
};

export default Header;
