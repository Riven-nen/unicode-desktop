import type * as monaco from 'monaco-editor'
import type { LspMessage } from '../../../shared/lsp'

type Monaco = typeof monaco
type Model = monaco.editor.ITextModel
type Position = monaco.Position

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface LspRange {
  start: { line: number; character: number }
  end: { line: number; character: number }
}

interface LspLocation {
  uri: string
  range: LspRange
}

interface LspLocationLink {
  targetUri: string
  targetRange: LspRange
  targetSelectionRange?: LspRange
}

interface LspCompletionItem {
  label: string | { label: string; detail?: string; description?: string }
  kind?: number
  detail?: string
  documentation?: string | { kind?: string; value: string }
  sortText?: string
  filterText?: string
  insertText?: string
  insertTextFormat?: number
  preselect?: boolean
  textEdit?: {
    range?: LspRange
    insert?: LspRange
    replace?: LspRange
    newText: string
  }
  commitCharacters?: string[]
}

interface LspHover {
  contents:
    string | { kind?: string; value: string } | Array<string | { kind?: string; value: string }>
  range?: LspRange
}

interface PythonLspState {
  active: boolean
  startPromise: Promise<PythonLspClient | null> | null
  client: PythonLspClient | null
  monaco: Monaco | null
  exitListeners: Set<() => void>
  error: string | null
}

const GLOBAL_KEY = '__unicodeLabPythonLsp'
const globalStore = globalThis as unknown as Record<string, PythonLspState | undefined>
const state: PythonLspState =
  globalStore[GLOBAL_KEY] ??
  (globalStore[GLOBAL_KEY] = {
    active: false,
    startPromise: null,
    client: null,
    monaco: null,
    exitListeners: new Set(),
    error: null
  })

/** Maps a filesystem path to the file URI Pyright expects. */
function fileUri(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return encodeURI(`file:///${normalized}`)
}

/** Pyright may re-encode `:` or change path case; compare decoded lowercase. */
function normalizeUri(uri: string): string {
  let decoded = uri
  try {
    decoded = decodeURIComponent(uri)
  } catch {
    // Keep the raw URI when it contains a malformed escape.
  }
  const normalized = decoded.replace(/\\/g, '/')
  return window.api.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function lspPosition(position: Position): { line: number; character: number } {
  return { line: position.lineNumber - 1, character: position.column - 1 }
}

function monacoRange(monacoInstance: Monaco, range: LspRange): monaco.Range {
  return new monacoInstance.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1
  )
}

function completionKind(
  monacoInstance: Monaco,
  kind: number | undefined
): monaco.languages.CompletionItemKind {
  const kinds = monacoInstance.languages.CompletionItemKind
  switch (kind) {
    case 2:
      return kinds.Method
    case 3:
      return kinds.Function
    case 4:
      return kinds.Constructor
    case 5:
      return kinds.Field
    case 6:
      return kinds.Variable
    case 7:
      return kinds.Class
    case 8:
      return kinds.Interface
    case 9:
      return kinds.Module
    case 10:
      return kinds.Property
    case 11:
      return kinds.Unit
    case 12:
      return kinds.Value
    case 13:
      return kinds.Enum
    case 14:
      return kinds.Keyword
    case 15:
      return kinds.Snippet
    case 16:
      return kinds.Color
    case 17:
      return kinds.File
    case 18:
      return kinds.Reference
    case 19:
      return kinds.Folder
    case 20:
      return kinds.EnumMember
    case 21:
      return kinds.Constant
    case 22:
      return kinds.Struct
    case 23:
      return kinds.Event
    case 24:
      return kinds.Operator
    case 25:
      return kinds.TypeParameter
    default:
      return kinds.Text
  }
}

function documentationText(
  value: string | { kind?: string; value: string } | undefined
): string | undefined {
  if (!value) return undefined
  return typeof value === 'string' ? value : value.value
}

/**
 * Minimal Pyright LSP client. It intentionally handles only document sync plus
 * completion, hover, and definitions; diagnostics stay on the existing Pyright
 * CLI pipeline and the Lezer parser.
 */
