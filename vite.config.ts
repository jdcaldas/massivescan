import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ARCHIVE_DIR   = path.resolve(__dirname, 'archive');
const WORLDS_DIR    = path.join(ARCHIVE_DIR, 'worlds');
const INDEX_FILE    = path.join(ARCHIVE_DIR, 'index.json');
const SETTINGS_FILE = path.join(ARCHIVE_DIR, 'massivescan_settings.json');
const OLD_ARCHIVE   = path.join(ARCHIVE_DIR, 'massivescan_archive.json');
const USAGE_FILE    = path.join(ARCHIVE_DIR, 'massivescan_usage.json');
const CARDS_SAVE_DIR = path.resolve(__dirname, 'cards', 'saved');
const PROJECTS_DIR = path.resolve(__dirname, 'projects');

// ── Index helpers ────────────────────────────────────────────────────────────

function readIndex(): any[] {
  if (!fs.existsSync(INDEX_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')); } catch { return []; }
}

function writeIndex(index: any[]): void {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

function metaFromDesign(d: any) {
  return { id: d.id, theme: d.theme, themeDescription: d.themeDescription,
           savedAt: d.savedAt, groupCount: d.groupCount,
           language: d.language, locked: d.locked };
}

function upsertIndex(design: any): void {
  const index = readIndex();
  const meta = metaFromDesign(design);
  const i = index.findIndex((m: any) => m.id === design.id);
  if (i >= 0) index[i] = meta; else index.unshift(meta);
  writeIndex(index);
}

function removeFromIndex(id: string): void {
  writeIndex(readIndex().filter((m: any) => m.id !== id));
}

function patchIndex(id: string, patch: any): void {
  const index = readIndex();
  const i = index.findIndex((m: any) => m.id === id);
  if (i >= 0) { index[i] = { ...index[i], ...patch }; writeIndex(index); }
}

// ── Migration from old single-file format ────────────────────────────────────

function migrate(): void {
  if (!fs.existsSync(OLD_ARCHIVE) || fs.existsSync(INDEX_FILE)) return;
  try {
    const old: any[] = JSON.parse(fs.readFileSync(OLD_ARCHIVE, 'utf-8'));
    const index: any[] = [];
    for (const design of old) {
      fs.writeFileSync(
        path.join(WORLDS_DIR, `${design.id}.json`),
        JSON.stringify(design, null, 2), 'utf-8'
      );
      index.push(metaFromDesign(design));
    }
    writeIndex(index);
    fs.renameSync(OLD_ARCHIVE, OLD_ARCHIVE + '.migrated');
    console.log(`[massivescan] Migrated ${old.length} world(s) to per-file format.`);
  } catch (e) {
    console.error('[massivescan] Migration failed:', e);
  }
}

// ── Usage helpers ────────────────────────────────────────────────────────────

function readUsage(): any {
  if (!fs.existsSync(USAGE_FILE)) return { days: {} };
  try { return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8')); } catch { return { days: {} }; }
}

function mergeUsage(date: string, model: string, tokensIn: number, tokensOut: number): void {
  const data = readUsage();
  if (!data.days[date]) data.days[date] = { models: {} };
  const m = data.days[date].models;
  if (!m[model]) m[model] = { calls: 0, tokensIn: 0, tokensOut: 0 };
  m[model].calls   += 1;
  m[model].tokensIn  += tokensIn;
  m[model].tokensOut += tokensOut;
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Body reader helper ───────────────────────────────────────────────────────

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ── Projects helpers ─────────────────────────────────────────────────────────

function readProjectsIndex(): any[] {
  const f = path.join(PROJECTS_DIR, 'index.json');
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return []; }
}
function writeProjectsIndex(list: any[]): void {
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROJECTS_DIR, 'index.json'), JSON.stringify(list, null, 2), 'utf-8');
}
function readProjectDesignIndex(pid: string): any[] {
  const f = path.join(PROJECTS_DIR, pid, 'design', 'index.json');
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return []; }
}
function writeProjectDesignIndex(pid: string, list: any[]): void {
  const dir = path.join(PROJECTS_DIR, pid, 'design');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(list, null, 2), 'utf-8');
}
function upsertProjectDesignIndex(pid: string, design: any): void {
  const list = readProjectDesignIndex(pid);
  const meta = { id: design.id, theme: design.theme, themeDescription: design.themeDescription, savedAt: design.savedAt, groupCount: design.groupCount, language: design.language, locked: design.locked };
  const i = list.findIndex((m: any) => m.id === design.id);
  if (i >= 0) list[i] = meta; else list.unshift(meta);
  writeProjectDesignIndex(pid, list);
}

// ── Vite plugin ──────────────────────────────────────────────────────────────

