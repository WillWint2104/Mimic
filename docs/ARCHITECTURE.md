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

| Library                           | Status                                                                                                                                                                                                                                                          | Windows support                                                                                                                                                                                                                                          | Notes                                                                                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`robotjs`**                     | **Actively maintained** (correction from earlier draft). Upstream `octalmage/robotjs` shipped v0.7.0 on 2026-03-11 with recent commits as of April 2026. Active community forks (`hurdlegroup/robotjs`, `jitsi/robotjs`) also maintained.                       | Long-standing pain points around prebuilt binaries and Node ABI compatibility on bleeding-edge Node/Electron versions; usually a rebuild + version pin away from working, but worth budgeting an afternoon for first-time setup on a new Electron major. | Viable. Lower-level/older API than nut-js (no async, less ergonomic for typing strings with modifiers), but it works. Worth a compatibility spike against the chosen Electron version before committing. |
| **`@nut-tree/nut-js`** (original) | Public npm packages were **removed** during 2024 (last GitHub release v4.2.0, 2024-04-10); upstream now requires building from source. Licensing details around commercial vs source-available are not fully verified — confirm before relying on this package. | Was the best option historically.                                                                                                                                                                                                                        | Not viable as a drop-in npm dependency for a new project.                                                                                                                                                |
| **`@nut-tree-fork/nut-js`**       | **Active community fork** (`@nut-tree-fork/nut-js` v4.2.6, 2025-03-13, ~25K weekly downloads as of April 2026). Maintained by dry Software UG.                                                                                                                  | Windows-first; uses `SendInput` under the hood (the same WinAPI Tauri's Rust crates wrap). Supports key down/up, modifiers, typing strings, mouse if needed later. Async API, ergonomic for the cadence-playback use case.                               | Recommended primary if Electron is chosen. Risk: it's a community fork, so its longevity isn't guaranteed — but the fork has been steadily releasing for over a year.                                    |
| **Native Node addon (custom)**    | Always an option — call `SendInput` directly via N-API.                                                                                                                                                                                                         | Full control.                                                                                                                                                                                                                                            | Significant up-front work for what either `nut-js-fork` or `robotjs` already gives us. Only worth it if both higher-level options stagnate.                                                              |

**Bottom line for Electron:** `@nut-tree-fork/nut-js` is a credible primary because of its async API and active release cadence; **`robotjs` is a viable secondary** rather than the dead-end the earlier draft of this document claimed (CodeRabbit caught this — the upstream is in fact actively maintained as of April 2026, the issue is API ergonomics, not abandonment). A custom `SendInput` N-API addon remains the deepest fallback. The risk profile is "two independently maintained higher-level options plus a clear escape hatch." Manageable.

### Tauri — Rust crates

| Crate                               | Status                                                                                                | Windows support                                                                                        | Notes                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`enigo`**                         | Actively maintained. Cross-platform input simulation (keyboard + mouse) with a stable, ergonomic API. | Uses `SendInput` on Windows. Handles modifier keys, typing strings, and individual key events cleanly. | The standard pick for Tauri-based apps that need keystroke injection.                                                                              |
| **`rdev`**                          | Maintained but slower-moving than enigo. Lower-level — exposes both event listening and synthesis.    | Works on Windows, but the API is closer to "raw events" and you build typing on top.                   | Useful if you also need to _listen_ to global events (e.g. global hotkeys without a Tauri-managed shortcut). For pure injection, enigo is simpler. |
| **`windows` crate (direct WinAPI)** | First-party Microsoft Rust bindings for the entire Windows API.                                       | Full control.                                                                                          | Same situation as the Electron N-API fallback: only worth it if the higher-level crate stops working.                                              |

**Bottom line for Tauri:** `enigo` is in better shape than any single Electron-side library. Rust ecosystem maintenance is healthier here. The catch is that the bridge code lives in Rust, which is the language the developer is not comfortable in (see §3).

### Comparison summary

Both stacks ultimately call `SendInput`. The difference is which language the call lives in:

- **Electron path:** TypeScript renderer → IPC → main process (TypeScript) → `@nut-tree-fork/nut-js` (Node native addon) → `SendInput`.
- **Tauri path:** TypeScript frontend → Tauri command → Rust backend → `enigo` → `SendInput`.

Tauri's keystroke library is in better shape on its own merits. Electron's depends on a community fork. Neither is a blocker; both work today.

---

## 2. Bundle size and distribution

Numbers are approximate and reflect "hello world" baselines for a Windows installer with a single small UI screen, no real app logic. Real apps grow on top.

|                      | **Electron**                                  | **Tauri**                                                                                                       |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Compressed installer | ~50–80 MB                                     | ~3–10 MB                                                                                                        |
| Installed footprint  | ~150–200 MB                                   | ~10–20 MB                                                                                                       |
| Why                  | Ships its own Chromium + Node runtime per app | Uses the system **WebView2** (Edge/Chromium) already present on Windows 10 (post 2021 update) and 11 by default |
| Cold-start           | Slower (loading Chromium)                     | Faster (WebView2 is shared)                                                                                     |
| RAM at idle          | ~150–250 MB                                   | ~50–100 MB                                                                                                      |

For Mimic specifically:

- **Distribution to colleagues** — sharing a ~50–80 MB Electron installer (≈150–200 MB installed) over Slack or a shared drive is fine. Sharing a ~3–10 MB Tauri installer is nicer but not transformative at this scale (handful of users, internal). The bundle-size gap matters more if Mimic ever gets distributed to dozens or hundreds of users.
- **Auto-update payloads** — Tauri's smaller _full-installer_ payloads compound nicely if we often ship, since both frameworks today default to full-installer replacement on Windows. (Production-ready delta/patch updates are still a roadmap item in Tauri v2.x as of April 2026; electron-updater can do delta updates via Squirrel but it's extra setup. See §5.)
- **Disk footprint on the target machine** — only relevant if a colleague is tight on disk; not a 2026-laptop concern.

