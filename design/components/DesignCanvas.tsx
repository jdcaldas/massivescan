
import React, { useState, useEffect } from 'react';
import type { Group } from '../types';
import GroupCard, { GroupCardSkeleton } from './GroupCard';
import { SparklesIcon, GridIcon, ListIcon, ChevronUpIcon, ChevronDownIcon, MinusIcon } from './icons';

export type ExpandState = 'collapsed' | 'peek' | 'expanded';

interface DesignCanvasProps {
  groups: Group[] | null;
  isLoading: boolean;
  onRegenerateGroup: (groupIndex: number) => void;
  onRegenerateSubgroups: (groupIndex: number) => void;
  onRegenerateSingleSubgroup: (groupIndex: number, subgroupIndex: number) => void;
  loadingSubgroupKeys: Set<string>;
  onUpdate: (groupIndex: number, field: string, value: any, subIndex?: number, subField?: string, itemIndex?: number, itemProperty?: 'prompt') => void;
}

const CYCLE: Record<ExpandState, ExpandState> = {
  expanded: 'peek',
  peek: 'collapsed',
  collapsed: 'expanded',
};

const DesignCanvas: React.FC<DesignCanvasProps> = ({
  groups,
  isLoading,
  onRegenerateGroup,
  onRegenerateSubgroups,
  onRegenerateSingleSubgroup,
  loadingSubgroupKeys,
  onUpdate,
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, ExpandState>>({});

  // Default new groups to expanded
  useEffect(() => {
    if (groups) {
      setExpandedGroups(prev => {
        const next = { ...prev };
        groups.forEach(g => { if (!(g.id in next)) next[g.id] = 'expanded'; });
        return next;
      });
    }
  }, [groups]);

  const getState = (id: string): ExpandState => expandedGroups[id] ?? 'expanded';

  const cycleState = (id: string) =>
    setExpandedGroups(prev => ({ ...prev, [id]: CYCLE[getState(id)] }));

  const setAll = (state: ExpandState) => {
    if (!groups) return;
    setExpandedGroups(Object.fromEntries(groups.map(g => [g.id, state])));
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => <GroupCardSkeleton key={i} />)}
      </div>
    );
  }

  if (!groups) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-28">
        <div className="neo-card w-16 h-16 flex items-center justify-center mb-5 bg-brand-surface">
          <SparklesIcon className="w-6 h-6 text-brand-text" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-brand-text">Start your creative journey</h2>
        <p className="mt-2 text-sm text-brand-subtle max-w-sm leading-relaxed">
          Enter a theme and click Generate to build your concept structure.
        </p>
      </div>
    );
  }

  const allExpanded  = groups.every(g => getState(g.id) === 'expanded');
  const allCollapsed = groups.every(g => getState(g.id) === 'collapsed');
  const allPeek      = groups.every(g => getState(g.id) === 'peek');

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-brand-subtle font-bold uppercase tracking-widest">
          <span className="text-brand-text">{groups.length}</span> groups
        </p>

        <div className="flex items-center gap-2">
          {/* State buttons */}
          <div className="neo-btn flex items-stretch overflow-hidden bg-brand-surface p-0" style={{ boxShadow: '3px 3px 0 0 #000' }}>
            <button
              onClick={() => setAll('collapsed')}
              disabled={allCollapsed}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors border-r-2 border-black dark:border-brand-primary disabled:opacity-30 disabled:cursor-not-allowed ${allCollapsed ? 'bg-brand-text text-brand-surface' : 'hover:bg-brand-bg'}`}
              title="Collapse all"
            >
              <ChevronUpIcon className="w-3 h-3" />
              Collapse
            </button>
            <button
              onClick={() => setAll('peek')}
              disabled={allPeek}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors border-r-2 border-black dark:border-brand-primary disabled:opacity-30 disabled:cursor-not-allowed ${allPeek ? 'bg-brand-text text-brand-surface' : 'hover:bg-brand-bg'}`}
              title="Peek all — show description only"
            >
              <MinusIcon className="w-3 h-3" />
              Peek
            </button>
            <button
              onClick={() => setAll('expanded')}
              disabled={allExpanded}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${allExpanded ? 'bg-brand-text text-brand-surface' : 'hover:bg-brand-bg'}`}
              title="Expand all"
            >
              <ChevronDownIcon className="w-3 h-3" />
              Expand
            </button>
          </div>

          <span className="w-px h-4 bg-black/20 dark:bg-brand-primary/40" />

          {/* View toggle */}
          <div className="neo-btn flex items-center gap-0 p-0.5 bg-brand-surface overflow-hidden" style={{ boxShadow: '3px 3px 0 0 #000' }}>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-brand-text text-brand-surface' : 'text-brand-subtle hover:text-brand-text'}`}
              title="Card view"
            >
              <GridIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-brand-text text-brand-surface' : 'text-brand-subtle hover:text-brand-text'}`}
              title="List view"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid / List */}
      <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5' : 'flex flex-col gap-2'}>
        {groups.map((group, index) => (
          <GroupCard
            key={group.id}
            group={group}
            index={index}
            viewMode={viewMode}
            expandState={getState(group.id)}
            onCycleExpand={() => cycleState(group.id)}
            onRegenerateGroup={() => onRegenerateGroup(index)}
            onRegenerateSubgroups={() => onRegenerateSubgroups(index)}
            onRegenerateSingleSubgroup={(si) => onRegenerateSingleSubgroup(index, si)}
            loadingSubgroupIndices={new Set(
              [...loadingSubgroupKeys]
                .filter(k => k.startsWith(`${index}-`))
                .map(k => parseInt(k.split('-')[1]))
            )}
            onUpdate={(field, value, subIndex, subField, itemIndex, itemProperty) =>
              onUpdate(index, field, value, subIndex, subField, itemIndex, itemProperty)
            }
          />
        ))}
      </div>
    </div>
  );
};

export default DesignCanvas;
