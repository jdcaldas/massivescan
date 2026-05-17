
import React, { useState } from 'react';
import type { Group, ImageScenario } from '../types';
import EditableText from './EditableText';
import { DiceIcon, ImageIcon, StarIcon, ChevronUpIcon, ChevronDownIcon } from './icons';

interface GroupCardProps {
  group: Group;
  index: number;
  viewMode: 'card' | 'list';
  onRegenerateGroup: () => void;
  onRegenerateSubgroups: () => void;
  onUpdate: (field: string, value: any, subIndex?: number, subField?: string, itemIndex?: number, itemProperty?: 'prompt') => void;
}

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
      <div className={`flex-shrink-0 ${size} rounded border border-brand-secondary bg-brand-bg flex items-center justify-center`}>
        {scenario.base64Image ? (
          <img src={`data:image/png;base64,${scenario.base64Image}`} alt="Scenario" className="w-full h-full object-cover rounded" />
        ) : (
          <ImageIcon className={`${iconSize} text-brand-secondary/50`} />
        )}
      </div>
      <div className="flex-grow min-w-0">
        <EditableText as="p" value={scenario.prompt} onChange={onUpdatePrompt} className={className} inputClassName={inputClassName} isTextarea />
      </div>
      <button
        onClick={onToggleFavorite}
        title={isFavorite ? 'Remove favourite' : 'Mark as favourite'}
        className={`flex-shrink-0 p-0.5 rounded transition-colors ${isFavorite ? 'text-amber-400' : 'text-brand-secondary opacity-0 group-hover/scenario:opacity-100 hover:text-amber-400'}`}
      >
        <StarIcon className={isSubgroup ? 'w-3.5 h-3.5' : 'w-4 h-4'} isFilled={isFavorite} />
      </button>
    </li>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-subtle/60 mb-1.5">{children}</p>
);

const GroupCard: React.FC<GroupCardProps> = ({ group, index, viewMode, onRegenerateGroup, onRegenerateSubgroups, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isCardLoading = !!group.isLoading;
  const isListView = viewMode === 'list';

  return (
    <div className={`relative bg-brand-surface border border-brand-secondary rounded-xl flex flex-col transition-opacity ${isCardLoading ? 'opacity-50 pointer-events-none' : ''}`}>
      {isCardLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl z-10">
          <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Card header — always visible */}
      <div
        className={`px-5 flex justify-between items-center gap-3 ${isExpanded ? 'pt-5 pb-4 border-b border-brand-secondary/50' : 'py-4'} ${isListView ? 'flex-row' : ''}`}
      >
        <div className={`min-w-0 flex-1 ${isListView && !isExpanded ? 'flex items-center gap-4' : ''}`}>
          {(!isListView || isExpanded) && (
            <span className="text-[10px] font-mono text-brand-subtle/40 block mb-1">
              {String(index + 1).padStart(2, '0')}
            </span>
          )}
          <div className={isListView && !isExpanded ? 'flex items-center gap-3 min-w-0' : ''}>
            {isListView && !isExpanded && (
              <span className="text-[10px] font-mono text-brand-subtle/40 flex-shrink-0">
                {String(index + 1).padStart(2, '0')}
              </span>
            )}
            <EditableText
              as="h2"
              value={group.title}
              onChange={(value) => onUpdate('title', value)}
              className={`font-semibold text-brand-text leading-snug ${isListView && !isExpanded ? 'text-sm' : 'text-base'}`}
              inputClassName="bg-transparent border-brand-primary"
            />
            {group.icon && (isExpanded || isListView) && (
              <EditableText
                as="span"
                value={group.icon}
                onChange={(value) => onUpdate('icon', value)}
                className={`text-xs text-brand-subtle italic ${isListView && !isExpanded ? 'ml-1 flex-shrink-0' : 'mt-0.5 block'}`}
                inputClassName="bg-transparent border-brand-primary text-xs"
              />
            )}
          </div>
          {/* Description preview in list view when collapsed */}
          {isListView && !isExpanded && group.description && (
            <p className="text-xs text-brand-subtle truncate max-w-sm hidden lg:block ml-2">{group.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onRegenerateGroup}
            className="p-1.5 rounded-md text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
            title="Regenerate Group"
          >
            <DiceIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-md text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      {isExpanded && (
        <div className="px-5 py-5 flex-grow space-y-5">

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
              <button onClick={onRegenerateSubgroups} className="p-1 -mt-1 rounded text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors" title="Regenerate Subgroups">
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
              <ul className="divide-y divide-brand-secondary/40">
                {group.subgroups.map((subgroup, i) => (
                  <li key={i} className="py-3 first:pt-0 last:pb-0">
                    <EditableText as="h4" value={subgroup.title} onChange={(value) => onUpdate('subgroups', value, i, 'title')} className="text-sm font-medium text-brand-text" inputClassName="bg-transparent border-brand-primary text-sm" />
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
                ))}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export const GroupCardSkeleton: React.FC = () => (
  <div className="bg-brand-surface border border-brand-secondary rounded-xl p-5 space-y-4">
    <div>
      <div className="h-2.5 bg-brand-secondary rounded w-6 mb-2 animate-pulse" />
      <div className="h-4 bg-brand-secondary rounded w-3/4 mb-1 animate-pulse" />
      <div className="h-3 bg-brand-secondary/50 rounded w-1/4 animate-pulse" />
    </div>
    <div className="pt-4 border-t border-brand-secondary/50 space-y-1.5">
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
