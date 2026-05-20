import React, { useState, useCallback } from 'react';
import type { DesignStructure, ImageScenario, Group } from '../types';
import {
  ChevronDownIcon, ChevronUpIcon,
  SunIcon, MoonIcon, SettingsIcon, ChartBarIcon,
} from './icons';
import UsageDashboard from './UsageDashboard';

// ── Tier colours (must match ImageStudio + deckTypeMeta) ──────────────────────

const CARD_COLORS = [
  '#FDE68A', // 01: Yellow
  '#86EFAC', // 02: Green
  '#7DD3FC', // 03: Blue
  '#F0ABFC', // 04: Magenta
  '#C4B5FD', // 05: Power-ups
  '#4B5563', // 06: Utility
];

// ── Group type metadata ───────────────────────────────────────────────────────

const GROUP_TYPE_LABEL: Record<string, string> = {
  'Grupo A':                 'Group 1 · Yellow',
  'Grupo B':                 'Group 2 · Green',
  'Grupo C':                 'Group 3 · Blue',
  'Grupo D':                 'Group 4 · Magenta',
  'Grupo Power-ups':         'Power-ups',
  'Grupo Extra/Utilitários': 'Utility',
};

// Full card config is available for these types only
const GAME_CARD_TYPES = new Set(['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D']);

// ── Front element meta (position badges) ─────────────────────────────────────

const ELEM_META: Record<string, { bg: string; fg: string; label: string }> = {
  qrCodePosition:   { bg: '#1A1A1A', fg: '#6EE7B7', label: 'QR' },
  number_Position:  { bg: '#93C5FD', fg: '#1A1A1A', label: '#'  },
  boxColorPosition: { bg: '#C8B6FF', fg: '#1A1A1A', label: 'B'  },
  letter_Position:  { bg: '#FF4F6D', fg: '#fff',    label: 'L'  },
};

// ── Layout presets ────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  label: string;
  desc: string;
  values: Partial<Record<string, string>>;
}

const PRESETS: Preset[] = [
  {
    id: '5elem',
    label: '5 Elements',
    desc: 'QR · # · Cor · Letra · Power',
    values: { qrCodePosition: 'BL', number_Position: 'BR', boxColorPosition: 'TL', letter_Position: 'TR', powerPosition: 'center' },
  },
  {
    id: '4elem',
    label: '4 Elements',
    desc: 'QR · # · Cor · Power',
    values: { qrCodePosition: 'BL', number_Position: 'TR', boxColorPosition: 'TL', letter_Position: 'none', powerPosition: 'center' },
  },
  {
    id: '3elem',
    label: '3 Elements',
    desc: 'QR · Letra · Power',
    values: { qrCodePosition: 'BL', number_Position: 'none', boxColorPosition: 'none', letter_Position: 'TR', powerPosition: 'center' },
  },
];

function detectPreset(p: ImageScenario): string | null {
  for (const pr of PRESETS) {
    const match = Object.entries(pr.values).every(([k, v]) => (p as Record<string, unknown>)[k] === v);
    if (match) return pr.id;
  }
  const anySet = ['qrCodePosition', 'number_Position', 'boxColorPosition', 'letter_Position'].some(
    k => (p as Record<string, unknown>)[k] && (p as Record<string, unknown>)[k] !== 'none',
  );
  return anySet ? 'custom' : null;
}

// ── Mini card face (visual preview of layout) ─────────────────────────────────

