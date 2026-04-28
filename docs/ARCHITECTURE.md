# Architecture

> **Status:** This document is the architecture-decision PR (PR 2). It compares Electron and Tauri against Mimic's actual requirements and lands a recommendation. Once the recommendation is signed off, follow-up PRs implement against the chosen stack and this document gets pruned to the decision plus a short rationale.

## What Mimic actually has to do

Recapping from the kickoff so the comparison stays grounded:

- Capture keystroke timing during training drills (renderer-side, no native APIs).
- Capture freeform writing samples paired with the same training sessions (renderer-side).
- Persist cadence traces and style cartridges locally.
- Talk to the Claude API for style-driven rewrites (HTTPS from the trusted process).
- **Send real OS-level keystrokes into other applications on Windows** — Outlook, browsers, Word, etc. This is the hard requirement that constrains the framework choice.
- Initial target: Windows. macOS and Linux are later (see [`ROADMAP.md`](ROADMAP.md), Phase 7+).
- Ship to a small group of colleagues, not the public.

Solo developer. Comfortable in JS/TS. **Not** comfortable in Rust.

The architecture comparison below is structured around the six points raised in the kickoff for this PR.

---

## 1. OS-level keystroke injection

Both frameworks can drive real keystrokes into arbitrary focused windows on Windows, but the libraries, maintenance posture, and integration friction differ substantially.

### Electron — JS/TS-side libraries

| Library | Status | Windows support | Notes |
|---|---|---|---|
| **`robotjs`** | **Effectively unmaintained.** Last release on npm is years old; long-running issues around Node ABI compatibility and prebuilt binaries. | Works historically, but breaks on newer Node/Electron versions without manual rebuilds. | Avoid for a new project. |
| **`@nut-tree/nut-js`** (original) | Repo went **commercial / paid license** in 2023–2024. The free package on npm is no longer the primary source of truth. | Was the best option pre-license-change. | Not viable as the primary library now unless you pay. |
| **`@nut-tree-fork/nut-js`** | **Active community fork** of the last permissively-licensed nut-js. Currently the de facto successor for new Electron projects that want the nut-js API. | Windows-first; uses `SendInput` under the hood (the same WinAPI Tauri's Rust crates wrap). Supports key down/up, modifiers, typing strings, mouse if needed later. | Recommended option if Electron is chosen. Risk: it's a community fork, so its longevity isn't guaranteed. |
| **Native Node addon (custom)** | Always an option — call `SendInput` directly via N-API. | Full control. | Significant up-front work for what nut-js-fork already gives us. Only worth it if the fork dies. |

**Bottom line for Electron:** `@nut-tree-fork/nut-js` is a credible primary, with a custom N-API addon as the fallback escape hatch if the fork stagnates. The risk profile is "this fork is the lifeline; if it dies we write our own thin wrapper around `SendInput`." Manageable.

### Tauri — Rust crates

| Crate | Status | Windows support | Notes |
|---|---|---|---|
| **`enigo`** | Actively maintained. Cross-platform input simulation (keyboard + mouse) with a stable, ergonomic API. | Uses `SendInput` on Windows. Handles modifier keys, typing strings, and individual key events cleanly. | The standard pick for Tauri-based apps that need keystroke injection. |
| **`rdev`** | Maintained but slower-moving than enigo. Lower-level — exposes both event listening and synthesis. | Works on Windows, but the API is closer to "raw events" and you build typing on top. | Useful if you also need to *listen* to global events (e.g. global hotkeys without a Tauri-managed shortcut). For pure injection, enigo is simpler. |
| **`windows` crate (direct WinAPI)** | First-party Microsoft Rust bindings for the entire Windows API. | Full control. | Same situation as the Electron N-API fallback: only worth it if the higher-level crate stops working. |

**Bottom line for Tauri:** `enigo` is in better shape than any single Electron-side library. Rust ecosystem maintenance is healthier here. The catch is that the bridge code lives in Rust, which is the language the developer is not comfortable in (see §3).

### Comparison summary

Both stacks ultimately call `SendInput`. The difference is which language the call lives in:

- **Electron path:** TypeScript renderer → IPC → main process (TypeScript) → `@nut-tree-fork/nut-js` (Node native addon) → `SendInput`.
- **Tauri path:** TypeScript frontend → Tauri command → Rust backend → `enigo` → `SendInput`.

Tauri's keystroke library is in better shape on its own merits. Electron's depends on a community fork. Neither is a blocker; both work today.

---

## 2. Bundle size and distribution

Numbers are approximate and reflect "hello world" baselines for a Windows installer with a single small UI screen, no real app logic. Real apps grow on top.

| | **Electron** | **Tauri** |
|---|---|---|
| Compressed installer | ~50–80 MB | ~3–10 MB |
| Installed footprint | ~150–200 MB | ~10–20 MB |
| Why | Ships its own Chromium + Node runtime per app | Uses the system **WebView2** (Edge/Chromium) already present on Windows 10 (post 2021 update) and 11 by default |
| Cold-start | Slower (loading Chromium) | Faster (WebView2 is shared) |
| RAM at idle | ~150–250 MB | ~50–100 MB |

For Mimic specifically:

- **Distribution to colleagues** — sharing a 150 MB Electron installer over Slack or a shared drive is fine. Sharing a 5 MB Tauri installer is nicer but not transformative at this scale (handful of users, internal). The bundle-size gap matters more if Mimic ever gets distributed to dozens or hundreds of users.
- **Auto-update payloads** — Tauri's smaller delta updates compound nicely if we ship often. With Electron, full installer downloads are the norm (electron-updater can do delta updates via Squirrel but it's more setup).
- **Disk footprint on the target machine** — only relevant if a colleague is tight on disk; not a 2026-laptop concern.

