/**
 * Helpers for assignment files. An assignment points at a file inside the
 * student's workspace; the class code supplies the folder, so the database
 * only stores the bare file name (e.g. "fibonacci.py").
 */

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  python: '.py',
  java: '.java',
  c: '.c',
  cpp: '.cpp',
  javascript: '.js',
  html: '.html',
  css: '.css'
}

export function extensionForLanguage(language: string | null | undefined): string {
  if (!language) return '.txt'
  return LANGUAGE_EXTENSIONS[language.trim().toLowerCase()] ?? '.txt'
}

/** A safe default file name derived from the assignment title. */
export function defaultAssignmentFileName(
  title: string,
  language: string | null | undefined
): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'assignment'}${extensionForLanguage(language)}`
}

interface AssignmentFileLike {
  title: string
  language: string | null
  fileName: string | null
}

/** The stored file name, or a sensible default for older assignments. */
export function fileNameForAssignment(assignment: AssignmentFileLike): string {
  const stored = assignment.fileName?.trim()
  return stored || defaultAssignmentFileName(assignment.title, assignment.language)
}
