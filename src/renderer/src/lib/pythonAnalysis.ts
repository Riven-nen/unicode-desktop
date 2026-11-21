import { parser } from '@lezer/python'
import type { SyntaxNode, Tree } from '@lezer/common'
import { childrenOf, lineLocator, sameNode } from './codeAnalysis'
import type { CodeAnalysis, CodeDiagnostic, CodeSymbol, CodeSymbolKind } from './codeAnalysis'

// Python keeps its own aliases so existing imports stay valid while sharing
// the generic analysis shapes and helpers with the other languages.
export type PythonSymbolKind = CodeSymbolKind
export type PythonSymbol = CodeSymbol
export type PythonDiagnostic = CodeDiagnostic
export type PythonAnalysis = CodeAnalysis

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
  'zip',
  'aiter',
  'anext',
  'ascii',
  'bin',
  'breakpoint',
  'bytearray',
  'compile',
  'complex',
  'delattr',
  'divmod',
  'eval',
  'exec',
  'globals',
  'locals',
  'memoryview',
  'vars',
  // Common built-in exceptions are names too; without them a perfectly valid
  // `except ValueError` would look undefined.
  'ArithmeticError',
  'AssertionError',
  'AttributeError',
  'BaseException',
  'BaseExceptionGroup',
  'BlockingIOError',
  'BrokenPipeError',
  'BufferError',
  'BytesWarning',
  'ChildProcessError',
  'ConnectionAbortedError',
  'ConnectionError',
  'ConnectionRefusedError',
  'ConnectionResetError',
  'DeprecationWarning',
  'EOFError',
  'EncodingWarning',
  'EnvironmentError',
  'Exception',
  'ExceptionGroup',
  'FileExistsError',
  'FileNotFoundError',
  'FloatingPointError',
  'FutureWarning',
  'GeneratorExit',
  'IOError',
  'ImportError',
  'ImportWarning',
  'IndentationError',
  'IndexError',
  'InterruptedError',
  'IsADirectoryError',
  'KeyError',
  'KeyboardInterrupt',
  'LookupError',
  'MemoryError',
  'ModuleNotFoundError',
  'NameError',
  'NotADirectoryError',
  'NotImplementedError',
  'OSError',
  'OverflowError',
  'PendingDeprecationWarning',
  'PermissionError',
  'ProcessLookupError',
  'RecursionError',
  'ReferenceError',
  'ResourceWarning',
  'RuntimeError',
  'RuntimeWarning',
  'StopAsyncIteration',
  'StopIteration',
  'SyntaxError',
  'SyntaxWarning',
  'SystemError',
  'SystemExit',
  'TabError',
  'TimeoutError',
  'TypeError',
  'UnboundLocalError',
  'UnicodeDecodeError',
  'UnicodeEncodeError',
  'UnicodeError',
  'UnicodeTranslateError',
  'UnicodeWarning',
  'UserWarning',
  'ValueError',
  'Warning',
  'ZeroDivisionError'
]

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

const PYTHON_SPECIAL_NAMES = [
  '__name__',
  '__file__',
  '__doc__',
  '__package__',
  '__builtins__',
  '__spec__',
  '__loader__',
  '__cached__',
  '__annotations__',
  '__debug__',
  '__class__',
  'True',
  'False',
  'None',
  'NotImplemented',
  'Ellipsis'
]

type AnalysisScopeKind = 'module' | 'function' | 'class' | 'lambda' | 'comprehension'

interface AnalysisScope {
  kind: AnalysisScopeKind
  parent: AnalysisScope | null
  defined: Set<string>
}

interface NameUsage {
  name: string
  from: number
  to: number
  scope: AnalysisScope
}

/**
 * Conservative local-name analysis. This is intentionally not a full Python
 * type checker: it resolves simple names, parameters, imports, assignments,
 * loop/with/except targets, comprehension targets, lambdas, and class/function
 * scopes. If a file uses `from module import *`, undefined-name warnings are
 * suppressed for the whole file because the imported names are unknowable here.
 */
