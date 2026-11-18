import { isNewer } from './version';

export interface UpdateCandidate {
  latestVersion: string | null;
  installedVersion: string | null;
  ignoredVersion: string | null;
  latestIsBeta: boolean;
  notifyBetas: boolean | null;
}

/**
 * Whether Grabby should offer this app's latest build. A tracked app that isn't installed
 * counts: getting it onto the phone is the same action. Ignored versions and betas (unless
 * betas are on for this app, or globally) don't.
 */
export function hasUpdate(app: UpdateCandidate, betasGlobally: boolean): boolean {
  if (!app.latestVersion) return false;
  if (app.ignoredVersion && app.latestVersion === app.ignoredVersion) return false;
  if (app.latestIsBeta && !(app.notifyBetas ?? betasGlobally)) return false;
  if (!app.installedVersion) return true;
  return isNewer(app.latestVersion, app.installedVersion);
}