**Net:** Tauri wins on size by ~15×. The win is real but only meaningful at distribution scale Mimic isn't operating at yet.

---

## 3. Language stack and learning curve

This is the most consequential comparison for a solo developer.

|                              | **Electron**                                         | **Tauri**                                  |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| Frontend                     | TypeScript / web                                     | TypeScript / web                           |
| Backend / privileged process | TypeScript (Node)                                    | **Rust**                                   |
| Native bridge for keystrokes | TypeScript (calling `@nut-tree-fork/nut-js`)         | **Rust** (calling `enigo`)                 |
| New language to learn?       | No                                                   | **Yes — Rust**                             |
| Cross-language IPC           | Standard Node IPC                                    | Tauri's `invoke()` + Rust commands         |
| Build chain                  | npm + electron-builder/forge (familiar JS toolchain) | npm + Cargo + tauri-build (two toolchains) |

The honest assessment for Mimic:

- **Rust is not a small detour.** "Comfortable in TS, not in Rust" means every native-bridge bug, every borrow-checker fight, every Cargo build issue costs disproportionate time on a side project where the _interesting_ work is the cadence model and the style-cartridge / Claude-API rewrite pipeline. Two new things at once (Rust + ML-ish cadence playback) is a recipe for the project stalling.
- **Learning Rust is a fine goal in isolation** but it's a learning goal, not a Mimic goal. If Mimic is the vehicle for learning Rust, accept that Mimic will ship slower. If Mimic is meant to actually ship, the Rust tax buys very little here that we can't get from Electron.
- **The "Rust everywhere" pitch (better safety, better perf)** is real but largely irrelevant for Mimic's workload. There's no hot path in Mimic that's bottlenecked on language-level performance — keystroke injection is a few `SendInput` calls per second at most, not millions.

