// ─────────────────────────────────────────────────────────────────────────────
// Recycle Bin service — manages discarded images per project.
// Storage: projects/<pid>/design/recycle_bin.json (via /api/projects/<pid>/recycle-bin)
//
// Cap: 250 entries, FIFO (oldest is dropped when capacity is exceeded).
// Visual urgency thresholds (consumed by the UI):
//   • < WARN_AT  → green (normal)
//   • >= WARN_AT → yellow (getting full)
//   • >= URGENT_AT → red (about to drop oldest)
// ─────────────────────────────────────────────────────────────────────────────

import type { RecycleBinEntry } from '../types';

export const BIN_CAP        = 250;
export const BIN_WARN_AT    = 200;
export const BIN_URGENT_AT  = 240;

const API = (projectId: string) => `/api/projects/${projectId}/recycle-bin`;

/** Load all bin entries (chronological order; newest last). */
export async function loadBin(projectId: string): Promise<RecycleBinEntry[]> {
  try {
    const res = await fetch(API(projectId));
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

/** Persist the entire bin to disk. */
export async function saveBin(projectId: string, entries: RecycleBinEntry[]): Promise<void> {
  await fetch(API(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  }).catch(() => {});
}

/** Add one entry. Returns the new full bin (with cap applied). */
export async function addToBin(projectId: string, entry: Omit<RecycleBinEntry, 'id' | 'discardedAt'>): Promise<RecycleBinEntry[]> {
  const current = await loadBin(projectId);
  const full: RecycleBinEntry = {
    ...entry,
    id: `bin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    discardedAt: new Date().toISOString(),
  };
  let next = [...current, full];
  // FIFO cap — drop oldest if we're over
  if (next.length > BIN_CAP) next = next.slice(next.length - BIN_CAP);
  await saveBin(projectId, next);
  return next;
}

/** Add many entries at once (batch — single save). */
export async function addManyToBin(
  projectId: string,
  entries: Omit<RecycleBinEntry, 'id' | 'discardedAt'>[],
): Promise<RecycleBinEntry[]> {
  if (entries.length === 0) return loadBin(projectId);
  const current = await loadBin(projectId);
  const now = Date.now();
  const fullEntries: RecycleBinEntry[] = entries.map((e, i) => ({
    ...e,
    id: `bin-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    discardedAt: new Date(now + i).toISOString(),
  }));
  let next = [...current, ...fullEntries];
  if (next.length > BIN_CAP) next = next.slice(next.length - BIN_CAP);
  await saveBin(projectId, next);
  return next;
}

/** Remove one entry (used both by "adopt" and by "delete permanently"). */
export async function removeFromBin(projectId: string, entryId: string): Promise<RecycleBinEntry[]> {
  const current = await loadBin(projectId);
  const next = current.filter(e => e.id !== entryId);
  await saveBin(projectId, next);
  return next;
}

/** Empty the bin entirely (with optional filter for partial purge). */
export async function emptyBin(projectId: string, filter?: (e: RecycleBinEntry) => boolean): Promise<RecycleBinEntry[]> {
  if (!filter) {
    await saveBin(projectId, []);
    return [];
  }
  const current = await loadBin(projectId);
  const next = current.filter(e => !filter(e));
  await saveBin(projectId, next);
  return next;
}

/** Urgency level for the current bin size — drives header chip color. */
export type BinUrgency = 'normal' | 'warn' | 'urgent';
export function urgencyFor(count: number): BinUrgency {
  if (count >= BIN_URGENT_AT) return 'urgent';
  if (count >= BIN_WARN_AT)   return 'warn';
  return 'normal';
}