**Net:** Tauri wins on size by ~15×. The win is real but only meaningful at distribution scale Mimic isn't operating at yet.

---

## 3. Language stack and learning curve

This is the most consequential comparison for a solo developer.

| | **Electron** | **Tauri** |
|---|---|---|
| Frontend | TypeScript / web | TypeScript / web |
| Backend / privileged process | TypeScript (Node) | **Rust** |
| Native bridge for keystrokes | TypeScript (calling `@nut-tree-fork/nut-js`) | **Rust** (calling `enigo`) |
| New language to learn? | No | **Yes — Rust** |
| Cross-language IPC | Standard Node IPC | Tauri's `invoke()` + Rust commands |
| Build chain | npm + electron-builder/forge (familiar JS toolchain) | npm + Cargo + tauri-build (two toolchains) |

The honest assessment for Mimic:

- **Rust is not a small detour.** "Comfortable in TS, not in Rust" means every native-bridge bug, every borrow-checker fight, every Cargo build issue costs disproportionate time on a side project where the *interesting* work is the cadence model and the Claude API style pipeline. Two new things at once (Rust + ML-ish cadence playback) is a recipe for the project stalling.
- **Learning Rust is a fine goal in isolation** but it's a learning goal, not a Mimic goal. If Mimic is the vehicle for learning Rust, accept that Mimic will ship slower. If Mimic is meant to actually ship, the Rust tax buys very little here that we can't get from Electron.
- **The "Rust everywhere" pitch (better safety, better perf)** is real but largely irrelevant for Mimic's workload. There's no hot path in Mimic that's bottlenecked on language-level performance — keystroke injection is a few `SendInput` calls per second at most, not millions.

For a solo TS-comfortable developer building a side project that has to actually ship, the language-stack delta strongly favours Electron.

---

## 4. Frontend reuse (existing HTML/CSS/JS prototype)

Both frameworks let the existing browser-based cadence-trainer prototype carry forward as-is. Confirmed.

| | **Electron** | **Tauri (Windows)** |
|---|---|---|
| Renderer engine | Chromium (bundled) | **WebView2** (Edge / Chromium) |
| Web standards parity | Identical to Chrome | Near-identical (same engine family) |
| HTML/CSS/JS prototype porting effort | Drop-in | Drop-in for Windows |

**Gotchas, both frameworks:**

- Anything the prototype does in pure browser context (DOM, events, `localStorage`, fetch to public URLs) ports unchanged.
- Anything that touches the filesystem, executes binaries, or reads OS state needs to move out of the renderer and behind an IPC boundary. In Electron that boundary is `ipcRenderer` ↔ `ipcMain`. In Tauri it's `invoke()` ↔ Rust commands. This rewrite is needed in either framework.
- The prototype's keystroke *capture* is purely DOM (`keydown`/`keyup` event timing) — no native APIs needed for capture. Works as-is in both. The native bridge is only needed for *playback* into other apps.

**Tauri-specific gotchas (Windows-only context):**

- WebView2 needs to be present on the target machine. Windows 10 (post mid-2021 evergreen rollout) and Windows 11 ship with it by default. Older Windows 10 installs without updates may need WebView2 installed separately. For a small group of colleagues this is realistically a non-issue, but it's a theoretical fragility Electron doesn't have.
- WebView2 occasionally lags Chromium on bleeding-edge web features by weeks/months. Mimic doesn't rely on bleeding-edge features.

**Tauri-specific gotchas (later cross-platform):**