For a solo TS-comfortable developer building a side project that has to actually ship, the language-stack delta strongly favours Electron.

---

## 4. Frontend reuse (existing HTML/CSS/JS prototype)

Both frameworks let the existing browser-based cadence-trainer prototype carry forward as-is. Confirmed.

|                                      | **Electron**        | **Tauri (Windows)**                 |
| ------------------------------------ | ------------------- | ----------------------------------- |
| Renderer engine                      | Chromium (bundled)  | **WebView2** (Edge / Chromium)      |
| Web standards parity                 | Identical to Chrome | Near-identical (same engine family) |
| HTML/CSS/JS prototype porting effort | Drop-in             | Drop-in for Windows                 |

**Gotchas, both frameworks:**

- Anything the prototype does in pure browser context (DOM, events, `localStorage`, fetch to public URLs) ports unchanged.
- Anything that touches the filesystem, executes binaries, or reads OS state needs to move out of the renderer and behind an IPC boundary. In Electron that boundary is `ipcRenderer` ↔ `ipcMain`. In Tauri it's `invoke()` ↔ Rust commands. This rewrite is needed in either framework.
- The prototype's keystroke _capture_ is purely DOM (`keydown`/`keyup` event timing) — no native APIs needed for capture. Works as-is in both. The native bridge is only needed for _playback_ into other apps.

**Tauri-specific gotchas (Windows-only context):**

- WebView2 needs to be present on the target machine. Windows 10 (post mid-2021 evergreen rollout) and Windows 11 ship with it by default. Older Windows 10 installs without updates may need WebView2 installed separately. For a small group of colleagues this is realistically a non-issue, but it's a theoretical fragility Electron doesn't have.
- WebView2 occasionally lags Chromium on bleeding-edge web features by weeks/months. Mimic doesn't rely on bleeding-edge features.

**Tauri-specific gotchas (later cross-platform):**

