/** Maps file extensions to Monaco language ids. */

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  md: 'markdown',
  txt: 'plaintext',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'cpp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  js: 'javascript',
  json: 'json',
  css: 'css',
  html: 'html'
}

/** Monaco language id for a file name or path; plaintext when unknown. */
export function languageFromName(name: string): string {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1)
  const dot = base.lastIndexOf('.')
  if (dot === -1) return 'plaintext'
  return LANGUAGE_BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? 'plaintext'
}
