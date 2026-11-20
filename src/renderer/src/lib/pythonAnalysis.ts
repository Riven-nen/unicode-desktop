import { parser } from '@lezer/python'
import type { SyntaxNode } from '@lezer/common'

export type PythonSymbolKind = 'function' | 'method' | 'class' | 'variable'

export interface PythonSymbol {
  name: string
  kind: PythonSymbolKind
  line: number
  column: number
  /** Nesting level, used to indent methods in the outline. */
  depth: number
}

export interface PythonDiagnostic {
  line: number
  column: number
  endLine: number
  endColumn: number
  message: string
}

export interface PythonAnalysis {
  symbols: PythonSymbol[]
  /** Every identifier seen in the file, for completion. */
  names: string[]
  diagnostics: PythonDiagnostic[]
}

export const PYTHON_KEYWORDS = [
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'False',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'None',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'True',
  'try',
  'while',
  'with',
  'yield'
]

export const PYTHON_BUILTINS = [
  'abs',
  'all',
  'any',
  'bool',
  'bytes',
  'callable',
  'chr',
  'classmethod',
  'dict',
  'dir',
  'enumerate',
  'filter',
  'float',
  'format',
  'frozenset',
  'getattr',
  'hasattr',
  'hash',
  'help',
  'hex',
  'id',
  'input',
  'int',
  'isinstance',
  'issubclass',
  'iter',
  'len',
  'list',
  'map',
  'max',
  'min',
  'next',
  'object',
  'oct',
  'open',
  'ord',
  'pow',
  'print',
  'property',
  'range',
  'repr',
  'reversed',
  'round',
  'set',
  'setattr',
  'sorted',
  'str',
  'sum',
  'super',
  'tuple',
  'type',
  'zip'
]

interface Position {
  line: number
  column: number
}

function lineLocator(source: string): (offset: number) => Position {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1)
  }

  return (offset: number): Position => {
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

function scopeInfo(node: SyntaxNode): { depth: number; nearest: string | null } {
  let depth = 0
  let nearest: string | null = null
  let current: SyntaxNode | null = node.parent

  while (current && current.name !== 'Script') {
    if (current.name === 'FunctionDefinition' || current.name === 'ClassDefinition') {
      if (nearest === null) nearest = current.name
      depth += 1
    }
    current = current.parent
  }
  return { depth, nearest }
}

/**
 * Parses Python with Lezer's incremental grammar. This is a syntax layer, not
 * a type checker: it catches parser errors and extracts the symbols the editor
 * uses for its outline, hover, and completion providers.
 */
export function analyzePython(source: string): PythonAnalysis {
  const tree = parser.parse(source)
  const positionAt = lineLocator(source)
  const symbols: PythonSymbol[] = []
  const names = new Set<string>()
  const diagnostics: PythonDiagnostic[] = []
  const diagnosticLines = new Set<number>()

  tree.iterate({
    enter(node) {
      if (node.name === 'VariableName') {
        const name = source.slice(node.from, node.to)
        if (name) names.add(name)
        return
      }

      if (node.name === 'FunctionDefinition' || node.name === 'ClassDefinition') {
        const nameNode = node.node.getChild('VariableName')
        if (!nameNode) return
        const position = positionAt(nameNode.from)
        const scope = scopeInfo(node.node)
        const isClass = node.name === 'ClassDefinition'
        symbols.push({
          name: source.slice(nameNode.from, nameNode.to),
          kind: isClass ? 'class' : scope.nearest === 'ClassDefinition' ? 'method' : 'function',
          line: position.line,
          column: position.column,
          depth: scope.depth
        })
        return
      }

      if (node.name === 'AssignStatement' && node.node.parent?.name === 'Script') {
        for (const nameNode of node.node.getChildren('VariableName')) {
          const name = source.slice(nameNode.from, nameNode.to)
          if (!name) continue
          const position = positionAt(nameNode.from)
          symbols.push({
            name,
            kind: 'variable',
            line: position.line,
            column: position.column,
            depth: 0
          })
        }
        return
      }

      if (node.type.isError) {
        const position = positionAt(node.from)
        if (diagnosticLines.has(position.line)) return
        diagnosticLines.add(position.line)

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
              ? 'Unexpected end of input.'
              : 'Python syntax error near this line.'
        })
      }
    }
  })

  symbols.sort((left, right) => left.line - right.line || left.column - right.column)
  diagnostics.sort((left, right) => left.line - right.line)

  return {
    symbols,
    names: Array.from(names).slice(0, 400),
    diagnostics: diagnostics.slice(0, 50)
  }
}