const MiniCardFront: React.FC<{ scenario: ImageScenario; color: string }> = ({ scenario, color }) => {
  const corners: Record<string, { bg: string; fg: string; label: string } | null> = { TL: null, TR: null, BL: null, BR: null };
  Object.entries(ELEM_META).forEach(([key, meta]) => {
    const pos = (scenario as Record<string, unknown>)[key] as string;
    if (pos && pos !== 'none') corners[pos] = meta;
  });

  return (
    <div className="relative border-2 border-black/30 overflow-hidden flex-shrink-0"
      style={{ width: 64, height: 86, borderRadius: 2 }}
    >
      {scenario.base64Image ? (
        <img src={`data:image/jpeg;base64,${scenario.base64Image}`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: color + '40' }} />
      )}
      {/* Corner badges */}
      {Object.entries(corners).map(([pos, cfg]) => cfg && (
        <div key={pos} className="absolute flex items-center justify-center text-[7px] font-black border border-black/40"
          style={{
            width: 16, height: 16, backgroundColor: cfg.bg, color: cfg.fg, borderRadius: 1,
            ...(pos === 'TL' ? { top: 3, left: 3 }  : {}),
            ...(pos === 'TR' ? { top: 3, right: 3 }  : {}),
            ...(pos === 'BL' ? { bottom: 3, left: 3 } : {}),
            ...(pos === 'BR' ? { bottom: 3, right: 3 } : {}),
          }}
        >{cfg.label}</div>
      ))}
      {/* Power bar */}
      {scenario.powerPosition === 'center' && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-1.5 py-px text-[6px] font-black border border-black/40"
          style={{ backgroundColor: '#FFE500', color: '#1A1A1A' }}
        >PWR</div>
      )}
    </div>
  );
};