export class PythonLspClient {
  private readonly monacoInstance: Monaco
  private nextId = 1
  private readonly pending = new Map<number, PendingRequest>()
  private readonly documents = new Map<string, string>()
  private readonly modelsByLspUri = new Map<string, string>()

  constructor(monacoInstance: Monaco) {
    this.monacoInstance = monacoInstance
    window.api.lsp.onMessage((message) => this.receive(message))
  }

  private send(message: LspMessage): void {
    window.api.lsp.send(message)
  }

  private request(method: string, params: unknown, timeout = 8000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} timed out`))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.send({ jsonrpc: '2.0', id, method, params })
    })
  }

  private notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params })
  }

  private receive(message: LspMessage): void {
    const id = message.id
    if (typeof id === 'number') {
      const pending = this.pending.get(id)
      if (pending) {
        this.pending.delete(id)
        clearTimeout(pending.timer)
        if (message.error) {
          pending.reject(new Error(`LSP request failed: ${JSON.stringify(message.error)}`))
        } else {
          pending.resolve(message.result)
        }
        return
      }
      // Server-initiated request: answer with a neutral result so Pyright can
      // continue initializing.
      if (typeof message.method === 'string') this.respondToServerRequest(id, message.method)
      return
    }
    if (typeof message.method === 'string') {
      // Diagnostics remain handled by the CLI/parser pipeline.
      if (message.method === 'textDocument/publishDiagnostics') return
    }
  }

  private respondToServerRequest(id: number, method: string): void {
    let result: unknown = null
    if (method === 'workspace/configuration') result = []
    else if (method === 'workspace/applyEdit') result = { applied: false }
    else if (method === 'workspace/workspaceFolders') result = null
    this.send({ jsonrpc: '2.0', id, result })
  }

  async initialize(): Promise<void> {
    const response = (await this.request(
      'initialize',
      {
        processId: null,
        rootUri: null,
        capabilities: {
          textDocument: {
            synchronization: { dynamicRegistration: false },
            completion: {
              contextSupport: true,
              completionItem: {
                snippetSupport: true,
                documentationFormat: ['markdown', 'plaintext']
              }
            },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            definition: {}
          }
        }
      },
      12000
    )) as { capabilities?: unknown } | undefined
    if (!response) throw new Error('Pyright did not return initialization capabilities')
    this.notify('initialized', {})
  }

  /** Opens a model and maps its Monaco URI to a URI Pyright can analyze. */
  openDocument(model: Model, path?: string): void {
    const modelUri = model.uri.toString()
    if (this.documents.has(modelUri)) return
    const lspUri = path ? fileUri(path) : modelUri
    this.documents.set(modelUri, lspUri)
    this.modelsByLspUri.set(normalizeUri(lspUri), modelUri)
    this.notify('textDocument/didOpen', {
      textDocument: {
        uri: lspUri,
        languageId: 'python',
        version: model.getVersionId(),
        text: model.getValue()
      }
    })
  }

  changeDocument(model: Model): void {
    const lspUri = this.documents.get(model.uri.toString())
    if (!lspUri) return
    this.notify('textDocument/didChange', {
      textDocument: { uri: lspUri, version: model.getVersionId() },
      contentChanges: [{ text: model.getValue() }]
    })
  }

  closeDocument(model: Model): void {
    const modelUri = model.uri.toString()
    const lspUri = this.documents.get(modelUri)
    if (!lspUri) return
    this.documents.delete(modelUri)
    this.modelsByLspUri.delete(normalizeUri(lspUri))
    this.notify('textDocument/didClose', { textDocument: { uri: lspUri } })
  }

  uriFor(model: Model): string | undefined {
    return this.documents.get(model.uri.toString())
  }

  async completion(
    model: Model,
    position: Position
  ): Promise<monaco.languages.CompletionItem[] | null> {
    const uri = this.uriFor(model)
    if (!uri) return null
    let response: unknown
    try {
      response = await this.request('textDocument/completion', {
        textDocument: { uri },
        position: lspPosition(position),
        context: { triggerKind: 1 }
      })
    } catch {
      return null
    }
    const list = Array.isArray(response)
      ? response
      : response &&
          typeof response === 'object' &&
          Array.isArray((response as { items?: unknown }).items)
        ? (response as { items: LspCompletionItem[] }).items
        : null
    if (!list) return null

    const { InsertAsSnippet } = this.monacoInstance.languages.CompletionItemInsertTextRule
    const word = model.getWordUntilPosition(position)
    const fallbackRange = new this.monacoInstance.Range(
      position.lineNumber,
      word.startColumn,
      position.lineNumber,
      word.endColumn
    )

    return (list as LspCompletionItem[]).map((item) => {
      const label = typeof item.label === 'string' ? item.label : item.label.label
      const documentation = documentationText(item.documentation)
      const editRange = item.textEdit
        ? (item.textEdit.range ?? item.textEdit.insert ?? item.textEdit.replace)
        : undefined
      return {
        label,
        kind: completionKind(this.monacoInstance, item.kind),
        detail: item.detail,
        documentation,
        sortText: item.sortText,
        filterText: item.filterText,
        preselect: item.preselect,
        insertText: item.textEdit?.newText ?? item.insertText ?? label,
        insertTextRules: item.insertTextFormat === 2 ? InsertAsSnippet : undefined,
        range: editRange ? monacoRange(this.monacoInstance, editRange) : fallbackRange,
        commitCharacters: item.commitCharacters
      }
    })
  }

  async hover(model: Model, position: Position): Promise<monaco.languages.Hover | null> {
    const uri = this.uriFor(model)
    if (!uri) return null
    let response: LspHover | null
    try {
      response = (await this.request('textDocument/hover', {
        textDocument: { uri },
        position: lspPosition(position)
      })) as LspHover | null
    } catch {
      return null
    }
    if (!response?.contents) return null
    const contents = (Array.isArray(response.contents) ? response.contents : [response.contents])
      .map((entry) => documentationText(entry))
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ value }))
    if (contents.length === 0) return null
    return {
      contents,
      range: response.range ? monacoRange(this.monacoInstance, response.range) : undefined
    }
  }

  async definition(model: Model, position: Position): Promise<monaco.languages.Definition | null> {
    const uri = this.uriFor(model)
    if (!uri) return null
    let response: unknown
    try {
      response = await this.request('textDocument/definition', {
        textDocument: { uri },
        position: lspPosition(position)
      })
    } catch {
      return null
    }
    const entries = (Array.isArray(response) ? response : response ? [response] : []) as Array<
      LspLocation | LspLocationLink
    >
    const locations = entries.flatMap((entry) => {
      const targetUri = 'uri' in entry ? entry.uri : entry.targetUri
      const range =
        'range' in entry ? entry.range : (entry.targetSelectionRange ?? entry.targetRange)
      const modelUri = this.modelsByLspUri.get(normalizeUri(targetUri))
      if (!modelUri) return []
      return [
        {
          uri: this.monacoInstance.Uri.parse(modelUri),
          range: monacoRange(this.monacoInstance, range)
        }
      ]
    })
    if (locations.length === 0) return null
    return locations
  }
}

export function isPythonLspActive(): boolean {
  return state.active
}

export function onPythonLspExit(callback: () => void): () => void {
  state.exitListeners.add(callback)
  return () => {
    state.exitListeners.delete(callback)
  }
}

export function startPythonLanguageServer(instance: Monaco): Promise<PythonLspClient | null> {
  state.monaco = instance
  if (state.startPromise) return state.startPromise

  state.startPromise = (async (): Promise<PythonLspClient | null> => {
    try {
      const result = await window.api.lsp.start()
      if (!result.available) {
        state.error = result.message ?? 'Pyright language server is unavailable.'
        state.startPromise = null
        return null
      }

      const client = new PythonLspClient(instance)
      await client.initialize()
      state.client = client
      state.active = true
      state.error = null
      window.api.lsp.onExit(() => {
        state.active = false
        state.client = null
        state.startPromise = null
        for (const listener of state.exitListeners) listener()
      })
      return client
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error)
      state.active = false
      state.client = null
      state.startPromise = null
      return null
    }
  })()

  return state.startPromise
}
