# TODO

Loose, undated backlog. Not a substitute for PR / issue tracking — just a list of things the team has agreed are coming, so they don't get forgotten.

## Review automation

- [ ] **Replace CodeRabbit before end of May 2026.** CodeRabbit is being phased out; we'll add a new AI reviewer (likely Claude Code itself running as a GitHub Action) to take over the same loop-until-clean role on PRs. A scheduled remote agent is set to draft the replacement around 2026-05-22 to give us a side-by-side overlap window before the cutover. Track this as a GitHub issue once the repo has issues enabled, and link it from here.

## Architecture

- [x] **Decide Electron vs Tauri** — Electron, locked in by PR #2.
- [ ] Decide the keystroke-injection library — `@nut-tree-fork/nut-js` is the frontrunner, with `robotjs` and a custom `SendInput` N-API addon as documented fallbacks. Compatibility spike + native-bridge integration is its own PR after the prototype port (PR 4).
- [ ] Decide local storage format for cadence traces and style samples (flat per-session JSON vs SQLite). Resolve in a follow-up PR.
- [ ] Decide whether cadence playback runs in the main process or behind a small local service. Default is in-process; revisit only if it gets unwieldy.

## CI

- [x] **Replace the CI skeleton** with real lint + typecheck + smoke-build jobs (PR #3).
- [ ] Add a unit-test job once there's testable code. Vitest is the obvious pick for a TS/Vite project; defer until there's something to test.
- [ ] Add a Windows runner for the build job once we start producing real installers (currently smoke-builds on Ubuntu only).
- [ ] Add a manual-demo checklist item to the PR template for any PR that touches cadence playback or style output. Currently called out in the PR template body; promote to a checkbox once the demo format stabilises.

## Packaging / distribution

- [ ] Configure makers for real Windows installers (Squirrel for in-app updates is wired into `forge.config.ts` defaults but not exercised yet).
- [ ] Wire `electron-squirrel-startup` into `src/main.ts` so first-install / uninstall events on Windows are handled correctly. Stubbed out in PR #3.
- [ ] Code-signing path on Windows. See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) §5 — start unsigned, revisit when v1 is worth distributing more widely (and check whether any colleague testers run AppLocker/WDAC-managed laptops, since unsigned won't run there).

## App / product

- [ ] Port the existing browser-based cadence-trainer prototype into the Electron renderer (PR 4).
- [ ] Pair-capture: extend the trainer to capture freeform writing samples alongside cadence in the same session.
- [ ] Drop-in JSON format for training prompts; segment into individual training cards.

## Housekeeping

- [ ] Enable issues on the GitHub repo and migrate this list once it grows past ~10 items.
- [ ] Sync the `APP_VERSION` constant in `src/shared/version.ts` with `package.json`'s `version` automatically (build-time injection via Vite). Currently a manual two-place update.
