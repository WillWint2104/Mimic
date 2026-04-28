# Roadmap

Rough phases. Order is intentional; each phase unblocks the next. Dates are deliberately omitted — this is a personal project and timing will flex.

## Phase 0 — Repo bootstrap *(in progress)*

- Repo, README, license, gitignore. ✅ (bootstrap commits on `main`)
- Scaffolding PR: docs stubs, PR template, CI skeleton. *(this branch)*
- CodeRabbit AI review wired up.

## Phase 1 — Architecture decision

- Pick desktop framework: **Electron vs Tauri**.
- Pick cross-process keystroke injection approach (Windows first).
- Pick local storage format for cadence traces and style samples.
- Land decisions in [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Replace the CI skeleton with real lint + type-check + test jobs for the chosen stack.

## Phase 2 — Cadence MVP

- Training drill UI: prompts the user to type a target string, records every keystroke event with timing.
- Local storage of cadence traces.
- Cadence playback into Mimic's own input field (not yet cross-process), at recorded rhythm including pauses, backspaces, and corrections.

## Phase 3 — Cross-process keystroke injection

- Native bridge: send keystrokes into the currently focused external window.
- Manual demo: train a short cadence, focus a Notepad / browser field, replay text into it.
- Safety rails: a clear "arm / disarm" toggle so the app cannot type into something the user didn't intend.

## Phase 4 — Style cartridge MVP

- Drop-in JSON format for training prompts; the app segments them into individual training cards.
- Free-form writing capture per card, tagged.
- Cartridge persistence and tag-based selection.

## Phase 5 — Style rewrite via Claude API

- Compose view: paste bullets, pick relevant tags, get back a draft in the user's voice.
- Use the cartridge as context (with prompt caching).
- Manual review step before anything is typed.

## Phase 6 — End-to-end loop

- Bullets → style rewrite → cadence playback → real keystrokes into the focused external app.
- This is the headline demo and the bar for "v0.1 alpha".

## Phase 7+ — Future

- macOS and Linux support for the native bridge.
- Multi-cartridge management (different voices for different contexts).
- Quality-of-life: shortcut to invoke Mimic from anywhere, history of generated drafts, undo / safety holds.
- Possible Python service if model work outgrows the desktop process.

## Cross-cutting

- Replace CodeRabbit with the new AI reviewer (likely Claude Code as a GitHub Action) before the end of this month — see [`TODO.md`](TODO.md).
- Manual demo step is required on every PR that touches cadence playback or style output. Automated review can't verify "does this feel right".
