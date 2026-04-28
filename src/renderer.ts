import { APP_VERSION } from './shared/version';

const versionEl = document.getElementById('app-version');
if (versionEl) {
  versionEl.textContent = `Mimic v${APP_VERSION}`;
}
