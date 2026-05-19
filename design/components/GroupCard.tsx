
import React from 'react';
import type { Group, ImageScenario } from '../types';
import type { ExpandState } from './DesignCanvas';
import EditableText from './EditableText';
import { DiceIcon, ImageIcon, StarIcon, ChevronUpIcon, ChevronDownIcon, MinusIcon } from './icons';

interface GroupCardProps {
  group: Group;
  index: number;
  viewMode: 'card' | 'list';
  expandState: ExpandState;
  onCycleExpand: () => void;
  onRegenerateGroup: () => void;
  onRegenerateSubgroups: () => void;
  onRegenerateSingleSubgroup: (subIndex: number) => void;
  loadingSubgroupIndices: Set<number>;
  onUpdate: (field: string, value: any, subIndex?: number, subField?: string, itemIndex?: number, itemProperty?: 'prompt') => void;
}

// Fixed color sequence — matches the deck's tier system, in order:
//   01 Yellow → 02 Green → 03 Blue → 04 Magenta → 05 Power-ups → 06 Utility
const CARD_COLORS = [
  '#FDE68A', // 01: Yellow tier (amber-200)
  '#86EFAC', // 02: Green tier (green-300)
  '#7DD3FC', // 03: Blue tier (sky-300)
  '#F0ABFC', // 04: Magenta tier (fuchsia-300)
  '#C4B5FD', // 05: Power-ups (violet-300, special)
  '#4B5563', // 06: Utility (charcoal gray-600, functional/meta)
];

const ImageScenarioItem: React.FC<{
  scenario: ImageScenario;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onUpdatePrompt: (value: string) => void;
  className?: string;
  inputClassName?: string;
  isSubgroup?: boolean;
}> = ({ scenario, isFavorite, onToggleFavorite, onUpdatePrompt, className, inputClassName, isSubgroup = false }) => {
  const size = isSubgroup ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = isSubgroup ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <li className="flex gap-2.5 items-start group/scenario">
      <div className={`flex-shrink-0 ${size} border-2 border-black dark:border-brand-primary bg-brand-bg flex items-center justify-center`} style={{ borderRadius: 1 }}>
        {scenario.base64Image ? (
          <img src={`data:image/png;base64,${scenario.base64Image}`} alt="Scenario" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className={`${iconSize} text-brand-subtle/50`} />
        )}
      </div>
      <div className="flex-grow min-w-0">
        <EditableText as="p" value={scenario.prompt} onChange={onUpdatePrompt} className={className} inputClassName={inputClassName} isTextarea />
      </div>
      <button
        onClick={onToggleFavorite}
        title={isFavorite ? 'Remove favourite' : 'Mark as favourite'}
        className={`flex-shrink-0 p-0.5 rounded transition-colors ${isFavorite ? 'text-amber-400' : 'text-brand-subtle opacity-0 group-hover/scenario:opacity-100 hover:text-amber-400'}`}
      >
        <StarIcon className={isSubgroup ? 'w-3.5 h-3.5' : 'w-4 h-4'} isFilled={isFavorite} />
      </button>
    </li>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="neo-section-label dark:text-brand-primary">{children}</p>
);

const ExpandIcon: React.FC<{ state: ExpandState; className?: string }> = ({ state, className }) => {
  if (state === 'expanded') return <ChevronUpIcon className={className} />;
  if (state === 'peek')     return <MinusIcon className={className} />;
  return <ChevronDownIcon className={className} />;
};

