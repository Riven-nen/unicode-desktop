import type { SyntaxNode, Tree } from '@lezer/common'

/**
 * Shared analysis shapes for the editor's local language checks. These power
 * the outline, completion names, and Monaco markers. They describe syntax and
 * simple name resolution only - not types or program semantics.
 */

export type CodeSymbolKind = 'function' | 'method' | 'class' | 'variable'

export interface CodeSymbol {
  name: string
  kind: CodeSymbolKind
  line: number
  column: number
  /** Nesting level, used to indent members in the outline. */
  depth: number
}

export interface CodeDiagnostic {
  line: number
  column: number
  endLine: number
  endColumn: number
  message: string
}

export interface CodeAnalysis {
  symbols: CodeSymbol[]
  /** Every identifier seen in the file, for completion. */
  names: string[]
  diagnostics: CodeDiagnostic[]
}

interface SourcePosition {
  line: number
  column: number
}

/** Maps a character offset to a 1-based line and column. */
export function lineLocator(source: string): (offset: number) => SourcePosition {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1)
  }

  return (offset: number): SourcePosition => {
    let low = 0
    let high = starts.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (starts[mid] <= offset) low = mid
      else high = mid - 1
    }
    return { line: low + 1, column: offset - starts[low] + 1 }
  }
}

export function childrenOf(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) {
    children.push(child)
  }
  return children
}

/** Lezer creates fresh node wrappers, so match nodes by position and type. */
export function sameNode(left: SyntaxNode | null, right: SyntaxNode | null): boolean {
  if (!left || !right) return false
  return left.from === right.from && left.to === right.to && left.name === right.name
}

/** Collects parser error nodes into one diagnostic per line. */
export function syntaxDiagnostics(
  source: string,
  tree: Tree,
  languageLabel: string
): CodeDiagnostic[] {
  const positionAt = lineLocator(source)
  const diagnostics: CodeDiagnostic[] = []
  const seenLines = new Set<number>()

  tree.iterate({
    enter(node) {
      if (!node.type.isError) return
      const position = positionAt(node.from)
      if (seenLines.has(position.line)) return
      seenLines.add(position.line)

      const lineEnd = source.indexOf('\n', node.from)
      const endOffset = lineEnd === -1 ? source.length : lineEnd
      const end = positionAt(Math.max(node.from, endOffset))
      diagnostics.push({
        line: position.line,
        column: position.column,
        endLine: end.line,
        endColumn: Math.max(position.column + 1, end.column),
        message:
          node.from >= source.length
            ? `Unexpected end of input in ${languageLabel}.`
            : `${languageLabel} syntax error near this line.`
      })
    }
  })

  return diagnostics
}

/**
 * Depth of a declaration inside the given container node types. A top-level
 * declaration is 0, a member of a top-level class/namespace is 1, and so on.
 */
export function containerDepth(node: SyntaxNode, containers: Set<string>): number {
  let depth = 0
  let current = node.parent
  while (current) {
    if (containers.has(current.name)) depth += 1
    current = current.parent
  }
  return depth
}

/** First descendant (including the node itself) with one of the given names. */
export function firstDescendant(node: SyntaxNode, names: Set<string>): SyntaxNode | null {
  if (names.has(node.name)) return node
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const found = firstDescendant(child, names)
    if (found) return found
  }
  return null
}

/** Reads a node's source text. */
export function nodeText(source: string, node: SyntaxNode): string {
  return source.slice(node.from, node.to)
}

export function sortAnalysis(symbols: CodeSymbol[], diagnostics: CodeDiagnostic[]): void {
  symbols.sort((left, right) => left.line - right.line || left.column - right.column)
  diagnostics.sort((left, right) => left.line - right.line || left.column - right.column)
}
