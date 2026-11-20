const HOUR_MS = 3_600_000;

/** A check is due once a full interval has passed since the last one (or there never was one). */
export function isCheckDue(lastCheckAt: number | null, intervalHours: number, now: number) {
  return lastCheckAt === null || now - lastCheckAt >= intervalHours * HOUR_MS;
}

/** More than twice the interval since the last check: Android is holding checks back. */
export function isCheckLate(lastCheckAt: number | null, intervalHours: number, now: number) {
  return lastCheckAt !== null && now - lastCheckAt > intervalHours * HOUR_MS * 2;
}

/**
 * Re-registering the background task restarts WorkManager's countdown, so only do it when the
 * task is missing or was registered with a different interval.
 */
export function needsReschedule(registeredMinutes: number | null, wantedMinutes: number) {
  return registeredMinutes !== wantedMinutes;
}
