
import React, { useState, useRef, useEffect } from 'react';
import type { SavedDesign } from '../types';
import { XIcon, TrashIcon, DownloadIcon, SparklesIcon, LockClosedIcon, LockOpenIcon, PencilIcon } from './icons';

interface ArchiveModalProps {
  designs: SavedDesign[];
  onLoad: (design: SavedDesign) => void;
  onDelete: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRename: (id: string, newTheme: string) => void;
  onClose: () => void;
}

const LANG_BADGE: Record<string, string> = {
  English: 'EN', Portuguese: 'PT', Spanish: 'ES',
  French: 'FR', German: 'DE', Italian: 'IT',
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const InlineRename: React.FC<{ value: string; onCommit: (v: string) => void; onCancel: () => void }> = ({ value, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const commit = () => { const v = draft.trim(); if (v && v !== value) onCommit(v); else onCancel(); };

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
      className="neo-input text-sm font-black uppercase tracking-wide text-brand-text bg-brand-bg px-2 py-0.5 w-full focus:outline-none"
      style={{ letterSpacing: '0.05em' }}
    />
  );
};

const ArchiveModal: React.FC<ArchiveModalProps> = ({ designs, onLoad, onDelete, onToggleLock, onRename, onClose }) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = designs.filter(d =>
    d.theme.toLowerCase().includes(search.toLowerCase()) ||
    d.themeDescription.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = (design: SavedDesign) => {
    const dataStr = JSON.stringify(design.data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `GDESIGN_${design.theme.replace(/\s+/g, '_').toLowerCase()}.json`);
    link.click();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="neo-card bg-brand-surface w-full max-w-2xl max-h-[80vh] flex flex-col" style={{ borderWidth: 2 }}>

        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-black dark:border-brand-primary flex items-center justify-between flex-shrink-0 bg-brand-secondary dark:bg-brand-secondary/20">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-brand-text">Worlds Archive</h2>
            <p className="text-xs text-brand-subtle mt-0.5 font-medium">
              {designs.length} {designs.length === 1 ? 'world' : 'worlds'} saved locally
            </p>
          </div>
          <button onClick={onClose} className="neo-btn p-1.5 bg-brand-surface hover:bg-brand-bg">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        {designs.length > 3 && (
          <div className="px-6 py-3 border-b-2 border-black/10 dark:border-brand-primary/20 flex-shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search worlds…"
              className="neo-input w-full bg-brand-bg text-brand-text text-xs px-3 py-2 placeholder:text-brand-subtle/40 focus:outline-none"
              autoFocus
            />
          </div>
        )}

        {/* List */}
        <div className="flex-grow overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="neo-card w-14 h-14 flex items-center justify-center mb-4 bg-brand-surface">
                <SparklesIcon className="w-5 h-5 text-brand-text" />
              </div>
              <p className="text-sm font-black uppercase tracking-wide text-brand-text">
                {designs.length === 0 ? 'No worlds yet' : 'No results'}
              </p>
              <p className="text-xs text-brand-subtle mt-1.5 leading-relaxed">
                {designs.length === 0
                  ? 'Generate a theme — it will be saved here automatically.'
                  : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            filtered.map(design => (
              <div
                key={design.id}
                className="group neo-card flex items-start gap-4 p-4 bg-brand-surface hover:bg-brand-bg transition-colors cursor-default"
                style={{ boxShadow: '3px 3px 0 0 #000' }}
              >
                <div className="flex-1 min-w-0">
                  {/* Title row — rename or display */}
                  {renamingId === design.id ? (
                    <InlineRename
                      value={design.theme}
                      onCommit={(v) => { onRename(design.id, v); setRenamingId(null); }}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-black uppercase tracking-wide text-brand-text truncate">{design.theme}</p>
                      {design.locked && <LockClosedIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                    </div>
                  )}

                  <p className="text-[11px] text-brand-subtle mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                    {design.groupCount} groups
                    {design.language && (
                      <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary text-brand-text leading-none">
                        {LANG_BADGE[design.language] ?? design.language.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span>· {formatDate(design.savedAt)}</span>
                  </p>
                  {design.themeDescription && (
                    <p className="text-xs text-brand-subtle/70 mt-1.5 line-clamp-2 leading-relaxed">
                      {design.themeDescription}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  {/* Rename */}
                  {!design.locked && renamingId !== design.id && (
                    <button
                      onClick={() => { setRenamingId(design.id); setConfirmDeleteId(null); }}
                      className="p-1.5 text-brand-subtle hover:text-brand-text hover:bg-brand-secondary/50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Rename"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Export */}
                  <button
                    onClick={() => handleExport(design)}
                    className="p-1.5 text-brand-subtle hover:text-brand-text hover:bg-brand-secondary/50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Export JSON"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                  </button>

                  {/* Lock toggle */}
                  <button
                    onClick={() => { onToggleLock(design.id); setConfirmDeleteId(null); }}
                    className={`p-1.5 transition-colors ${design.locked ? 'text-amber-500 opacity-100' : 'text-brand-subtle opacity-0 group-hover:opacity-100 hover:text-amber-500'}`}
                    title={design.locked ? 'Unlock world (allows deletion)' : 'Lock world (prevents deletion)'}
                  >
                    {design.locked ? <LockClosedIcon className="w-3.5 h-3.5" /> : <LockOpenIcon className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete — hidden when locked */}
                  {!design.locked && (
                    confirmDeleteId === design.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-red-500">Delete?</span>
                        <button
                          onClick={() => { onDelete(design.id); setConfirmDeleteId(null); }}
                          className="neo-btn px-2 py-1 text-[10px] font-black text-white bg-red-500"
                          style={{ boxShadow: '2px 2px 0 0 #000' }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="neo-btn px-2 py-1 text-[10px] font-bold text-brand-subtle bg-brand-surface"
                          style={{ boxShadow: '2px 2px 0 0 #000' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(design.id)}
                        className="p-1.5 text-brand-subtle hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}

                  <button
                    onClick={() => onLoad(design)}
                    className="neo-btn ml-1 px-3 py-1.5 text-xs font-black bg-brand-text text-brand-surface"
                    style={{ boxShadow: '3px 3px 0 0 #000' }}
                  >
                    Load
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t-2 border-black/10 dark:border-brand-primary/20 flex-shrink-0 bg-brand-bg flex items-center gap-2 flex-wrap">
          <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-text">Auto-save on</span>
          <span className="text-[10px] font-mono text-brand-subtle">archive/massivescan_archive.json · archive/massivescan_settings.json</span>
        </div>

      </div>
    </div>
  );
};

export default ArchiveModal;