function collectUndefinedNameDiagnostics(source: string, tree: Tree): PythonDiagnostic[] {
  const positionAt = lineLocator(source)
  const available = new Set([...PYTHON_BUILTINS, ...PYTHON_SPECIAL_NAMES])
  const usages: NameUsage[] = []
  const moduleScope: AnalysisScope = {
    kind: 'module',
    parent: null,
    defined: new Set()
  }
  let hasStarImport = false

  const nameOf = (node: SyntaxNode): string => source.slice(node.from, node.to)

  const defineName = (scope: AnalysisScope, node: SyntaxNode): void => {
    const name = nameOf(node)
    if (name) scope.defined.add(name)
  }

  const recordUsage = (scope: AnalysisScope, node: SyntaxNode): void => {
    const name = nameOf(node)
    if (name) {
      usages.push({ name, from: node.from, to: node.to, scope })
    }
  }

  const parentForFunction = (scope: AnalysisScope): AnalysisScope => {
    let parent: AnalysisScope | null = scope
    // Methods do not close over class-body names; skip class scopes entirely.
    while (parent && parent.kind === 'class') parent = parent.parent
    return parent ?? moduleScope
  }

  const defineTarget = (node: SyntaxNode, scope: AnalysisScope): void => {
    switch (node.name) {
      case 'VariableName':
        defineName(scope, node)
        return
      case 'ArrayExpression':
      case 'TupleExpression':
      case 'PatternList':
      case 'ListPattern':
      case 'TuplePattern':
        for (const child of childrenOf(node)) defineTarget(child, scope)
        return
      case 'MemberExpression':
      case 'SubscriptExpression':
      case 'CallExpression':
        walk(node, scope)
        return
      default:
        // Punctuation, stars, and rare pattern wrappers: recurse so direct
        // variable targets are still collected.
        for (const child of childrenOf(node)) defineTarget(child, scope)
    }
  }

  const handleAssignment = (node: SyntaxNode, scope: AnalysisScope): void => {
    const items = childrenOf(node)
    const operatorIndexes = items
      .map((child, index) => (child.name === 'AssignOp' ? index : -1))
      .filter((index) => index >= 0)

    if (operatorIndexes.length === 0) {
      // Annotated assignment without a value: `value: int`.
      for (const child of items) {
        if (child.name === 'TypeDef') walk(child, scope)
        else if (child.name !== ',') defineTarget(child, scope)
      }
      return
    }

    let start = 0
    for (const operatorIndex of operatorIndexes) {
      for (let index = start; index < operatorIndex; index += 1) {
        const child = items[index]
        if (child.name === 'TypeDef') walk(child, scope)
        else if (child.name !== ',') defineTarget(child, scope)
      }
      start = operatorIndex + 1
    }

    for (let index = start; index < items.length; index += 1) {
      if (items[index].name !== ',') walk(items[index], scope)
    }
  }

  const handleParams = (paramList: SyntaxNode, outer: AnalysisScope): Set<string> => {
    const params = new Set<string>()
    const items = childrenOf(paramList)
    let inDefault = false

    for (const child of items) {
      if (child.name === ',') {
        inDefault = false
        continue
      }
      if (child.name === 'AssignOp') {
        inDefault = true
        continue
      }
      if (child.name === 'TypeDef') {
        walk(child, outer)
        continue
      }
      if (child.name === 'VariableName') {
        if (inDefault) walk(child, outer)
        else params.add(nameOf(child))
        continue
      }
      if (inDefault) walk(child, outer)
    }

    return params
  }

  const handleFunction = (node: SyntaxNode, scope: AnalysisScope): void => {
    const nameNode = node.getChild('VariableName')
    if (nameNode) defineName(scope, nameNode)
    const paramList = node.getChild('ParamList')
    const params = paramList ? handleParams(paramList, scope) : new Set<string>()
    const body = node.getChild('Body')

    for (const child of childrenOf(node)) {
      if (sameNode(child, nameNode) || sameNode(child, paramList) || sameNode(child, body)) continue
      walk(child, scope)
    }

    if (body) {
      const functionScope: AnalysisScope = {
        kind: 'function',
        parent: parentForFunction(scope),
        defined: params
      }
      walk(body, functionScope)
    }
  }

  const handleClass = (node: SyntaxNode, scope: AnalysisScope): void => {
    const nameNode = node.getChild('VariableName')
    if (nameNode) defineName(scope, nameNode)
    const body = node.getChild('Body')
    for (const child of childrenOf(node)) {
      if (sameNode(child, nameNode) || sameNode(child, body)) continue
      walk(child, scope)
    }
    if (body) {
      const classScope: AnalysisScope = {
        kind: 'class',
        parent: scope,
        defined: new Set()
      }
      walk(body, classScope)
    }
  }

  const handleLambda = (node: SyntaxNode, scope: AnalysisScope): void => {
    const paramList = node.getChild('ParamList')
    const params = paramList ? handleParams(paramList, scope) : new Set<string>()
    const lambdaScope: AnalysisScope = {
      kind: 'lambda',
      parent: parentForFunction(scope),
      defined: params
    }
    for (const child of childrenOf(node)) {
      if (sameNode(child, paramList)) continue
      walk(child, lambdaScope)
    }
  }

  const handleImport = (node: SyntaxNode, scope: AnalysisScope): void => {
    const items = childrenOf(node)
    const importIndex = items.findIndex((child) => child.name === 'import')
    if (importIndex < 0) return

    for (let index = importIndex + 1; index < items.length; index += 1) {
      const child = items[index]
      if (child.name === '*') {
        hasStarImport = true
        continue
      }
      if (child.name !== 'VariableName') continue

      const previous = items[index - 1]
      const next = items[index + 1]
      if (previous?.name === '.') continue

      if (next?.name === 'as') {
        const alias = items[index + 2]
        if (alias?.name === 'VariableName') {
          defineName(scope, alias)
          index += 2
        }
        continue
      }

      // `import a.b as c` binds c, not a. If this dotted entry has an alias,
      // let the alias branch handle it.
      if (next?.name === '.') {
        let cursor = index + 1
        let hasAlias = false
        while (cursor < items.length && items[cursor].name !== ',') {
          if (items[cursor].name === 'as') {
            hasAlias = true
            break
          }
          cursor += 1
        }
        if (!hasAlias) defineName(scope, child)
        continue
      }

      defineName(scope, child)
    }
  }

  const handleFor = (node: SyntaxNode, scope: AnalysisScope): void => {
    const items = childrenOf(node)
    const inIndex = items.findIndex((child) => child.name === 'in')
    if (inIndex < 0) {
      for (const child of items) walk(child, scope)
      return
    }
    for (let index = 0; index < inIndex; index += 1) {
      if (items[index].name !== 'for') defineTarget(items[index], scope)
    }
    for (let index = inIndex + 1; index < items.length; index += 1) {
      walk(items[index], scope)
    }
  }

  const handleWith = (node: SyntaxNode, scope: AnalysisScope): void => {
    const items = childrenOf(node)
    for (let index = 0; index < items.length; index += 1) {
      if (items[index].name === 'as' && items[index + 1]) {
        defineTarget(items[index + 1], scope)
        index += 1
        continue
      }
      walk(items[index], scope)
    }
  }

  const handleTry = (node: SyntaxNode, scope: AnalysisScope): void => {
    const items = childrenOf(node)
    for (let index = 0; index < items.length; index += 1) {
      if (items[index].name === 'as' && items[index + 1]) {
        defineTarget(items[index + 1], scope)
        index += 1
        continue
      }
      walk(items[index], scope)
    }
  }

  const handleArgList = (node: SyntaxNode, scope: AnalysisScope): void => {
    const items = childrenOf(node)
    for (let index = 0; index < items.length; index += 1) {
      const child = items[index]
      // `f(name=value)`: the keyword itself is not a variable reference.
      if (child.name === 'VariableName' && items[index + 1]?.name === 'AssignOp') {
        continue
      }
      walk(child, scope)
    }
  }

  const handleComprehension = (node: SyntaxNode, scope: AnalysisScope): void => {
    const items = childrenOf(node)
    const comprehensionScope: AnalysisScope = {
      kind: 'comprehension',
      parent: scope,
      defined: new Set()
    }
    const targets: SyntaxNode[] = []

    for (let index = 0; index < items.length; index += 1) {
      if (items[index].name !== 'for') continue
      let cursor = index + 1
      while (cursor < items.length && items[cursor].name !== 'in') {
        defineTarget(items[cursor], comprehensionScope)
        targets.push(items[cursor])
        cursor += 1
      }
    }

    for (const child of items) {
      if (targets.some((target) => sameNode(target, child))) continue
      walk(child, comprehensionScope)
    }
  }

  const handleScopeStatement = (node: SyntaxNode, scope: AnalysisScope): void => {
    for (const child of childrenOf(node)) {
      if (child.name === 'VariableName') scope.defined.add(nameOf(child))
    }
  }

  /** Defines the names a `match` pattern captures and walks its value patterns. */
  const handlePattern = (node: SyntaxNode, scope: AnalysisScope): void => {
    switch (node.name) {
      case 'CapturePattern': {
        const name = node.getChild('VariableName')
        // `case _:` is a wildcard, not a binding.
        if (name && nameOf(name) !== '_') defineName(scope, name)
        return
      }
      case 'AsPattern': {
        const items = childrenOf(node)
        for (let index = 0; index < items.length; index += 1) {
          if (items[index].name === 'as' && items[index + 1]) {
            if (items[index + 1].name === 'VariableName') defineName(scope, items[index + 1])
            index += 1
            continue
          }
          handlePattern(items[index], scope)
        }
        return
      }
      case 'ClassPattern':
      case 'KeywordPattern': {
        const items = childrenOf(node)
        // The class name in a class pattern is a real reference; keyword names
        // in `Point(x=...)` are attribute names, not variables.
        if (node.name === 'ClassPattern' && items[0]?.name === 'VariableName') {
          recordUsage(scope, items[0])
        }
        for (let index = 1; index < items.length; index += 1) {
          const child = items[index]
          if (child.name === 'PatternArgList') {
            for (const argument of childrenOf(child)) {
              if (argument.name === 'KeywordPattern') handlePattern(argument, scope)
            }
            continue
          }
          if (child.name === 'VariableName' && node.name === 'KeywordPattern') continue
          handlePattern(child, scope)
        }
        return
      }
      case 'OrPattern':
      case 'SequencePattern':
      case 'StarPattern':
      case 'MappingPattern':
      case 'GroupPattern':
        for (const child of childrenOf(node)) handlePattern(child, scope)
        return
      case 'LiteralPattern':
      case 'ValuePattern':
        walk(node, scope)
        return
      case 'PatternArgList':
        for (const child of childrenOf(node)) handlePattern(child, scope)
        return
      default:
        // Unknown wrapper: names here are more likely captures than uses, so
        // defining them is the conservative choice.
        for (const child of childrenOf(node)) {
          if (child.name === 'VariableName') defineName(scope, child)
          else handlePattern(child, scope)
        }
    }
  }

  const handleMatch = (node: SyntaxNode, scope: AnalysisScope): void => {
    for (const child of childrenOf(node)) {
      if (child.name === 'MatchBody') {
        for (const clause of childrenOf(child)) {
          if (clause.name !== 'MatchClause') continue
          const items = childrenOf(clause)
          for (const item of items) {
            if (item.name === 'Body' || item.name === 'Guard') {
              walk(item, scope)
            } else if (item.name !== 'case') {
              handlePattern(item, scope)
            }
          }
        }
        continue
      }
      walk(child, scope)
    }
  }

  const walk = (node: SyntaxNode, scope: AnalysisScope): void => {
    switch (node.name) {
      case 'VariableName':
        recordUsage(scope, node)
        return
      case 'ImportStatement':
        handleImport(node, scope)
        return
      case 'AssignStatement':
      case 'NamedExpression':
        handleAssignment(node, scope)
        return
      case 'FunctionDefinition':
        handleFunction(node, scope)
        return
      case 'ClassDefinition':
        handleClass(node, scope)
        return
      case 'LambdaExpression':
        handleLambda(node, scope)
        return
      case 'ForStatement':
        handleFor(node, scope)
        return
      case 'WithStatement':
        handleWith(node, scope)
        return
      case 'TryStatement':
        handleTry(node, scope)
        return
      case 'ArgList':
        handleArgList(node, scope)
        return
      case 'ArrayComprehensionExpression':
      case 'DictionaryComprehensionExpression':
      case 'SetComprehensionExpression':
      case 'GeneratorExpression':
      case 'ComprehensionExpression':
        handleComprehension(node, scope)
        return
      case 'ScopeStatement':
        handleScopeStatement(node, scope)
        return
      case 'MatchStatement':
        handleMatch(node, scope)
        return
      default:
        for (const child of childrenOf(node)) walk(child, scope)
    }
  }

  walk(tree.topNode, moduleScope)

  if (hasStarImport) return []

  // After a parse error the tree is a recovery guess, so names following the
  // first error are unreliable (e.g. stray tokens become bare expressions).
  // Names before it are still worth reporting in a file being edited.
  let firstParseError = Number.POSITIVE_INFINITY
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) firstParseError = Math.min(firstParseError, node.from)
    }
  })

  const diagnostics: PythonDiagnostic[] = []
  const seen = new Set<string>()

  for (const usage of usages) {
    if (usage.from >= firstParseError) continue
    if (available.has(usage.name)) continue
    let scope: AnalysisScope | null = usage.scope
    let found = false
    while (scope) {
      if (scope.defined.has(usage.name)) {
        found = true
        break
      }
      scope = scope.parent
    }
    if (found) continue

    const key = `${usage.from}:${usage.name}`
    if (seen.has(key)) continue
    seen.add(key)

    const start = positionAt(usage.from)
    const end = positionAt(usage.to)
    diagnostics.push({
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: Math.max(start.column + 1, end.column),
      message: `Name '${usage.name}' is not defined.`
    })
  }

  diagnostics.sort((left, right) => left.line - right.line || left.column - right.column)
  return diagnostics.slice(0, 100)
}

/**
 * Parses Python with Lezer's incremental grammar. This is a syntax layer, not
 * a type checker: it catches parser errors and extracts the symbols the editor
 * uses for its outline, hover, and completion providers. A conservative local
 * name pass adds undefined-name diagnostics without attempting type inference.
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

  diagnostics.push(...collectUndefinedNameDiagnostics(source, tree))

  symbols.sort((left, right) => left.line - right.line || left.column - right.column)
  diagnostics.sort((left, right) => left.line - right.line || left.column - right.column)

  return {
    symbols,
    names: Array.from(names).slice(0, 400),
    diagnostics: diagnostics.slice(0, 50)
  }
}
