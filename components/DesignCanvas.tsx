
import React, { useState } from 'react';
import type { Group } from '../types';
import GroupCard, { GroupCardSkeleton } from './GroupCard';
import { SparklesIcon, GridIcon, ListIcon } from './icons';

interface DesignCanvasProps {
  groups: Group[] | null;
  isLoading: boolean;
  onRegenerateGroup: (groupIndex: number) => void;
  onRegenerateSubgroups: (groupIndex: number) => void;
  onUpdate: (groupIndex: number, field: string, value: any, subIndex?: number, subField?: string, itemIndex?: number, itemProperty?: 'prompt') => void;
}

const DesignCanvas: React.FC<DesignCanvasProps> = ({
  groups,
  isLoading,
  onRegenerateGroup,
  onRegenerateSubgroups,
  onUpdate,
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <GroupCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!groups) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-28">
        <div className="w-12 h-12 rounded-xl border-2 border-dashed border-brand-secondary flex items-center justify-center mb-5">
          <SparklesIcon className="w-5 h-5 text-brand-secondary" />
        </div>
        <h2 className="text-sm font-semibold text-brand-text">Start your creative journey</h2>
        <p className="mt-1.5 text-sm text-brand-subtle max-w-sm">
          Enter a theme and click Generate to build your world structure.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-brand-subtle">
          <span className="font-medium text-brand-text">{groups.length}</span> groups
        </p>
        <div className="flex items-center gap-0.5 bg-brand-bg border border-brand-secondary rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-brand-surface text-brand-text shadow-sm' : 'text-brand-subtle hover:text-brand-text'}`}
            title="Card view"
          >
            <GridIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-brand-surface text-brand-text shadow-sm' : 'text-brand-subtle hover:text-brand-text'}`}
            title="List view"
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
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
            onRegenerateGroup={() => onRegenerateGroup(index)}
            onRegenerateSubgroups={() => onRegenerateSubgroups(index)}
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
