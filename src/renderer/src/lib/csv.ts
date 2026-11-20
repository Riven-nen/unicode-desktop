/**
 * Small client-side CSV helper. Used for roster and submission exports in
 * the desktop app; no server round-trip is needed.
 */

export type CsvValue = string | number | boolean | null | undefined

function escapeCell(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function downloadCsv(fileName: string, rows: CsvValue[][]): void {
  const content = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Emails from a CSV/text blob, one per line or comma-separated. */
export function parseEmails(text: string): string[] {
  const candidates = text.split(/[\s,;]+/)
  const emails = new Set<string>()
  for (const candidate of candidates) {
    const email = candidate
      .trim()
      .toLowerCase()
      .replace(/^[\uFEFF<>"'\s]+|[\uFEFF<>"'\s]+$/g, '')
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) emails.add(email)
  }
  return Array.from(emails)
}
