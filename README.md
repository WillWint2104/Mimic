# Mimic

> **Status: pre-alpha, in early development.** Nothing here is stable. Interfaces and file layouts are still expected to change.

Mimic is a desktop application that learns to type and write like its user, then drives real keystrokes into other applications (Outlook, browsers, Word, etc.) so that generated text arrives in the user's own voice and at the user's own typing rhythm.

## What it does

Mimic pairs two models, both trained on the same sessions:

1. **Cadence model** — captures keystroke timing, pauses, backspaces, and corrections during training drills, then plays text back into any focused field on the desktop at the user's learned rhythm.
2. **Style cartridge** — a curated collection of the user's writing samples plus tags. Used as context for an LLM (Claude API) to rewrite bullet-point input in the user's voice. JSON files of training prompts can be dropped in; the app segments them into individual training cards where the user writes responses freely.

End-to-end flow: drop in bullet points or rough notes → app produces a polished response in the user's voice → app types it into a real application at the user's real cadence.

## Planned architecture

**Electron** is the chosen desktop framework (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the comparison and decision rationale). The shell must be able to:

- Send real OS-level keystrokes into other applications (not just into Mimic's own windows).
- Run a local training UI for cadence drills and style writing.
- Talk to the Claude API for style-driven rewrites.
- Persist cadence data and style cartridges locally, paired by training session.

Shape:

- **Renderer** — TypeScript + HTML/CSS, hosted inside the Electron shell.
- **Main process** — TypeScript on Node, owns the lifecycle and the eventual native-keystroke bridge.
- **Native bridge** — `@nut-tree-fork/nut-js` is the current frontrunner; library decision lands in its own PR after the prototype port (see [`docs/ROADMAP.md`](docs/ROADMAP.md)).
- **Local storage** — flat JSON or SQLite, decided in a follow-up PR.

A working browser-based prototype of the cadence-only training UI exists separately and will inform the v1 renderer (ports in PR 4).

## Repository layout

```text
index.html             Renderer HTML entrypoint (Vite resolves /src/renderer.ts at build time)
src/
  main.ts              Electron main process (window lifecycle, eventual native bridge)
  preload.ts           Privileged bridge between main and renderer (currently empty)
  renderer.ts          Renderer entrypoint
  index.css            Renderer styles
  shared/              Code shared between main and renderer (types, constants)
docs/                  Architecture notes, roadmap, TODOs
.github/               PR template and CI workflow
forge.config.ts        Electron Forge configuration
vite.*.config.ts       Vite build configs (one per Forge target: main / preload / renderer)
```

## Development

Requires **Node 22+** (see `.nvmrc`).

```bash
# install once
npm ci

# start the app in dev mode (hot-reloads renderer; main/preload changes need a restart)
npm start

# package an unpacked build (smoke build — what CI runs)
npm run package

# lint / format / typecheck individually
npm run lint
npm run format
npm run typecheck
```

A pre-commit hook (husky + lint-staged) runs ESLint and Prettier on staged files. CI runs the same checks plus an `electron-forge package` smoke build on every PR.

### Manual verification before pushing

Lint, typecheck, and `format:check` together prove the code compiles and conforms — they do **not** prove the app actually runs. Before pushing any change that touches `src/main.ts`, `src/preload.ts`, `src/renderer.ts`, `index.html`, `src/index.css`, `forge.config.ts`, or any of the `vite.*.config.ts` files:

```bash
npm start
```

Then eyeball the window:

- The "Mimic" splash text and the version line are visible (not a blank `<body>`).
- DevTools console (Ctrl+Shift+I / Cmd+Option+I) shows no errors and no Content-Security-Policy warnings.
- Closing the window quits the process cleanly.

Skipping this check is how you ship a blank window with passing CI — PR #3's first push did exactly that. CI will not catch a blank renderer; the smoke `package` build only proves the build pipeline succeeds, not that the app _displays_ anything.

All changes go through pull requests on feature branches off `main`. See the PR template for the expected description format.

## License

[MIT](LICENSE)
