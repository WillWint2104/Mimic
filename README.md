# Mimic

> **Status: pre-alpha, in early development.** Nothing here is stable. Interfaces, file layouts, and the choice of desktop framework are all expected to change.

Mimic is a desktop application that learns to type and write like its user, then drives real keystrokes into other applications (Outlook, browsers, Word, etc.) so that generated text arrives in the user's own voice and at the user's own typing rhythm.

## What it does

Mimic pairs two models, both trained on the same sessions:

1. **Cadence model** — captures keystroke timing, pauses, backspaces, and corrections during training drills, then plays text back into any focused field on the desktop at the user's learned rhythm.
2. **Style cartridge** — a curated collection of the user's writing samples plus tags. Used as context for an LLM (Claude API) to rewrite bullet-point input in the user's voice. JSON files of training prompts can be dropped in; the app segments them into individual training cards where the user writes responses freely.

End-to-end flow: drop in bullet points or rough notes → app produces a polished response in the user's voice → app types it into a real application at the user's real cadence.

## Planned architecture

The desktop framework choice (**Electron vs Tauri**) is deliberately **not yet decided** — it will be settled in a dedicated architecture-decision PR. Whichever is picked must be able to:

- Send real OS-level keystrokes into other applications (not just into Mimic's own windows).
- Run a local training UI for cadence drills and style writing.
- Talk to the Claude API for style-driven rewrites.
- Persist cadence data and style cartridges locally, paired by training session.

Likely shape (subject to the architecture PR):

- **Frontend** — TypeScript + a component framework, hosted inside the chosen desktop shell.
- **Native bridge** — for cross-process keystroke injection.
- **Local storage** — for cadence traces, style samples, and tags.
- **Optional Python service** — if model training or analysis is heavier than what fits comfortably in the desktop process.

A working browser-based prototype of the cadence-only training UI exists and will inform the v1 design, but won't be ported directly.

## Repository layout

Currently bootstrap-only. Real source folders land in later PRs.

```
docs/               Architecture notes, roadmap, and TODOs (added in PR 1)
.github/            PR template and CI workflow (added in PR 1)
```

## Development

Stack-specific tooling (lint, type-check, tests) will be added alongside the framework decision. Until then, CI is a skeleton.

All changes go through pull requests on feature branches off `main`. See the PR template for the expected description format.

## License

[MIT](LICENSE)
