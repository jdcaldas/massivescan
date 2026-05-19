import type { WorldMeta, SavedDesign } from '../types';

const worldsApi = (pid: string) => `/api/projects/${pid}/worlds`;
const SETTINGS_API = '/api/settings';

// ── Index ────────────────────────────────────────────────────────────────────

export async function loadIndex(projectId: string): Promise<WorldMeta[]> {
  try {
    const res = await fetch(worldsApi(projectId));
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// ── Individual worlds ────────────────────────────────────────────────────────

export async function loadWorld(projectId: string, id: string): Promise<SavedDesign | null> {
  try {
    const res = await fetch(`${worldsApi(projectId)}/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function saveWorld(projectId: string, design: SavedDesign): Promise<void> {
  await fetch(`${worldsApi(projectId)}/${design.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(design, null, 2),
  }).catch(() => {});
}

export async function deleteWorld(projectId: string, id: string): Promise<void> {
  await fetch(`${worldsApi(projectId)}/${id}`, { method: 'DELETE' }).catch(() => {});
}

export async function patchWorldMeta(projectId: string, id: string, patch: Partial<WorldMeta>): Promise<void> {
  await fetch(`${worldsApi(projectId)}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

// ── Deck configs (project-scoped, stored in cards/saved/) ───────────────────

export interface DeckFileMeta {
  name: string;
  modified: string;
  deckName: string;
}

export async function listDecks(projectId: string): Promise<DeckFileMeta[]> {
  try {
    const res = await fetch(`/api/projects/${projectId}/cards/list`);
    if (!res.ok) return [];
    return (await res.json()).files ?? [];
  } catch { return []; }
}

export async function loadDeck(projectId: string, filename: string): Promise<unknown | null> {
  try {
    const res = await fetch(`/api/projects/${projectId}/cards/load?file=${encodeURIComponent(filename)}`);
    if (!res.ok) return null;
    return (await res.json()).data ?? null;
  } catch { return null; }
}

export async function saveDeck(projectId: string, filename: string, data: unknown): Promise<void> {
  await fetch(`/api/projects/${projectId}/cards/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, data }),
  }).catch(() => {});
}

// ── Settings (global, not project-scoped) ───────────────────────────────────

export async function loadSettings(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(SETTINGS_API);
    if (!res.ok) return null;
    const data = await res.json();
    return Object.keys(data).length > 0 ? data : null;
  } catch { return null; }
}

export async function saveSettings(settings: unknown): Promise<void> {
  await fetch(SETTINGS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings, null, 2),
  }).catch(() => {});
}
