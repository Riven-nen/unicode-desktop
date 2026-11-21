import { parser } from '@lezer/java'
import type { SyntaxNode } from '@lezer/common'
import {
  containerDepth,
  lineLocator,
  nodeText,
  sortAnalysis,
  syntaxDiagnostics
} from './codeAnalysis'
import type { CodeAnalysis, CodeDiagnostic, CodeSymbol } from './codeAnalysis'

const CLASS_NODES = new Set([
  'ClassDeclaration',
  'InterfaceDeclaration',
  'EnumDeclaration',
  'RecordDeclaration',
  'AnnotationTypeDeclaration'
])

const MEMBER_NODES = new Set(['MethodDeclaration', 'ConstructorDeclaration'])

function definitionName(node: SyntaxNode): SyntaxNode | null {
  // The Java grammar stores declared names directly in a Definition node.
  return node.getChild('Definition')
}

/**
 * Java analysis backed by the Lezer grammar: syntax errors plus an outline of
 * classes, methods, constructors, and fields. Statement-level name resolution
 * is intentionally out of scope; compiler diagnostics add it when a JDK is
 * available.
 */
export function analyzeJava(source: string): CodeAnalysis {
  const tree = parser.parse(source)
  const positionAt = lineLocator(source)
  const symbols: CodeSymbol[] = []
  const names = new Set<string>()
  const diagnostics: CodeDiagnostic[] = syntaxDiagnostics(source, tree, 'Java')

  tree.iterate({
    enter(node) {
      if (node.name === 'Identifier') {
        const name = source.slice(node.from, node.to)
        if (name) names.add(name)
        return
      }

      if (CLASS_NODES.has(node.name)) {
        const nameNode = definitionName(node.node)
        if (!nameNode) return
        const position = positionAt(nameNode.from)
        symbols.push({
          name: nodeText(source, nameNode),
          kind: 'class',
          line: position.line,
          column: position.column,
          depth: containerDepth(node.node, CLASS_NODES)
        })
        return
      }

      if (MEMBER_NODES.has(node.name)) {
        const nameNode = definitionName(node.node)
        if (!nameNode) return
        const position = positionAt(nameNode.from)
        symbols.push({
          name: nodeText(source, nameNode),
          kind: 'method',
          line: position.line,
          column: position.column,
          depth: containerDepth(node.node, CLASS_NODES) + 1
        })
        return
      }

      if (node.name === 'VariableDeclarator' && node.node.parent?.name === 'FieldDeclaration') {
        const nameNode = definitionName(node.node)
        if (!nameNode) return
        const position = positionAt(nameNode.from)
        symbols.push({
          name: nodeText(source, nameNode),
          kind: 'variable',
          line: position.line,
          column: position.column,
          depth: containerDepth(node.node, CLASS_NODES) + 1
        })
        return
      }

      if (node.name === 'EnumConstant') {
        const nameNode = definitionName(node.node)
        if (!nameNode) return
        const position = positionAt(nameNode.from)
        symbols.push({
          name: nodeText(source, nameNode),
          kind: 'variable',
          line: position.line,
          column: position.column,
          depth: containerDepth(node.node, CLASS_NODES) + 1
        })
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
