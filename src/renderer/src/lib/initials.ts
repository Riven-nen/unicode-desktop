/** Two-letter monogram for avatars (class codes, student names). */
export function initialsOf(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/i.test(word))

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }

  const compact = value.replace(/[^a-z0-9]/gi, '')
  return (compact.slice(0, 2) || '?').toUpperCase()
}