- macOS uses `WKWebView`, Linux uses `webkitgtk`. These diverge from Chromium meaningfully — CSS quirks, missing APIs (e.g. some Web APIs available in Chromium aren't in WebKit). Not relevant to v1, very relevant if Mimic later ships cross-platform. Electron sidesteps this by carrying Chromium everywhere.

For v1 (Windows-only), frontend-reuse is a wash.

---

## 5. Auto-updates, code signing, and distribution

### Auto-updates

|               | **Electron**                                           | **Tauri**                                                                                                                     |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Mechanism     | `electron-updater` (Squirrel.Windows / NSIS / generic) | Built-in updater via signed manifest URL                                                                                      |
| Maturity      | Battle-tested across thousands of shipping apps        | Newer, works, less folklore                                                                                                   |
| Delta updates | Available via Squirrel (more setup)                    | Full-installer replacement is the norm; production-ready delta updates are still a roadmap item as of Tauri v2.x (April 2026) |
| Update server | GitHub Releases works as a free backend for both       | Same                                                                                                                          |

For Mimic shipping to a few colleagues, either updater is sufficient. GitHub Releases is fine as the update host for both.

### Code signing on Windows — the cost gate

This applies **identically to both frameworks** and is worth flagging clearly because it's not free:

- **Without code signing**, any installer downloaded by a colleague triggers SmartScreen "unrecognized app" warnings. They can dismiss them, but it's friction every time.
- **OV (Organization Validation) cert** — typically **~$200–400/year** from Sectigo / DigiCert / SSL.com. SmartScreen reputation builds gradually with usage/downloads.
- **EV (Extended Validation) cert** — typically **~$400–700/year**, often shipped on a hardware token. Historically granted _instant_ SmartScreen reputation; **as of March 2024 Microsoft removed that benefit** — EV reputation now also builds via usage/downloads, same as OV. EV is still worth it if a hardware-token-backed key is required by other policies, but the SmartScreen-specific argument for paying the EV premium is much weaker than older write-ups suggest.
- **Term and key-storage rules** — post-2026 CA/B Forum rules cap signing-cert terms at ~1 year and require keys on FIPS-compliant hardware (HSM or token), so add ~$50–150 for the token plus any cloud-HSM fees.
- **Cloud signing alternative** — Microsoft Azure Trusted Signing (~$10/month basic, ~$100/month premium) avoids the cert + token logistics and is worth a look once we cross into "actually paying for signing".
- Both OV and EV require a verifiable organization or sole-trader registration, which adds onboarding friction beyond just paying.

**Recommendation regardless of framework:** for the first few colleague-only releases, ship unsigned and accept the SmartScreen warning. Defer the signing cost until Mimic has a stable v1 worth distributing more widely. Document the SmartScreen workaround in the install instructions.

> **Caveat for managed/enterprise machines.** SmartScreen "warn but allow" behaviour assumes the colleague's Windows is in its default state. Managed machines (Pro/Enterprise SKUs running AppLocker or Windows Defender Application Control / WDAC, common in corporate IT) may _block_ unsigned executables outright, independent of SmartScreen — there's no "click through" path. If any of the early colleague testers run their laptops under corporate-managed images, signing may move from "nice eventually" to "required before they can run Mimic at all". Worth a quick "is your laptop managed by IT?" check before assuming the unsigned path will work for them.

### Tooling for signing

|          | **Electron**                                                                                                           | **Tauri**                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pipeline | electron-builder / electron-forge — mature, many examples for Windows OV/EV signing, Azure Key Vault integration, etc. | tauri-bundler — works, but less folklore. EV-on-hardware-token signing is documented but rougher. |

Edge to Electron, but not a deal-breaker for Tauri.

---

## 6. Recommendation

**Use Electron.**

Reasoning, in priority order:

1. **Language stack matches the developer.** TS-only end-to-end keeps the cognitive load on the actual interesting problems (cadence capture/playback, paired-style cartridge, Claude API rewrite) instead of on Rust ergonomics. Rust would be a worthwhile thing to learn — but not on the critical path of this project.
2. **Keystroke injection is solved enough.** `@nut-tree-fork/nut-js` is good enough for v1, with `robotjs` as an independently maintained second option and a custom `SendInput` N-API addon as the deepest fallback. Tauri's `enigo` is in good shape too, but not better-maintained _enough_ — given Electron now has two viable JS-side libraries, not one — to justify learning Rust for it.
3. **Frontend reuse is a wash.** The existing HTML/CSS/JS prototype ports cleanly to either.
4. **Bundle size is real but not decisive at this scale.** ~150 MB vs ~10 MB matters when you're shipping to hundreds of users; for a handful of colleagues over the next few months, it's fine.
5. **Tooling maturity for signing/auto-updates favours Electron.** Not by a huge margin, but the marginal hours saved compound for a solo dev.
6. **The Tauri exit ramp is open.** If Mimic ever needs to ship to a much larger audience and bundle size starts mattering, the renderer (TS / HTML / CSS) ports forward; only the main-process / native-bridge layer would need rewriting in Rust. This is a real, non-trivial rewrite, but it's a future problem to solve from a position of "Mimic v1 actually exists".

**The trade we are explicitly making:** accepting a ~15× bundle-size penalty and a slightly lower keystroke-library maintenance ceiling, in exchange for staying in one language end-to-end and shipping faster.

### Verify before committing actual money

Before paying for anything based on this doc:

- **Code-signing certificate prices** (§5) are rough industry-typical ranges, not direct quotes from DigiCert / Sectigo / SSL.com as of April 2026. Get a current quote before committing.
- **Original `@nut-tree/nut-js` licensing** (§1) — the public npm package was removed during 2024 but the precise commercial terms vs source-available status weren't fully verified for this doc. If we ever consider going back to the upstream, confirm the licence first.

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
