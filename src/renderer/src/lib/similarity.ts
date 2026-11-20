/**
 * Cross-student similarity for the professor review surface.
 *
 * This is a readable heuristic, not a plagiarism verdict: it compares the
 * final snapshot of each student's latest submission using shared token
 * sequences (6-grams) and reports Jaccard overlap. Renamed variables and
 * reformatting reduce the score, while structural copies stay high.
 */

const MIN_TOKENS = 15
const SHINGLE_SIZE = 6

export interface SimilarityEntry {
  submissionId: string
  studentId: string
  studentName: string
  submittedAt: string
  content: string
}

export interface SimilarityPair {
  a: SimilarityEntry
  b: SimilarityEntry
  score: number
}

const TOKEN_RE =
  /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|==|!=|<=|>=|&&|\|\||[^\s]/g

// Keywords stay visible in the shingle stream; every other identifier becomes
// <id>, so renaming variables does not hide a structural copy.
const KEYWORDS = new Set([
  'def',
  'return',
  'if',
  'else',
  'elif',
  'for',
  'while',
  'in',
  'not',
  'and',
  'or',
  'class',
  'import',
  'from',
  'as',
  'with',
  'try',
  'except',
  'finally',
  'raise',
  'pass',
  'break',
  'continue',
  'lambda',
  'yield',
  'global',
  'nonlocal',
  'assert',
  'del',
  'is',
  'none',
  'true',
  'false',
  'print',
  'input',
  'range',
  'len',
  'function',
  'const',
  'let',
  'var',
  'new',
  'this',
  'typeof',
  'instanceof',
  'void',
  'public',
  'private',
  'protected',
  'static',
  'int',
  'float',
  'double',
  'char',
  'boolean',
  'string',
  'bool',
  'null',
  'undefined',
  'switch',
  'case',
  'default',
  'do',
  'throw',
  'catch',
  'extends',
  'implements',
  'interface',
  'package',
  'include',
  'using',
  'namespace',
  'struct',
  'enum',
  'async',
  'await',
  'of',
  'echo',
  'console',
  'log'
])

/** Strips comments so boilerplate headers don't inflate the score. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/(^|\s)#[^\n]*/g, '$1 ')
}

export function tokenize(source: string): string[] {
  const tokens = stripComments(source).match(TOKEN_RE) ?? []
  return tokens.map((token) => {
    if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) return '<str>'
    if (/^\d/.test(token)) return '<num>'
    if (/^[A-Za-z_$]/.test(token)) {
      const lower = token.toLowerCase()
      return KEYWORDS.has(lower) ? lower : '<id>'
    }
    return token
  })
}

export function shingles(tokens: string[], size = SHINGLE_SIZE): Set<string> {
  const result = new Set<string>()
  if (tokens.length < size) return result
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join('\u0001'))
  }
  return result
}

/** Jaccard overlap of token shingles, 0..1. Short files score 0. */
export function similarityScore(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.length < MIN_TOKENS || tokensB.length < MIN_TOKENS) return 0

  const setA = shingles(tokensA)
  const setB = shingles(tokensB)
  if (setA.size === 0 || setB.size === 0) return 0

  let shared = 0
  for (const shingle of setA) {
    if (setB.has(shingle)) shared += 1
  }
  return shared / (setA.size + setB.size - shared)
}

/** Latest submission per student, so resubmissions don't multiply pairs. */
export function latestPerStudent(entries: SimilarityEntry[]): SimilarityEntry[] {
  const latest = new Map<string, SimilarityEntry>()
  for (const entry of entries) {
    const current = latest.get(entry.studentId)
    if (!current || entry.submittedAt > current.submittedAt) latest.set(entry.studentId, entry)
  }
  return [...latest.values()]
}

export function findSimilarPairs(entries: SimilarityEntry[], threshold = 0.65): SimilarityPair[] {
  const latest = latestPerStudent(entries)
  const pairs: SimilarityPair[] = []
  for (let left = 0; left < latest.length; left += 1) {
    for (let right = left + 1; right < latest.length; right += 1) {
      const score = similarityScore(latest[left].content, latest[right].content)
      if (score >= threshold) {
        pairs.push({ a: latest[left], b: latest[right], score })
      }
    }
  }
  return pairs.sort((one, two) => two.score - one.score)
}