function localArchivePlugin() {
  return {
    name: 'local-archive',
    configureServer(server: any) {
      if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
      if (!fs.existsSync(WORLDS_DIR))  fs.mkdirSync(WORLDS_DIR,  { recursive: true });
      migrate();

      // ── /api/worlds ── index + individual worlds ────────────────────────
      server.middlewares.use('/api/worlds', async (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
        if (req.method === 'OPTIONS') { res.end(); return; }

        // req.url is path after '/api/worlds', e.g. '' | '/' | '/abc123'
        const id = (req.url || '/').replace(/^\//, '').split('?')[0];

        try {
          if (req.method === 'GET') {
            if (!id) {
              // Return index (metadata only)
              res.end(JSON.stringify(readIndex()));
            } else {
              const file = path.join(WORLDS_DIR, `${id}.json`);
              if (fs.existsSync(file)) {
                res.end(fs.readFileSync(file, 'utf-8'));
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'World not found' }));
              }
            }
            return;
          }

          if (req.method === 'POST') {
            const body = await readBody(req);
            const design = JSON.parse(body);
            const worldId = id || design.id;
            fs.writeFileSync(path.join(WORLDS_DIR, `${worldId}.json`), body, 'utf-8');
            upsertIndex(design);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === 'DELETE' && id) {
            const file = path.join(WORLDS_DIR, `${id}.json`);
            if (fs.existsSync(file)) fs.unlinkSync(file);
            removeFromIndex(id);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === 'PATCH' && id) {
            const body = await readBody(req);
            const patch = JSON.parse(body);
            // Update index
            patchIndex(id, patch);
            // Also patch the world file so loaded data stays consistent
            const file = path.join(WORLDS_DIR, `${id}.json`);
            if (fs.existsSync(file)) {
              const design = JSON.parse(fs.readFileSync(file, 'utf-8'));
              Object.assign(design, patch);
              if (patch.theme && design.data) design.data.theme = patch.theme;
              fs.writeFileSync(file, JSON.stringify(design, null, 2), 'utf-8');
            }
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          res.statusCode = 405; res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });

      // ── /api/cards/* ── deck save/load/list/delete ──────────────────────
      server.middlewares.use('/api/cards', async (req: any, res: any) => {
        const json = (data: object) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        if (!fs.existsSync(CARDS_SAVE_DIR)) fs.mkdirSync(CARDS_SAVE_DIR, { recursive: true });

        const action = (req.url || '/').replace(/^\//, '').split('?')[0]; // save | list | load | delete

        try {
          if (action === 'save' && req.method === 'POST') {
            const body = await readBody(req);
            const { filename, data } = JSON.parse(body);
            fs.writeFileSync(path.join(CARDS_SAVE_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
            json({ success: true, file: filename });
            return;
          }

          if (action === 'list' && req.method === 'GET') {
            const files = fs.readdirSync(CARDS_SAVE_DIR)
              .filter(f => f.endsWith('.json'))
              .map(f => {
                const fp = path.join(CARDS_SAVE_DIR, f);
                const stat = fs.statSync(fp);
                let deckName = '';
                try { deckName = JSON.parse(fs.readFileSync(fp, 'utf-8'))?.deck_details?.deck_name ?? ''; } catch {}
                return { name: f, modified: stat.mtime.toISOString(), deckName };
              })
              .sort((a, b) => b.modified.localeCompare(a.modified));
            json({ files });
            return;
          }

          if (action === 'load' && req.method === 'GET') {
            const qs = (req.url ?? '').split('?')[1] ?? '';
            const filename = new URLSearchParams(qs).get('file') ?? '';
            const fp = path.join(CARDS_SAVE_DIR, path.basename(filename));
            if (!fs.existsSync(fp)) { res.statusCode = 404; json({ error: 'Not found' }); return; }
            json({ success: true, data: JSON.parse(fs.readFileSync(fp, 'utf-8')) });
            return;
          }

          if (action === 'delete' && req.method === 'DELETE') {
            const qs = (req.url ?? '').split('?')[1] ?? '';
            const filename = new URLSearchParams(qs).get('file') ?? '';
            const fp = path.join(CARDS_SAVE_DIR, path.basename(filename));
            if (!fs.existsSync(fp)) { res.statusCode = 404; json({ error: 'Not found' }); return; }
            fs.unlinkSync(fp);
            json({ success: true });
            return;
          }

          res.statusCode = 404; json({ error: 'Unknown cards action' });
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: String(e) }));
        }
      });

      // ── /api/projects ── project CRUD + scoped worlds + cards ───────────
      server.middlewares.use('/api/projects', async (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
        if (req.method === 'OPTIONS') { res.end(); return; }

        // Parse URL: /api/projects → segments = []
        // /api/projects/abc → ['abc']
        // /api/projects/abc/worlds → ['abc', 'worlds']
        // /api/projects/abc/worlds/xyz → ['abc', 'worlds', 'xyz']
        // /api/projects/abc/cards/list → ['abc', 'cards', 'list']
        const rawUrl = (req.url || '/').split('?')[0];
        const qs = (req.url || '').split('?')[1] ?? '';
        const segments = rawUrl.replace(/^\//, '').split('/').filter(Boolean);
        const [pid, section, subId] = segments;

        try {
          // ── Project CRUD (no pid in URL) ──
          if (!pid) {
            if (req.method === 'GET') {
              res.end(JSON.stringify(readProjectsIndex()));
            } else if (req.method === 'POST') {
              const body = JSON.parse(await readBody(req));
              if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
              const projectDir = path.join(PROJECTS_DIR, body.id);
              fs.mkdirSync(path.join(projectDir, 'design', 'worlds'), { recursive: true });
              fs.mkdirSync(path.join(projectDir, 'cards', 'saved'), { recursive: true });
              fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(body, null, 2));
              const list = readProjectsIndex();
              list.unshift({ id: body.id, name: body.name, client: body.client, createdAt: body.createdAt, updatedAt: body.updatedAt, status: body.status });
              writeProjectsIndex(list);
              res.end(JSON.stringify({ ok: true }));
            } else { res.statusCode = 405; res.end(); }
            return;
          }

          // ── Single project ops (DELETE, PATCH) ──
          if (pid && !section) {
            if (req.method === 'DELETE') {
              const projectDir = path.join(PROJECTS_DIR, pid);
              if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true, force: true });
              writeProjectsIndex(readProjectsIndex().filter((p: any) => p.id !== pid));
              res.end(JSON.stringify({ ok: true }));
            } else if (req.method === 'PATCH') {
              const patch = JSON.parse(await readBody(req));
              const list = readProjectsIndex();
              const i = list.findIndex((p: any) => p.id === pid);
              if (i >= 0) { list[i] = { ...list[i], ...patch }; writeProjectsIndex(list); }
              const pf = path.join(PROJECTS_DIR, pid, 'project.json');
              if (fs.existsSync(pf)) {
                const proj = JSON.parse(fs.readFileSync(pf, 'utf-8'));
                fs.writeFileSync(pf, JSON.stringify({ ...proj, ...patch }, null, 2));
              }
              res.end(JSON.stringify({ ok: true }));
            } else { res.statusCode = 405; res.end(); }
            return;
          }

          // ── /api/projects/:pid/worlds ──
          if (section === 'worlds') {
            const worldsDir = path.join(PROJECTS_DIR, pid, 'design', 'worlds');
            if (!fs.existsSync(worldsDir)) fs.mkdirSync(worldsDir, { recursive: true });

            if (req.method === 'GET') {
              if (!subId) {
                res.end(JSON.stringify(readProjectDesignIndex(pid)));
              } else {
                const f = path.join(worldsDir, `${subId}.json`);
                if (fs.existsSync(f)) res.end(fs.readFileSync(f, 'utf-8'));
                else { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); }
              }
            } else if (req.method === 'POST' && subId) {
              const body = await readBody(req);
              fs.writeFileSync(path.join(worldsDir, `${subId}.json`), body);
              upsertProjectDesignIndex(pid, JSON.parse(body));
              res.end(JSON.stringify({ ok: true }));
            } else if (req.method === 'DELETE' && subId) {
              const f = path.join(worldsDir, `${subId}.json`);
              if (fs.existsSync(f)) fs.unlinkSync(f);
              writeProjectDesignIndex(pid, readProjectDesignIndex(pid).filter((m: any) => m.id !== subId));
              res.end(JSON.stringify({ ok: true }));
            } else if (req.method === 'PATCH' && subId) {
              const patch = JSON.parse(await readBody(req));
              const list = readProjectDesignIndex(pid);
              const i = list.findIndex((m: any) => m.id === subId);
              if (i >= 0) { list[i] = { ...list[i], ...patch }; writeProjectDesignIndex(pid, list); }
              const f = path.join(worldsDir, `${subId}.json`);
              if (fs.existsSync(f)) {
                const d = JSON.parse(fs.readFileSync(f, 'utf-8'));
                Object.assign(d, patch);
                if (patch.theme && d.data) d.data.theme = patch.theme;
                fs.writeFileSync(f, JSON.stringify(d, null, 2));
              }
              res.end(JSON.stringify({ ok: true }));
            } else { res.statusCode = 405; res.end(); }
            return;
          }

          // ── /api/projects/:pid/cards/* ──
          if (section === 'cards') {
            const cardsDir = path.join(PROJECTS_DIR, pid, 'cards', 'saved');
            if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });
            const action = subId; // list | save | load | delete

            if (action === 'list' && req.method === 'GET') {
              const files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'))
                .map(f => {
                  const fp = path.join(cardsDir, f);
                  let deckName = '';
                  try { deckName = JSON.parse(fs.readFileSync(fp, 'utf-8'))?.deck_details?.deck_name ?? ''; } catch {}
                  return { name: f, modified: fs.statSync(fp).mtime.toISOString(), deckName };
                }).sort((a, b) => b.modified.localeCompare(a.modified));
              res.end(JSON.stringify({ files }));
            } else if (action === 'save' && req.method === 'POST') {
              const { filename, data } = JSON.parse(await readBody(req));
              fs.writeFileSync(path.join(cardsDir, filename), JSON.stringify(data, null, 2));
              res.end(JSON.stringify({ success: true, file: filename }));
            } else if (action === 'load' && req.method === 'GET') {
              const filename = new URLSearchParams(qs).get('file') ?? '';
              const fp = path.join(cardsDir, path.basename(filename));
              if (!fs.existsSync(fp)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); return; }
              res.end(JSON.stringify({ success: true, data: JSON.parse(fs.readFileSync(fp, 'utf-8')) }));
            } else if (action === 'delete' && req.method === 'DELETE') {
              const filename = new URLSearchParams(qs).get('file') ?? '';
              const fp = path.join(cardsDir, path.basename(filename));
              if (fs.existsSync(fp)) fs.unlinkSync(fp);
              res.end(JSON.stringify({ success: true }));
            } else if (action === 'settings' && req.method === 'GET') {
              const sf = path.join(PROJECTS_DIR, pid, 'cards', 'cards_settings.json');
              res.end(fs.existsSync(sf) ? fs.readFileSync(sf, 'utf-8') : JSON.stringify({ defaultDeck: null }));
            } else if (action === 'settings' && req.method === 'POST') {
              const body = JSON.parse(await readBody(req));
              const sf = path.join(PROJECTS_DIR, pid, 'cards', 'cards_settings.json');
              fs.writeFileSync(sf, JSON.stringify(body, null, 2));
              res.end(JSON.stringify({ ok: true }));
            } else { res.statusCode = 404; res.end(JSON.stringify({ error: 'Unknown action' })); }
            return;
          }

          // ── /api/projects/:pid/recycle-bin ────────────────────────────
          if (section === 'recycle-bin') {
            const designDir = path.join(PROJECTS_DIR, pid, 'design');
            if (!fs.existsSync(designDir)) fs.mkdirSync(designDir, { recursive: true });
            const binFile = path.join(designDir, 'recycle_bin.json');

            if (req.method === 'GET') {
              if (!fs.existsSync(binFile)) {
                res.end(JSON.stringify({ entries: [] }));
                return;
              }
              try {
                const data = JSON.parse(fs.readFileSync(binFile, 'utf-8'));
                res.end(JSON.stringify({ entries: data.entries ?? [] }));
              } catch {
                res.end(JSON.stringify({ entries: [] }));
              }
              return;
            }
            if (req.method === 'POST') {
              const body = JSON.parse(await readBody(req));
              const entries = Array.isArray(body?.entries) ? body.entries : [];
              fs.writeFileSync(binFile, JSON.stringify({ entries }, null, 2));
              res.end(JSON.stringify({ ok: true, count: entries.length }));
              return;
            }
            res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          res.statusCode = 404; res.end(JSON.stringify({ error: 'Unknown endpoint' }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });

      // ── /api/settings ───────────────────────────────────────────────────
      server.middlewares.use('/api/settings', async (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') { res.end(); return; }

        try {
          if (req.method === 'GET') {
            const data = fs.existsSync(SETTINGS_FILE)
              ? fs.readFileSync(SETTINGS_FILE, 'utf-8') : '{}';
            res.end(data);
            return;
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            JSON.parse(body); // validate
            fs.writeFileSync(SETTINGS_FILE, body, 'utf-8');
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          res.statusCode = 405; res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });

      // ── /api/usage ──────────────────────────────────────────────────────
      server.middlewares.use('/api/usage', async (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') { res.end(); return; }

        try {
          if (req.method === 'GET') {
            res.end(JSON.stringify(readUsage()));
            return;
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            const { date, model, tokensIn, tokensOut } = JSON.parse(body);
            mergeUsage(date, model, tokensIn ?? 0, tokensOut ?? 0);
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          res.statusCode = 405; res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: { port: 7777, host: '0.0.0.0' },
    plugins: [react(), localArchivePlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  };
});
