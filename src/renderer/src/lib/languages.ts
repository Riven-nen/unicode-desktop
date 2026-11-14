/** Maps file extensions to Monaco language ids. */

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  md: 'markdown',
  txt: 'plaintext',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  css: 'css',
  html: 'html',
  xml: 'xml',
  sql: 'sql',
  sh: 'shell',
  rb: 'ruby',
  php: 'php',
  go: 'go',
  rs: 'rust',
  kt: 'kotlin',
  swift: 'swift',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini'
}

/** Monaco language id for a file name or path; plaintext when unknown. */
export function languageFromName(name: string): string {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1)
  const dot = base.lastIndexOf('.')
  if (dot === -1) return 'plaintext'
  return LANGUAGE_BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? 'plaintext'
}
