# Massive Scan – Project Instructions

## Persistence Rule (CRITICAL)
**Every user-configurable value, preference, or decision MUST be persisted to a config/JSON file — never only to `localStorage`.**

- Settings → `archive/massivescan_settings.json` (via Vite server plugin at `/api/settings`)
- Archive/Worlds → `archive/massivescan_archive.json` (already wired via `/api/archive`)
- Any future per-session or per-project config → a dedicated JSON file under `archive/`

If a new setting or decision is added to the UI, the first thing to do is wire it to a file. `localStorage` may be used as a cache/fallback but is never the source of truth.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
