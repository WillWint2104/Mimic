# Architecture

> **Stub.** This file will be filled in by the architecture-decision PR (PR 2). It exists now so future PRs have a stable place to point at.

## Purpose

Mimic must:

1. Capture keystroke timing and corrections during training drills.
2. Capture freeform writing samples (paired with the same training sessions) and tag them.
3. Train / fit two paired models per user:
   - **Cadence model** — typing rhythm.
   - **Style cartridge** — writing voice, used as LLM context.
4. Take bullet-point input, produce a polished response in the user's voice via the Claude API, and type it into any focused field on the desktop at the user's learned cadence.

## Open decisions (to be resolved in PR 2)

- **Desktop framework:** Electron vs Tauri. Both can ship a TypeScript UI. Tauri is lighter and Rust-native; Electron is more familiar and has richer native-keystroke libraries. Final choice gates almost everything else.
- **Cross-process keystroke injection:** which library / native API per OS (Windows first, then macOS, then Linux). Must work into arbitrary focused windows, not just Mimic's own.
- **Local storage format:** SQLite vs flat JSON for cadence traces and style samples. Cadence traces can be large; per-session files may be simpler than a single DB.
- **Model location:** does cadence playback run in-process, or behind a small local service? Same question for any future fine-tuning of the style side.
- **Optional Python service:** only added if model work outgrows what fits comfortably in the desktop process.

## Components (sketch — subject to PR 2)

```
+-------------------------------------------------+
|  Desktop shell (Electron or Tauri — TBD)        |
|  +-------------------------------------------+  |
|  |  UI (TypeScript)                          |  |
|  |  - Training drills (cadence capture)      |  |
|  |  - Style writing cards (sample capture)   |  |
|  |  - Compose view (bullets -> output)       |  |
|  +-------------------------------------------+  |
|  +-------------------------------------------+  |
|  |  Core services                            |  |
|  |  - Cadence recorder & player              |  |
|  |  - Style cartridge store                  |  |
|  |  - Claude API client                      |  |
|  +-------------------------------------------+  |
|  +-------------------------------------------+  |
|  |  Native bridge                            |  |
|  |  - OS-level keystroke injection           |  |
|  +-------------------------------------------+  |
+-------------------------------------------------+
            |
            v
   +------------------+         +-------------------+
   |  Local storage   |         |  Claude API       |
   |  (cadence,       |         |  (style rewrite)  |
   |   style, tags)   |         +-------------------+
   +------------------+
```

## Non-goals (for now)

- Multi-user / cloud sync.
- Mobile.
- Real-time collaborative editing.
- Anything that ships generated text without the user explicitly triggering playback.

## Reference prototype

A working browser-based prototype of the cadence-only training UI exists separately and informs the v1 design. It will not be ported directly — desktop shell, native bridge, and paired-style capture are all new.
