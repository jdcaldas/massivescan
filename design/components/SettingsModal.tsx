
import React from 'react';
import type { AppSettings } from '../types';
import { XIcon } from './icons';
import { IMAGE_MODELS } from '../services/imageGenService';

interface SettingsModalProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
  availableModels: { id: string; name: string }[];
}

const LANGUAGES = [
  { value: 'English',    label: 'English (EN)' },
  { value: 'Portuguese', label: 'Portuguese (PT)' },
  { value: 'Spanish',    label: 'Spanish (ES)' },
  { value: 'French',     label: 'French (FR)' },
  { value: 'Italian',    label: 'Italian (IT)' },
];

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex items-center justify-between gap-6 py-4 border-b-2 border-black/10 dark:border-brand-primary/20 last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-black uppercase tracking-wide text-brand-text">{label}</p>
      {hint && <p className="text-[11px] text-brand-subtle mt-0.5 leading-snug">{hint}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const NeoSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => (
  <select
    className={`neo-input bg-brand-bg text-sm font-bold text-brand-text outline-none cursor-pointer px-3 py-2 ${className}`}
    {...props}
  />
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-12 h-6 border-2 border-black dark:border-brand-primary flex items-center transition-colors ${checked ? 'bg-brand-text justify-end' : 'bg-brand-surface justify-start'}`}
    style={{ borderRadius: 1 }}
  >
    <span
      className={`w-5 h-5 border-2 border-black dark:border-brand-primary ${checked ? 'bg-brand-surface' : 'bg-brand-text'} m-px`}
      style={{ borderRadius: 1 }}
    />
  </button>
);

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onChange, onClose, availableModels }) => {
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="neo-card bg-brand-surface w-full max-w-lg flex flex-col" style={{ borderWidth: 2 }}>

        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-black dark:border-brand-primary flex items-center justify-between flex-shrink-0 bg-brand-secondary dark:bg-brand-secondary/20">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-brand-text">Settings</h2>
            <p className="text-xs text-brand-subtle mt-0.5">Defaults applied on every new session</p>
          </div>
          <button onClick={onClose} className="neo-btn p-1.5 bg-brand-surface hover:bg-brand-bg">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 flex-grow">

          <div className="neo-section-label mt-5 mb-1">Generation</div>

          <Row label="Default Language" hint="Language used when generating new designs">
            <NeoSelect value={settings.defaultLanguage} onChange={e => set('defaultLanguage', e.target.value)}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </NeoSelect>
          </Row>

          <Row label="Default World Model" hint="Gemini model used for generating worlds and groups">
            <NeoSelect value={settings.defaultModel} onChange={e => set('defaultModel', e.target.value)}>
              {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </NeoSelect>
          </Row>

          <Row label="Default Image Model" hint="Model used in the Image Studio for generating art">
            <NeoSelect value={settings.defaultImageModel} onChange={e => set('defaultImageModel', e.target.value)}>
              {IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </NeoSelect>
          </Row>

          <div className="neo-section-label mt-5 mb-1">Theme Input</div>

          <Row label="Auto-Adapt Theme" hint="Translate the theme title when switching language">
            <Toggle checked={settings.autoAdaptTheme} onChange={v => set('autoAdaptTheme', v)} />
          </Row>

          <Row label="Default Translate To" hint="Pre-selected language in the Translate button">
            <NeoSelect value={settings.defaultTranslateTo} onChange={e => set('defaultTranslateTo', e.target.value)}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </NeoSelect>
          </Row>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 mt-4 border-t-2 border-black/10 dark:border-brand-primary/20 bg-brand-bg">
          <p className="text-[10px] text-brand-subtle/60 font-medium">
            Saved automatically · <span className="font-mono">archive/massivescan_settings.json</span>
          </p>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