- macOS uses `WKWebView`, Linux uses `webkitgtk`. These diverge from Chromium meaningfully — CSS quirks, missing APIs (e.g. some Web APIs available in Chromium aren't in WebKit). Not relevant to v1, very relevant if Mimic later ships cross-platform. Electron sidesteps this by carrying Chromium everywhere.

For v1 (Windows-only), frontend-reuse is a wash.

---

## 5. Auto-updates, code signing, and distribution

### Auto-updates

| | **Electron** | **Tauri** |
|---|---|---|
| Mechanism | `electron-updater` (Squirrel.Windows / NSIS / generic) | Built-in updater via signed manifest URL |
| Maturity | Battle-tested across thousands of shipping apps | Newer, works, less folklore |
| Delta updates | Available via Squirrel (more setup) | Tauri delta updates are a roadmap item; usually full-installer replacement today |
| Update server | GitHub Releases works as a free backend for both | Same |

For Mimic shipping to a few colleagues, either updater is sufficient. GitHub Releases is fine as the update host for both.

### Code signing on Windows — the cost gate

This applies **identically to both frameworks** and is worth flagging clearly because it's not free:

- **Without code signing**, any installer downloaded by a colleague triggers SmartScreen "unrecognized app" warnings. They can dismiss them, but it's friction every time.
- **OV (Organization Validation) cert** — typically **~$200–400/year** from Sectigo / DigiCert / SSL.com. Builds SmartScreen reputation gradually as users install signed releases.
- **EV (Extended Validation) cert** — typically **~$400–700/year**, often shipped on a hardware token. Gets immediate SmartScreen reputation (no "unrecognized app" warning from day one).
- Both certs require a verifiable organization or sole-trader registration, which adds onboarding friction beyond just paying.

**Recommendation regardless of framework:** for the first few colleague-only releases, ship unsigned and accept the SmartScreen warning. Defer the signing cost until Mimic has a stable v1 worth distributing more widely. Document the SmartScreen workaround in the install instructions.

### Tooling for signing

| | **Electron** | **Tauri** |
|---|---|---|
| Pipeline | electron-builder / electron-forge — mature, lots of examples for Windows OV/EV signing, Azure Key Vault integration, etc. | tauri-bundler — works, but less folklore. EV-on-hardware-token signing is documented but rougher. |

Edge to Electron, but not a deal-breaker for Tauri.

---

## 6. Recommendation

**Use Electron.**

Reasoning, in priority order:

1. **Language stack matches the developer.** TS-only end-to-end keeps the cognitive load on the actual interesting problems (cadence capture/playback, paired-style cartridge, Claude API rewrite) instead of on Rust ergonomics. Rust would be a worthwhile thing to learn — but not on the critical path of this project.
2. **Keystroke injection is solved enough.** `@nut-tree-fork/nut-js` is good enough for v1, with a custom `SendInput` N-API addon as a documented escape hatch if the fork stagnates. Tauri's `enigo` is genuinely better-maintained, but not better-maintained *enough* to justify learning Rust for it.
3. **Frontend reuse is a wash.** The existing HTML/CSS/JS prototype ports cleanly to either.
4. **Bundle size is real but not decisive at this scale.** ~150 MB vs ~10 MB matters when you're shipping to hundreds of users; for a handful of colleagues over the next few months, it's fine.
5. **Tooling maturity for signing/auto-updates favours Electron.** Not by a huge margin, but the marginal hours saved compound for a solo dev.
6. **The Tauri exit ramp is open.** If Mimic ever needs to ship to a much larger audience and bundle size starts mattering, the renderer (TS / HTML / CSS) ports forward; only the main-process / native-bridge layer would need rewriting in Rust. This is a real, non-trivial rewrite, but it's a future problem to solve from a position of "Mimic v1 actually exists".

**The trade we are explicitly making:** accepting a ~15× bundle-size penalty and a slightly lower keystroke-library maintenance ceiling, in exchange for staying in one language end-to-end and shipping faster.

### Concrete next steps once this is signed off

In follow-up PRs, not in this one:

1. **Stack scaffolding PR** — `electron-forge` (or `electron-builder`) with the TypeScript + Webpack/Vite template, ESLint + Prettier, basic `tsconfig`, skeleton main + renderer + preload. Pull the existing HTML/CSS/JS prototype in as the starting renderer.
2. **CI replacement PR** — replace `.github/workflows/ci.yml`'s skeleton with real lint + type-check + unit-test jobs for the chosen stack. **This will rename the `CI (skeleton)` check.** Branch protection on `main` currently requires the literal context name `CI (skeleton)` — that PR must update branch-protection contexts in the same change, otherwise every subsequent PR will be permanently blocked from merging. (Heads-up flagged here so this PR's reviewer is aware; no rename happens in this PR.)
3. **Native bridge PR** — wire `@nut-tree-fork/nut-js` into the main process, add an arm/disarm toggle so the app cannot inject keystrokes the user didn't intend, and a manual demo plan (see [`ROADMAP.md`](ROADMAP.md) Phase 3).

### Open questions deferred to later PRs (not blocking this decision)

- **Local storage format** for cadence traces and style samples — flat per-session JSON vs SQLite. Resolve in the stack-scaffolding PR.
- **Where cadence playback lives** — entirely in the main process, or behind a small local service. Default is in-process; revisit only if it gets unwieldy.
- **Whether a Python service is ever needed** — only if model work outgrows the desktop process. Punt indefinitely.

---

## Non-goals (still)

- Multi-user / cloud sync.
- Mobile.
- Real-time collaborative editing.
- Anything that ships generated text without the user explicitly triggering playback.
