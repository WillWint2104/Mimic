// Shared between main and renderer processes. Keep in sync with package.json's
// "version" field — updating this in two places is a known small wart that
// goes away when we wire the renderer to read package.json via Vite's
// build-time injection in a later PR.
export const APP_VERSION = '0.0.0' as const;