const MiniCardBack: React.FC<{ scenario: ImageScenario; color: string; hasBorder: boolean }> = ({ scenario, color, hasBorder }) => (
  <div className="relative border-2 border-black/30 overflow-hidden flex-shrink-0"
    style={{ width: 64, height: 86, borderRadius: 2 }}
  >
    {scenario.base64Image ? (
      <img src={`data:image/jpeg;base64,${scenario.base64Image}`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
    ) : (
      <div className="absolute inset-0 bg-brand-bg" />
    )}
    {hasBorder && (
      <div className="absolute inset-[3px] border-[3px]" style={{ borderColor: color }} />
    )}
  </div>
);

// ── Group status summary (shown in collapsed header) ──────────────────────────

const GroupStatusBadges: React.FC<{ group: Group; color: string }> = ({ group, color }) => {
  const p = group.imagePrompts[0];
  const presetId = p ? detectPreset(p) : null;
  const preset = PRESETS.find(pr => pr.id === presetId);
  const hasBorder = !!group.backColoredBorder;

  return (
    <div className="flex items-center gap-1.5">
      {preset && (
        <span className="text-[9px] font-black px-1.5 py-0.5 border-2 border-black"
          style={{ backgroundColor: color, color: '#1A1A1A', borderRadius: 1 }}
        >{preset.label}</span>
      )}
      {presetId === 'custom' && (
        <span className="text-[9px] font-black px-1.5 py-0.5 border-2 border-black/40 text-brand-subtle"
          style={{ borderRadius: 1 }}
        >Custom</span>
      )}
      {hasBorder && (
        <span className="text-[9px] font-black px-1.5 py-0.5 border-2 border-black"
          style={{ backgroundColor: '#1A1A1A', color: color, borderRadius: 1 }}
        >Border ◻</span>
      )}
      {!presetId && !hasBorder && (
        <span className="text-[9px] font-black text-brand-subtle/40 uppercase tracking-widest">Not configured</span>
      )}
    </div>
  );
};

// ── Per-element position rows ─────────────────────────────────────────────────

const CORNER_OPTIONS = [
  { value: 'none', label: '—' },
  { value: 'TL',   label: 'TL' },
  { value: 'TR',   label: 'TR' },
  { value: 'BL',   label: 'BL' },
  { value: 'BR',   label: 'BR' },
] as const;

const ELEM_ROWS: { field: keyof ImageScenario; label: string; meta: { bg: string; fg: string; label: string } }[] = [
  { field: 'qrCodePosition',   label: 'QR Code', meta: ELEM_META.qrCodePosition   },
  { field: 'number_Position',  label: 'Number',  meta: ELEM_META.number_Position  },
  { field: 'boxColorPosition', label: 'Colour',  meta: ELEM_META.boxColorPosition },
  { field: 'letter_Position',  label: 'Letter',  meta: ELEM_META.letter_Position  },
];

// ── FRONT config panel ────────────────────────────────────────────────────────

interface FrontConfigProps {
  group: Group;
  color: string;
  onApplyPreset: (id: string) => void;
  onSetPosition: (field: keyof ImageScenario, value: string) => void;
  onClear: () => void;
}

const FrontConfig: React.FC<FrontConfigProps> = ({ group, color, onApplyPreset, onSetPosition, onClear }) => {
  const scenario = (group.imagePrompts[0] ?? {}) as ImageScenario;
  const activePreset = detectPreset(scenario);

  return (
    <div className="flex gap-5 items-start">
      {/* Mini preview — live */}
      <div className="flex-shrink-0">
        <div className="text-[8px] font-black uppercase tracking-widest text-brand-subtle mb-1.5">Preview</div>
        <MiniCardFront scenario={scenario} color={color} />
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        {/* Quick presets */}
        <div>
          <div className="text-[8px] font-black uppercase tracking-widest text-brand-subtle mb-1.5">Quick Preset</div>
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map(pr => {
              const isActive = activePreset === pr.id;
              return (
                <button
                  key={pr.id}
                  onClick={() => onApplyPreset(pr.id)}
                  title={pr.desc}
                  className="px-2.5 py-1 border-2 text-[9px] font-black uppercase tracking-widest transition-all hover:opacity-90 active:translate-x-px active:translate-y-px whitespace-nowrap"
                  style={{
                    borderColor: isActive ? '#000' : 'rgba(0,0,0,0.15)',
                    backgroundColor: isActive ? color : 'transparent',
                    color: '#1A1A1A',
                    borderRadius: 1,
                    boxShadow: isActive ? '2px 2px 0 #000' : 'none',
                  }}
                >{pr.label}</button>
              );
            })}
            {activePreset === 'custom' && (
              <span className="px-2.5 py-1 border-2 border-black/20 text-[9px] font-black uppercase tracking-widest text-brand-subtle" style={{ borderRadius: 1 }}>Custom</span>
            )}
            <button
              onClick={onClear}
              disabled={!activePreset}
              className="px-2.5 py-1 border-2 border-black/15 text-[9px] font-black uppercase tracking-widest text-brand-subtle hover:border-black hover:text-brand-text transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              style={{ borderRadius: 1 }}
            >✕ Clear</button>
          </div>
        </div>

        {/* Per-element position picker */}
        <div>
          <div className="text-[8px] font-black uppercase tracking-widest text-brand-subtle mb-1.5">Element Positions</div>
          <div className="space-y-1">
            {ELEM_ROWS.map(({ field, label, meta }) => {
              const current = (scenario[field] as string) || 'none';
              return (
                <div key={field} className="flex items-center gap-2">
                  {/* Element badge */}
                  <span
                    className="flex-shrink-0 flex items-center justify-center text-[8px] font-black border border-black/30"
                    style={{ width: 20, height: 20, backgroundColor: meta.bg, color: meta.fg, borderRadius: 1 }}
                  >{meta.label}</span>
                  <span className="text-[9px] font-black text-brand-subtle w-12 flex-shrink-0">{label}</span>
                  {/* Position buttons */}
                  <div className="flex gap-0.5">
                    {CORNER_OPTIONS.map(opt => {
                      const isSelected = current === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSetPosition(field, opt.value)}
                          className="flex items-center justify-center text-[8px] font-black border transition-all"
                          style={{
                            width: 24, height: 20,
                            borderColor: isSelected ? '#000' : 'rgba(0,0,0,0.15)',
                            backgroundColor: isSelected && opt.value !== 'none' ? meta.bg : isSelected ? '#e5e5e5' : 'transparent',
                            color: isSelected && opt.value !== 'none' ? meta.fg : '#1A1A1A',
                            borderRadius: 1,
                            boxShadow: isSelected ? '1px 1px 0 #000' : 'none',
                          }}
                        >{opt.label}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Power bar row (on / off only) */}
            {(() => {
              const isOn = scenario.powerPosition === 'center';
              return (
                <div className="flex items-center gap-2">
                  <span
                    className="flex-shrink-0 flex items-center justify-center text-[8px] font-black border border-black/30"
                    style={{ width: 20, height: 20, backgroundColor: '#FFE500', color: '#1A1A1A', borderRadius: 1 }}
                  >⚡</span>
                  <span className="text-[9px] font-black text-brand-subtle w-12 flex-shrink-0">Power</span>
                  <div className="flex gap-0.5">
                    {[{ value: 'none', label: 'Off' }, { value: 'center', label: 'On' }].map(opt => {
                      const isSelected = (scenario.powerPosition || 'none') === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSetPosition('powerPosition', opt.value)}
                          className="flex items-center justify-center text-[8px] font-black border transition-all px-2"
                          style={{
                            height: 20,
                            borderColor: isSelected ? '#000' : 'rgba(0,0,0,0.15)',
                            backgroundColor: isSelected && opt.value !== 'none' ? '#FFE500' : isSelected ? '#e5e5e5' : 'transparent',
                            color: '#1A1A1A',
                            borderRadius: 1,
                            boxShadow: isSelected ? '1px 1px 0 #000' : 'none',
                          }}
                        >{opt.label}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── BACK config panel ─────────────────────────────────────────────────────────

interface BackConfigProps {
  group: Group;
  color: string;
  onToggleBorder: (value: boolean) => void;
}

const BackConfig: React.FC<BackConfigProps> = ({ group, color, onToggleBorder }) => {
  const hasBorder = !!group.backColoredBorder;
  const scenario = (group.imagePrompts[0] ?? {}) as ImageScenario;

  return (
    <div className="flex gap-5 items-start">
      {/* Mini preview */}
      <div className="flex-shrink-0">
        <div className="text-[8px] font-black uppercase tracking-widest text-brand-subtle mb-1.5">Preview</div>
        <MiniCardBack scenario={scenario} color={color} hasBorder={hasBorder} />
      </div>

      {/* Toggle */}
      <div className="flex-1 min-w-0">
        <div className="text-[8px] font-black uppercase tracking-widest text-brand-subtle mb-2">Colored Border</div>
        <div className="flex flex-col gap-1">
          {[
            { value: true,  label: 'Yes', desc: `Border in group colour (${color})` },
            { value: false, label: 'No',  desc: 'Plain back, no decorative border' },
          ].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => onToggleBorder(opt.value)}
              className="flex items-center gap-3 px-3 py-2 border-2 text-left transition-all hover:opacity-90 active:translate-x-px active:translate-y-px"
              style={{
                borderColor: hasBorder === opt.value ? '#000' : 'rgba(0,0,0,0.12)',
                backgroundColor: hasBorder === opt.value
                  ? (opt.value ? color : '#e5e5e5')
                  : 'transparent',
                borderRadius: 1,
                boxShadow: hasBorder === opt.value ? '2px 2px 0 #000' : 'none',
              }}
            >
              {opt.value ? (
                <span className="w-4 h-4 border-[3px] flex-shrink-0" style={{ borderColor: color }} />
              ) : (
                <span className="w-4 h-4 border border-black/20 flex-shrink-0 bg-white" />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-text w-8 flex-shrink-0">{opt.label}</span>
              <span className="text-[9px] text-brand-subtle">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Coming-soon placeholder (Power-ups, Utilities) ────────────────────────────

const TBDPanel: React.FC<{ label: string }> = ({ label }) => (
  <div className="mt-4 flex items-center gap-3 px-4 py-4 border-2 border-dashed border-black/15 text-brand-subtle"
    style={{ borderRadius: 1 }}
  >
    <span className="text-xl flex-shrink-0">🚧</span>
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-brand-text">{label}</div>
      <div className="text-[9px] text-brand-subtle mt-0.5">Card configuration for this group type is coming soon</div>
    </div>
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────

interface CardStudioProps {
  designStructure: DesignStructure;
  theme: string;
  defaultImageModel?: string; // kept for prop compatibility, unused
  onBack: () => void;
  onGoToFusion?: () => void;
  onSave: (updated: DesignStructure) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  onOpenSettings: () => void;
  projectName?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

const CardStudio: React.FC<CardStudioProps> = ({
  designStructure, theme, onBack, onGoToFusion, onSave,
  isDarkMode, setIsDarkMode, onOpenSettings, projectName,
}) => {
  const [structure, setStructure] = useState<DesignStructure>(() =>
    JSON.parse(JSON.stringify(designStructure))
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({ 0: true });
  const [isUsageOpen, setIsUsageOpen] = useState(false);

  const applyAndSave = useCallback((s: DesignStructure) => {
    setStructure(s);
    onSave(s);
  }, [onSave]);

  // Apply a layout preset to every imagePrompt in the group (and all subgroups)
  const applyPreset = useCallback((gi: number, presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const s: DesignStructure = JSON.parse(JSON.stringify(structure));
    const apply = (p: ImageScenario) =>
      Object.entries(preset.values).forEach(([k, v]) => { (p as Record<string, unknown>)[k] = v; });
    s.groups[gi].imagePrompts.forEach(apply);
    s.groups[gi].subgroups.forEach(sg => sg.imagePrompts.forEach(apply));
    applyAndSave(s);
  }, [structure, applyAndSave]);

  // Clear all position values for the group
  const clearGroup = useCallback((gi: number) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structure));
    const clear = (p: ImageScenario) => {
      p.qrCodePosition = 'none'; p.number_Position = 'none';
      p.boxColorPosition = 'none'; p.letter_Position = 'none'; p.powerPosition = 'none';
    };
    s.groups[gi].imagePrompts.forEach(clear);
    s.groups[gi].subgroups.forEach(sg => sg.imagePrompts.forEach(clear));
    applyAndSave(s);
  }, [structure, applyAndSave]);

  // Set a single position field on all imagePrompts in the group
  const setGroupPosition = useCallback((gi: number, field: keyof ImageScenario, value: string) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structure));
    const apply = (p: ImageScenario) => { (p as Record<string, unknown>)[field as string] = value; };
    s.groups[gi].imagePrompts.forEach(apply);
    s.groups[gi].subgroups.forEach(sg => sg.imagePrompts.forEach(apply));
    applyAndSave(s);
  }, [structure, applyAndSave]);

  // Toggle colored border on the back of the group's cards
  const toggleBackBorder = useCallback((gi: number, value: boolean) => {
    const s: DesignStructure = JSON.parse(JSON.stringify(structure));
    s.groups[gi].backColoredBorder = value;
    applyAndSave(s);
  }, [structure, applyAndSave]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">

          {projectName && (
            <div className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary dark:bg-brand-primary text-brand-text" style={{ borderRadius: 1 }}>
              {projectName}
            </div>
          )}

          <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg flex-shrink-0">|</span>

          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-brand-primary leading-none">Card Studio</div>
            <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text truncate max-w-[220px]" title={theme}>{theme}</div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title={isDarkMode ? 'Light mode' : 'Dark mode'}>
              {isDarkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsUsageOpen(true)} className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title="API Usage">
              <ChartBarIcon className="w-4 h-4" />
            </button>
            <button onClick={onOpenSettings} className="p-2 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title="Settings">
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
        <div className="h-8 flex items-center border-t-2 border-black dark:border-brand-primary" style={{ backgroundColor: '#BEF264' }}>
          <div className="flex-1 flex items-center pl-4">
            <button
              onClick={onBack}
              className="px-2.5 py-0.5 border-2 border-black text-[10px] font-black uppercase tracking-widest text-black hover:opacity-90 active:opacity-75 transition-opacity"
              style={{ backgroundColor: '#22D3EE', borderRadius: 1 }}
            >
              ← Image Studio
            </button>
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-black select-none flex-shrink-0">— Card Studio —</span>
          <div className="flex-1 flex items-center justify-end pr-4">
            {onGoToFusion && (
              <button
                onClick={onGoToFusion}
                className="px-2.5 py-0.5 border-2 border-black text-[10px] font-black uppercase tracking-widest text-black hover:opacity-90 active:opacity-75 transition-opacity"
                style={{ backgroundColor: '#E879F9', borderRadius: 1 }}
              >
                Deck Fusion →
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Groups ────────────────────────────────────────────────────────── */}
      <main className="flex-grow max-w-6xl mx-auto w-full px-6 py-6 space-y-4">
        {structure.groups.map((group, gi) => {
          const color = CARD_COLORS[gi % CARD_COLORS.length];
          const isExpanded = expandedGroups[gi] ?? false;
          const isGameCard = GAME_CARD_TYPES.has(group.groupType ?? '');
          const typeLabel = GROUP_TYPE_LABEL[group.groupType ?? ''] ?? '';

          // Collect all images across group + subgroups for the thumbnail strip
          const allImages: string[] = [
            ...group.imagePrompts.map(p => p.base64Image).filter(Boolean),
            ...group.subgroups.flatMap(sg => sg.imagePrompts.map(p => p.base64Image).filter(Boolean)),
          ] as string[];

          return (
            <div key={group.id ?? gi} className="neo-card bg-brand-surface overflow-hidden">
              {/* Tier colour strip */}
              <div className="h-1 w-full" style={{ backgroundColor: color }} />

              {/* Group header row */}
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, [gi]: !isExpanded }))}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-brand-bg transition-colors"
              >
                <span className="text-[10px] font-black text-brand-subtle/40 tracking-widest flex-shrink-0">
                  {String(gi + 1).padStart(2, '0')}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="text-sm font-black uppercase tracking-wide text-brand-text">{group.title}</h2>
                    {typeLabel && (
                      <span className="text-[9px] font-black text-brand-subtle/50 uppercase tracking-widest">({typeLabel})</span>
                    )}
                  </div>
                  <p className="text-[10px] text-brand-subtle truncate mt-0.5">{group.mood}</p>
                </div>

                {/* Status summary */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isGameCard && <GroupStatusBadges group={group} color={color} />}
                  {allImages.length > 0 && (
                    <span className="text-[9px] font-black text-brand-subtle/40">{allImages.length} img{allImages.length !== 1 ? 's' : ''}</span>
                  )}
                  {isExpanded
                    ? <ChevronUpIcon className="w-4 h-4 text-brand-subtle" />
                    : <ChevronDownIcon className="w-4 h-4 text-brand-subtle" />}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-black/10 dark:border-brand-primary/20">
                  {isGameCard ? (
                    <div className="px-5 py-5 grid grid-cols-2 gap-x-8 gap-y-6">
                      {/* FRONT ───────── */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-4 flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-brand-text">Front of Card</span>
                        </div>
                        <FrontConfig
                          group={group}
                          color={color}
                          onApplyPreset={id => applyPreset(gi, id)}
                          onSetPosition={(field, value) => setGroupPosition(gi, field, value)}
                          onClear={() => clearGroup(gi)}
                        />
                      </div>

                      {/* BACK ────────── */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-4 flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-brand-text">Back of Card</span>
                        </div>
                        <BackConfig
                          group={group}
                          color={color}
                          onToggleBorder={v => toggleBackBorder(gi, v)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-5">
                      <TBDPanel label={typeLabel || 'Special group'} />
                    </div>
                  )}

                  {/* Image thumbnail strip (read-only, reference) */}
                  {allImages.length > 0 && (
                    <div className="px-5 pb-5 pt-1">
                      <div className="pt-4 border-t border-black/8">
                        <div className="text-[8px] font-black uppercase tracking-widest text-brand-subtle/50 mb-2">
                          Card images · {allImages.length} total
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {allImages.map((img, i) => (
                            <img
                              key={i}
                              src={`data:image/jpeg;base64,${img}`}
                              alt=""
                              className="border border-black/15 object-cover flex-shrink-0"
                              style={{ width: 40, height: 54, borderRadius: 1 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
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

      {isUsageOpen && <UsageDashboard onClose={() => setIsUsageOpen(false)} />}
    </div>
  );
};

export default CardStudio;
