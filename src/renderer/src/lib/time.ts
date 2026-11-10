export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false })
}
