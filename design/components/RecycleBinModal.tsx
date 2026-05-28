import React, { useState, useMemo, useEffect } from 'react';
import type { RecycleBinEntry } from '../types';
import { TrashIcon, DownloadIcon } from './icons';
import { BIN_CAP, BIN_WARN_AT, BIN_URGENT_AT, urgencyFor } from '../services/recycleBinService';

// ── Adopt-target ─────────────────────────────────────────────────────────────
// When the modal is opened from a specific slot's "From Bin" button, the
// onAdopt callback is set and clicking an entry adopts it into that slot.
// When opened from the global header button, onAdopt is undefined and only
// view/delete actions are available (no adoption from a non-targeted bin).

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: RecycleBinEntry[];
  /** Set when modal is opened in "select for slot" mode; receives the adopted entry. */
  onAdopt?: (entry: RecycleBinEntry) => void;
  onDeleteOne: (entryId: string) => void;
  onEmptyAll: () => void;
  /** Optional contextual hint shown in the header (e.g. target slot name). */
  targetHint?: string;
}

const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen, onClose, entries, onAdopt, onDeleteOne, onEmptyAll, targetHint,
}) => {
  const [search, setSearch]       = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [styleFilter, setStyleFilter] = useState<string>('all');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  // Reset filters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearch(''); setGroupFilter('all'); setStyleFilter('all'); setConfirmEmpty(false);
    }
  }, [isOpen]);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => { if (e.sourceGroupTitle) set.add(e.sourceGroupTitle); });
    return Array.from(set).sort();
  }, [entries]);

  const availableStyles = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => { if (e.style) set.add(e.style); });
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter(e => groupFilter === 'all' || e.sourceGroupTitle === groupFilter)
      .filter(e => styleFilter === 'all' || e.style === styleFilter)
      .filter(e => !q || e.prompt.toLowerCase().includes(q) ||
                   (e.sourceGroupTitle ?? '').toLowerCase().includes(q) ||
                   (e.sourceSubgroupTitle ?? '').toLowerCase().includes(q))
      .slice().reverse(); // newest first
  }, [entries, groupFilter, styleFilter, search]);

  if (!isOpen) return null;

  const urgency = urgencyFor(entries.length);
  const urgencyBg = urgency === 'urgent' ? '#FF4F6D' : urgency === 'warn' ? '#FFE500' : '#6EE7B7';
  const urgencyFg = urgency === 'urgent' ? '#FFFFFF' : '#1A1A1A';

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* ── Chrome ───────────────────────────────────────────────────────── */}
      <div
        className="bg-brand-surface border-b-2 border-black flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Top row */}
        <div className="flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-brand-text">Recycle Bin</span>
            <div
              className="px-2 py-px text-[9px] font-black uppercase tracking-widest border-2 border-black"
              style={{ backgroundColor: urgencyBg, color: urgencyFg, borderRadius: 1 }}
              title={`${entries.length} / ${BIN_CAP} entries`}
            >
              {entries.length} / {BIN_CAP}
            </div>
            {urgency === 'warn' && (
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">⚠ getting full</span>
            )}
            {urgency === 'urgent' && (
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">⚠ almost full — oldest will be dropped</span>
            )}
            {onAdopt && targetHint && (
              <span className="ml-2 px-2 py-px text-[9px] font-black uppercase tracking-widest border-2 border-black bg-brand-bg" style={{ borderRadius: 1 }}>
                Pick for: {targetHint}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border-2 border-black bg-brand-text text-brand-surface font-black text-sm hover:opacity-80 transition-opacity"
            style={{ boxShadow: '2px 2px 0 #555', borderRadius: 1 }}
            aria-label="Close"
          >✕</button>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 px-5 pb-3 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search prompts, groups…"
            className="neo-input text-xs px-3 py-1.5 flex-1 min-w-[180px] max-w-[320px] bg-brand-bg"
          />
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="neo-input text-xs font-black px-2 py-1.5 bg-brand-bg cursor-pointer"
          >
            <option value="all">All groups</option>
            {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={styleFilter}
            onChange={e => setStyleFilter(e.target.value)}
            className="neo-input text-xs font-black px-2 py-1.5 bg-brand-bg cursor-pointer"
          >
            <option value="all">All styles</option>
            {availableStyles.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-subtle tabular-nums">
              {filtered.length} of {entries.length}
            </span>
            {entries.length > 0 && (
              confirmEmpty ? (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Really empty?</span>
                  <button
                    onClick={() => { onEmptyAll(); setConfirmEmpty(false); }}
                    className="neo-btn px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-red-500 text-white"
                    style={{ boxShadow: '2px 2px 0 #7f1d1d' }}
                  >Yes, empty</button>
                  <button
                    onClick={() => setConfirmEmpty(false)}
                    className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-brand-bg text-brand-text"
                    style={{ borderRadius: 1 }}
                  >Cancel</button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmEmpty(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-brand-bg text-brand-text hover:bg-red-500 hover:text-white transition-colors"
                  style={{ borderRadius: 1 }}
                  title="Permanently delete all entries"
                >
                  <TrashIcon className="w-3 h-3" />
                  Empty bin
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {entries.length === 0 ? (
          <div className="max-w-md mx-auto text-center mt-20">
            <div className="text-6xl mb-4 opacity-30">♻️</div>
            <div className="text-sm font-black uppercase tracking-widest text-brand-subtle">Bin is empty</div>
            <p className="text-xs text-brand-subtle/60 mt-2">
              Discarded images from regenerations, clears and deletes will appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="max-w-md mx-auto text-center mt-20">
            <div className="text-sm font-black uppercase tracking-widest text-brand-subtle">No matches</div>
            <p className="text-xs text-brand-subtle/60 mt-2">Try clearing filters or the search box.</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className="bg-brand-surface border-2 border-black flex flex-col overflow-hidden"
                style={{ boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
              >
                {/* Image */}
                <div className="relative aspect-square bg-brand-bg overflow-hidden">
                  <img
                    src={`data:image/jpeg;base64,${entry.base64Image}`}
                    alt={entry.prompt}
                    className="w-full h-full object-cover"
                  />
                  {/* Reason tag */}
                  <div
                    className="absolute top-1.5 left-1.5 px-1.5 py-px text-[8px] font-black uppercase tracking-widest border-2 border-black bg-brand-surface text-brand-text"
                    style={{ borderRadius: 1 }}
                  >
                    {entry.reason}
                  </div>
                </div>
                {/* Origin metadata */}
                <div className="px-2 py-1.5 border-t-2 border-black/10 bg-brand-bg">
                  <p className="text-[9px] font-black uppercase tracking-widest text-brand-text truncate" title={entry.sourceGroupTitle}>
                    {entry.sourceGroupTitle ?? '—'}
                  </p>
                  {entry.sourceSubgroupTitle && (
                    <p className="text-[8px] font-black text-brand-subtle truncate" title={entry.sourceSubgroupTitle}>
                      / {entry.sourceSubgroupTitle}
                    </p>
                  )}
                  <p className="text-[9px] text-brand-subtle/60 line-clamp-2 mt-1" title={entry.prompt}>
                    {entry.prompt}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex border-t-2 border-black/10 mt-auto">
                  {onAdopt && (
                    <button
                      onClick={() => onAdopt(entry)}
                      className="flex-1 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-300 hover:bg-emerald-400 text-black transition-colors border-r-2 border-black/10"
                      title="Adopt into this slot (moves out of bin)"
                    >Adopt</button>
                  )}
                  <a
                    href={`data:image/jpeg;base64,${entry.base64Image}`}
                    download={`${entry.sourceGroupTitle ?? 'image'}-${entry.id}.jpg`}
                    className="flex items-center justify-center px-2 py-1.5 text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors border-r-2 border-black/10"
                    title="Download"
                    onClick={e => e.stopPropagation()}
                  >
                    <DownloadIcon className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => onDeleteOne(entry.id)}
                    className="px-2 py-1.5 text-brand-subtle hover:text-white hover:bg-red-500 transition-colors"
                    title="Delete permanently"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecycleBinModal;
