import { parser } from '@lezer/cpp'
import type { SyntaxNode } from '@lezer/common'
import {
  containerDepth,
  firstDescendant,
  lineLocator,
  nodeText,
  sortAnalysis,
  syntaxDiagnostics
} from './codeAnalysis'
import type { CodeAnalysis, CodeDiagnostic, CodeSymbol } from './codeAnalysis'

const CLASS_NODES = new Set(['ClassSpecifier', 'StructSpecifier', 'UnionSpecifier'])
const CONTAINER_NODES = new Set(['NamespaceDefinition', ...CLASS_NODES])
const CALLABLE_NAME_NODES = new Set([
  'FieldIdentifier',
  'DestructorName',
  'OperatorName',
  'Identifier'
])

function hasAncestor(node: SyntaxNode, names: Set<string>): boolean {
  let current = node.parent
  while (current) {
    if (names.has(current.name)) return true
    current = current.parent
  }
  return false
}

function functionDeclaratorName(node: SyntaxNode): SyntaxNode | null {
  const declarator = firstDescendant(node, new Set(['FunctionDeclarator']))
  if (!declarator) return null
  return firstDescendant(declarator, CALLABLE_NAME_NODES)
}

/** Names declared by a field/variable declaration, skipping callable declarators. */
function declaredNames(node: SyntaxNode): SyntaxNode[] {
  const names: SyntaxNode[] = []
  const visit = (current: SyntaxNode): void => {
    if (
      current.name === 'FunctionDeclarator' ||
      current.name === 'ParameterList' ||
      current.name === 'CompoundStatement'
    ) {
      return
    }
    if (current.name === 'Identifier' || current.name === 'FieldIdentifier') {
      names.push(current)
      return
    }
    for (let child = current.firstChild; child; child = child.nextSibling) visit(child)
  }
  for (let child = node.firstChild; child; child = child.nextSibling) visit(child)
  return names
}

/**
 * C/C++ analysis backed by the Lezer grammar: syntax errors plus an outline
 * of namespaces, types, functions, methods, fields, and globals. Compiler
 * diagnostics add type and name checking when a local toolchain is available.
 */
export function analyzeCpp(source: string, languageLabel = 'C++'): CodeAnalysis {
  const tree = parser.parse(source)
  const positionAt = lineLocator(source)
  const symbols: CodeSymbol[] = []
  const names = new Set<string>()
  const diagnostics: CodeDiagnostic[] = syntaxDiagnostics(source, tree, languageLabel)

  const addSymbol = (nameNode: SyntaxNode, kind: CodeSymbol['kind'], depth: number): void => {
    const name = nodeText(source, nameNode)
    if (!name) return
    const position = positionAt(nameNode.from)
    symbols.push({ name, kind, line: position.line, column: position.column, depth })
  }

  const addCallable = (node: SyntaxNode, forceMethod = false): void => {
    const nameNode = functionDeclaratorName(node)
    if (!nameNode) return
    const inClass = forceMethod || hasAncestor(node, CLASS_NODES)
    addSymbol(nameNode, inClass ? 'method' : 'function', containerDepth(node, CONTAINER_NODES))
  }

  tree.iterate({
    enter(node) {
      if (node.name === 'Identifier' || node.name === 'TypeIdentifier') {
        const name = source.slice(node.from, node.to)
        if (name) names.add(name)
        return
      }
      if (node.name === 'FieldIdentifier' || node.name === 'NamespaceIdentifier') {
        const name = source.slice(node.from, node.to)
        if (name) names.add(name)
        return
      }

      if (node.name === 'NamespaceDefinition') {
        const nameNode = node.node.getChild('Identifier')
        if (nameNode) addSymbol(nameNode, 'class', containerDepth(node.node, CONTAINER_NODES))
        return
      }

      if (
        node.name === 'ClassSpecifier' ||
        node.name === 'StructSpecifier' ||
        node.name === 'UnionSpecifier'
      ) {
        const nameNode = node.node.getChild('TypeIdentifier')
        if (nameNode) addSymbol(nameNode, 'class', containerDepth(node.node, CONTAINER_NODES))
        return
      }

      if (node.name === 'EnumSpecifier') {
        const nameNode = node.node.getChild('TypeIdentifier') ?? node.node.getChild('Identifier')
        if (nameNode) addSymbol(nameNode, 'class', containerDepth(node.node, CONTAINER_NODES))
        return
      }

      if (node.name === 'Enumerator') {
        const nameNode = node.node.getChild('Identifier')
        if (nameNode) {
          addSymbol(nameNode, 'variable', containerDepth(node.node, CONTAINER_NODES) + 1)
        }
        return
      }

      if (node.name === 'FunctionDefinition') {
        addCallable(node.node)
        return
      }

      if (node.name === 'FieldDeclaration') {
        if (firstDescendant(node.node, new Set(['FunctionDeclarator']))) {
          addCallable(node.node, true)
          return
        }
        for (const nameNode of declaredNames(node.node)) {
          addSymbol(nameNode, 'variable', containerDepth(node.node, CONTAINER_NODES))
        }
        return
      }

      if (node.name === 'Declaration') {
        if (firstDescendant(node.node, new Set(['FunctionDeclarator']))) {
          addCallable(node.node)
          return
        }
        // Only module/namespace-level variables belong in the outline.
        if (hasAncestor(node.node, new Set(['FunctionDefinition', 'LambdaExpression']))) return
        for (const nameNode of declaredNames(node.node)) {
          addSymbol(nameNode, 'variable', containerDepth(node.node, CONTAINER_NODES))
        }
      }
    }
  })

  sortAnalysis(symbols, diagnostics)
  return {
    symbols,
    names: [...names].sort(),
    diagnostics: diagnostics.slice(0, 100)
  }
}

export function analyzeC(source: string): CodeAnalysis {
  return analyzeCpp(source, 'C')
}
