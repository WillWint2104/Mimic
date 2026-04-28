# TODO

Loose, undated backlog. Not a substitute for PR / issue tracking — just a list of things the team has agreed are coming, so they don't get forgotten.

## Review automation

- [ ] **Replace CodeRabbit before end of this month.** CodeRabbit is being phased out; we'll add a new AI reviewer (likely Claude Code itself running as a GitHub Action) to take over the same loop-until-clean role on PRs. Track this as a GitHub issue once the repo has issues enabled, and link it from here.

## Architecture

- [ ] Decide Electron vs Tauri (PR 2). See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the open questions.
- [ ] Decide cross-process keystroke injection approach for Windows (then macOS, then Linux).
- [ ] Decide local storage format for cadence traces and style samples.

## CI

- [ ] Replace the CI skeleton in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) with real lint, type-check, and test jobs once a stack is chosen.
- [ ] Add a manual-demo checklist item to the PR template for any PR that touches cadence playback or style output. (Currently called out in the PR template body; promote to a checkbox once the demo format stabilises.)

## Housekeeping

- [ ] Enable issues on the GitHub repo and migrate this list once it grows past ~10 items.