const GroupCard: React.FC<GroupCardProps> = ({ group, index, viewMode, expandState, onCycleExpand, onRegenerateGroup, onRegenerateSubgroups, onRegenerateSingleSubgroup, loadingSubgroupIndices, onUpdate }) => {
  const isCardLoading = !!group.isLoading;
  const isListView = viewMode === 'list';
  const accentColor = CARD_COLORS[index % CARD_COLORS.length];
  const isCollapsed = expandState === 'collapsed';
  const isPeek = expandState === 'peek';
  const isExpanded = expandState === 'expanded';

  const coversReady = group.imagePrompts.filter(p => p.base64Image).length;
  const coversTotal = group.imagePrompts.length;
  const frontsReady = group.subgroups.reduce((n, sg) => n + sg.imagePrompts.filter(p => p.base64Image).length, 0);
  const frontsTotal = group.subgroups.reduce((n, sg) => n + sg.imagePrompts.length, 0);

  const titleForState = {
    expanded: 'Collapse (click to peek)',
    peek: 'Collapse fully',
    collapsed: 'Expand',
  }[expandState];

  return (
    <div className={`relative neo-card bg-brand-surface flex flex-col transition-opacity ${isCardLoading ? 'opacity-50 pointer-events-none' : ''}`}>
      {isCardLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Colored accent strip */}
      <div className="h-2 flex-shrink-0" style={{ backgroundColor: accentColor }} />

      {/* Card header — always visible */}
      <div
        className={`px-4 flex justify-between items-center gap-3 ${!isCollapsed ? 'pt-4 pb-3 border-b-2 border-black/10 dark:border-brand-primary/20' : 'py-3'} ${isListView ? 'flex-row' : ''}`}
      >
        <div className={`min-w-0 flex-1 ${isListView && isCollapsed ? 'flex items-center gap-4' : ''}`}>
          {(!isListView || !isCollapsed) && (
            <span className="text-[10px] font-mono font-black text-brand-subtle/40 block mb-1">
              {String(index + 1).padStart(2, '0')}
            </span>
          )}
          <div className={isListView && isCollapsed ? 'flex items-center gap-3 min-w-0' : ''}>
            {isListView && isCollapsed && (
              <span className="text-[10px] font-mono font-black text-brand-subtle/40 flex-shrink-0">
                {String(index + 1).padStart(2, '0')}
              </span>
            )}
            <EditableText
              as="h2"
              value={group.title}
              onChange={(value) => onUpdate('title', value)}
              className={`font-black text-brand-text leading-snug uppercase tracking-wide ${isListView && isCollapsed ? 'text-sm' : 'text-base'}`}
              inputClassName="bg-transparent border-brand-primary"
            />
            {group.icon && (!isCollapsed || isListView) && (
              <EditableText
                as="span"
                value={group.icon}
                onChange={(value) => onUpdate('icon', value)}
                className={`text-xs text-brand-subtle italic ${isListView && isCollapsed ? 'ml-1 flex-shrink-0' : 'mt-0.5 block'}`}
                inputClassName="bg-transparent border-brand-primary text-xs"
              />
            )}
          </div>
          {/* Description preview in list view when collapsed */}
          {isListView && isCollapsed && group.description && (
            <p className="text-xs text-brand-subtle truncate max-w-sm hidden lg:block ml-2">{group.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Image counts */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div
              className="flex flex-col items-center px-1.5 py-0.5 border border-black/20 dark:border-brand-primary/30"
              style={{ borderRadius: 1, backgroundColor: coversReady === coversTotal && coversTotal > 0 ? '#6EE7B7' : undefined, color: coversReady === coversTotal && coversTotal > 0 ? '#1A1A1A' : undefined }}
              title="Card Covers"
            >
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
                <span>{coversReady}/{coversTotal}</span>
                <span className="opacity-50">Covers</span>
              </div>
              <span className="text-[8px] font-bold opacity-60 leading-none">{Math.floor(coversTotal / 2)} card{Math.floor(coversTotal / 2) !== 1 ? 's' : ''}</span>
            </div>
            {frontsTotal > 0 && (
              <div
                className="flex flex-col items-center px-1.5 py-0.5 border border-black/20 dark:border-brand-primary/30"
                style={{ borderRadius: 1, backgroundColor: frontsReady === frontsTotal ? '#FFE500' : undefined, color: frontsReady === frontsTotal ? '#1A1A1A' : undefined }}
                title="Card Fronts"
              >
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
                  <span>{frontsReady}/{frontsTotal}</span>
                  <span className="opacity-50">Fronts</span>
                </div>
                <span className="text-[8px] font-bold opacity-60 leading-none">{Math.floor(frontsTotal / 2)} card{Math.floor(frontsTotal / 2) !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <button
            onClick={onRegenerateGroup}
            className="p-1.5 text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
            title="Regenerate Group"
          >
            <DiceIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onCycleExpand}
            className="p-1.5 text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
            title={titleForState}
          >
            <ExpandIcon state={expandState} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Peek body — description only */}
      {isPeek && (
        <div className="px-4 py-3">
          <SectionLabel>Description</SectionLabel>
          <EditableText
            as="p"
            value={group.description}
            onChange={(value) => onUpdate('description', value)}
            className="text-sm text-brand-text leading-relaxed"
            inputClassName="bg-transparent border-brand-primary"
            isTextarea
          />
        </div>
      )}

      {/* Full expanded body */}
      {isExpanded && (
        <div className="px-4 py-4 flex-grow space-y-5">

          <div>
            <SectionLabel>Description</SectionLabel>
            <EditableText as="p" value={group.description} onChange={(value) => onUpdate('description', value)} className="text-sm text-brand-text leading-relaxed" inputClassName="bg-transparent border-brand-primary" isTextarea />
          </div>

          <div>
            <SectionLabel>Art Direction</SectionLabel>
            <EditableText as="p" value={group.mood} onChange={(value) => onUpdate('mood', value)} className="text-sm text-brand-subtle italic leading-relaxed" inputClassName="bg-transparent border-brand-primary" isTextarea />
          </div>

          {group.imagePrompts?.length > 0 && (
            <div>
              <SectionLabel>Image Prompts</SectionLabel>
              <ul className="space-y-3">
                {group.imagePrompts.map((scenario, i) => (
                  <ImageScenarioItem
                    key={i}
                    scenario={scenario}
                    isFavorite={group.favoriteImagePromptIndex === i}
                    onToggleFavorite={() => onUpdate('favoriteImagePromptIndex', i)}
                    onUpdatePrompt={(value) => onUpdate('imagePrompts', value, undefined, undefined, i, 'prompt')}
                    className="text-xs text-brand-subtle leading-relaxed"
                    inputClassName="bg-transparent border-brand-primary text-xs"
                  />
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <SectionLabel>Subgroups</SectionLabel>
              <button onClick={onRegenerateSubgroups} className="p-1 -mt-1 text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title="Regenerate Subgroups">
                <DiceIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {group.isSubgroupsLoading ? (
              <div className="space-y-4 py-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 bg-brand-secondary rounded w-1/3 animate-pulse" />
                    <div className="h-2.5 bg-brand-secondary/50 rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <ul className="divide-y-2 divide-black/10 dark:divide-brand-primary/20">
                {group.subgroups.map((subgroup, i) => {
                  const isSubLoading = loadingSubgroupIndices.has(i);
                  return (
                    <li key={i} className={`py-3 first:pt-0 last:pb-0 group/sub relative ${isSubLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {isSubLoading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="w-4 h-4 border-2 border-brand-text/30 border-t-brand-text rounded-full animate-spin" />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <EditableText as="h4" value={subgroup.title} onChange={(value) => onUpdate('subgroups', value, i, 'title')} className="text-sm font-bold text-brand-text uppercase tracking-wide flex-1" inputClassName="bg-transparent border-brand-primary text-sm" />
                        <button
                          onClick={() => onRegenerateSingleSubgroup(i)}
                          className="flex-shrink-0 p-1 text-brand-subtle opacity-0 group-hover/sub:opacity-100 hover:text-brand-text hover:bg-brand-bg transition-all"
                          title={`Regenerate "${subgroup.title}"`}
                        >
                          <DiceIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <EditableText as="p" value={subgroup.description} onChange={(value) => onUpdate('subgroups', value, i, 'description')} className="text-xs text-brand-subtle mt-0.5 leading-relaxed" inputClassName="bg-transparent border-brand-primary text-xs" isTextarea />
                      <EditableText as="p" value={subgroup.mood} onChange={(value) => onUpdate('subgroups', value, i, 'mood')} className="text-xs text-brand-subtle/60 italic mt-1 leading-relaxed" inputClassName="bg-transparent border-brand-primary text-xs" isTextarea />
                      {subgroup.imagePrompts?.length > 0 && (
                        <ul className="mt-2.5 space-y-2">
                          {subgroup.imagePrompts.map((scenario, promptI) => (
                            <ImageScenarioItem
                              key={promptI}
                              scenario={scenario}
                              isFavorite={subgroup.favoriteImagePromptIndex === promptI}
                              onToggleFavorite={() => onUpdate('subgroups', promptI, i, 'favoriteImagePromptIndex')}
                              onUpdatePrompt={(value) => onUpdate('subgroups', value, i, 'imagePrompts', promptI, 'prompt')}
                              className="text-xs text-brand-subtle/80 leading-relaxed"
                              inputClassName="bg-transparent border-brand-primary text-xs"
                              isSubgroup
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export const GroupCardSkeleton: React.FC = () => (
  <div className="neo-card bg-brand-surface p-5 space-y-4">
    <div className="h-2 -mx-5 -mt-5 mb-4 bg-brand-secondary" />
    <div>
      <div className="h-2.5 bg-brand-secondary rounded w-6 mb-2 animate-pulse" />
      <div className="h-4 bg-brand-secondary rounded w-3/4 mb-1 animate-pulse" />
      <div className="h-3 bg-brand-secondary/50 rounded w-1/4 animate-pulse" />
    </div>
    <div className="pt-4 border-t-2 border-black/10 space-y-1.5">
      <div className="h-2.5 bg-brand-secondary/60 rounded w-full animate-pulse" />
      <div className="h-2.5 bg-brand-secondary/60 rounded w-5/6 animate-pulse" />
    </div>
    <div className="space-y-1.5">
      <div className="h-2.5 bg-brand-secondary/40 rounded w-full animate-pulse" />
      <div className="h-2.5 bg-brand-secondary/40 rounded w-3/4 animate-pulse" />
    </div>
  </div>
);

export default GroupCard;
