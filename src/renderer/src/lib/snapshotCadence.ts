// Idle window after the last keystroke before an auto snapshot is captured.
export const AUTO_SNAPSHOT_DEBOUNCE_MS = 1500

// Minimum spacing between consecutive auto snapshots. Raising this from the
// original 10s to 30s keeps a useful timeline while cutting the dominant
// snapshot-storage cost by roughly 3x.
export const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 30_000

/**
 * Extra delay required before the next auto snapshot, or null once the
 * cooldown has elapsed. The debounce is added so a change made exactly at the
 * boundary is still captured after the editor goes idle.
 */
export function autoSnapshotCooldownMs(
  lastCreatedAt: string | null | undefined,
  now: number = Date.now()
): number | null {
  if (!lastCreatedAt) return null
  const last = Date.parse(lastCreatedAt)
  if (!Number.isFinite(last)) return null
  const elapsed = now - last
  if (elapsed >= AUTO_SNAPSHOT_MIN_INTERVAL_MS) return null
  return AUTO_SNAPSHOT_MIN_INTERVAL_MS - elapsed + AUTO_SNAPSHOT_DEBOUNCE_MS
}
