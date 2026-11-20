import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { BeforeMount, OnMount } from '@monaco-editor/react'
import { X } from 'lucide-react'
import type * as monacoTypes from 'monaco-editor'
import { useTheme } from '../themes/useTheme'
import { defineMonacoThemes } from '../themes/themes'
import { useFont } from '../fonts/useFont'
import { ensureFontLoaded } from '../fonts/fontLoading'
import { readClipboardText, writeClipboardText } from '../lib/clipboard'
import { analyzePython, PYTHON_BUILTINS, PYTHON_KEYWORDS } from '../lib/pythonAnalysis'
import type { PythonAnalysis, PythonSymbolKind } from '../lib/pythonAnalysis'
import { fileDisplayName } from '../lib/workspace'
import type { CodeTrackerApi } from '../hooks/useCodeTracker'
import type { LabFile } from '../types/tracker'

/**
 * Editor command surface exposed to the menu bar. Actions are implemented
 * against the live monaco instance, so menu clicks behave exactly like
 * their keyboard equivalents: undo/redo stay on the model's stack, find /
 * replace / comment open monaco's built-in widgets, and clipboard actions
 * go through the system clipboard.
 */
export interface EditorCommands {
  focus(): void
  reveal(line: number, column: number): void
  undo(): void
  redo(): void
  cut(): void
  copy(): void
  paste(): void
  find(): void
  replace(): void
  toggleComment(): void
  selectAll(): void
  commandPalette(): void
}

/** View-menu toggles owned by App so the menu checkmarks stay truthful. */
export interface EditorViewOptions {
  minimap: boolean
  wordWrap: boolean
  lineNumbers: boolean
}

// Module-local default (exporting constants from component files breaks
// React fast refresh).
const DEFAULT_VIEW_OPTIONS: EditorViewOptions = {
  minimap: false,
  wordWrap: false,
  lineNumbers: true
}

interface EditorPaneProps {
  files: LabFile[]
  activeFile: string
  onSelectFile: (name: string) => void
  onCursorChange?: (position: { lineNumber: number; column: number }) => void
  tracker: CodeTrackerApi
  /** Receives the command surface once the editor has mounted. */
  commandsRef?: React.RefObject<EditorCommands | null>
  viewOptions?: EditorViewOptions
  /**
   * Pressed when the user hits monaco's Alt+Z binding; routed through the
   * app toggle so the View-menu checkmark can never disagree with the
   * editor.
   */
  onToggleWordWrap?: () => void
  /** Receives the active Python file's live symbols and diagnostics. */
  onAnalysisChange?: (analysis: PythonAnalysis | null) => void
  /**
   * Closes a workspace tab. The last remaining file can't be closed —
   * App guards it, so the close button is hidden on single-file workspaces.
   */
  onCloseFile?: (name: string) => void
}

export default function EditorPane({
  files,
  activeFile,
  onSelectFile,
  onCursorChange,
  tracker,
  commandsRef,
  viewOptions = DEFAULT_VIEW_OPTIONS,
  onToggleWordWrap,
  onAnalysisChange,
  onCloseFile
}: EditorPaneProps): React.ReactElement {
  const { monacoTheme } = useTheme()
  const { font, fontSize, ligatures } = useFont()
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monacoTypes | null>(null)
  const modelsRef = useRef(new Map<string, monacoTypes.editor.ITextModel>())
  // Detachers returned by tracker.attachModel, kept per file so closing a
  // tab can release its listener.
  const disposersRef = useRef(new Map<string, () => void>())
  const activeFileRef = useRef(activeFile)
  const onCursorChangeRef = useRef(onCursorChange)
  const onToggleWordWrapRef = useRef(onToggleWordWrap)
  const onAnalysisChangeRef = useRef(onAnalysisChange)
  const analysisCacheRef = useRef(new Map<string, { version: number; analysis: PythonAnalysis }>())
  const analysisTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const analysisDisposersRef = useRef(new Map<string, monacoTypes.IDisposable>())
  const providerDisposablesRef = useRef<monacoTypes.IDisposable[]>([])
  const publishAnalysisRef = useRef<
    (fileName: string, model: monacoTypes.editor.ITextModel) => void
  >(() => undefined)

  // Keep the cursor callback fresh without re-attaching editor listeners.
  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  })

  // Same for the Alt+Z word-wrap binding, which routes into app state.
  useEffect(() => {
    onToggleWordWrapRef.current = onToggleWordWrap
  })

  // Keep the latest analysis callback available to model listeners.
  useEffect(() => {
    onAnalysisChangeRef.current = onAnalysisChange
  })

  // Apply view toggles (minimap / word wrap / line numbers) live.
  useEffect(() => {
    editorRef.current?.updateOptions({
      minimap: { enabled: viewOptions.minimap },
      wordWrap: viewOptions.wordWrap ? 'on' : 'off',
      lineNumbers: viewOptions.lineNumbers ? 'on' : 'off'
    })
  }, [viewOptions])

  // Apply appearance changes (font, size, ligatures) to the live editor.
  // The font's file must be resident before Monaco measures it — measuring
  // an unloaded family caches the fallback's metrics, so the editor ends up
  // laid out (and kept) with the wrong widths. After the files arrive we
  // apply the option and force Monaco to re-measure and repaint.
  useEffect(() => {
    let cancelled = false
    void ensureFontLoaded(font.family).then(() => {
      if (cancelled) return
      editorRef.current?.updateOptions({
        fontFamily: font.family,
        fontSize,
        fontLigatures: ligatures
      })
      monacoRef.current?.editor.remeasureFonts()
    })
    return () => {
      cancelled = true
    }
  }, [font, fontSize, ligatures])

  // Swap models on tab switch; each file keeps its own versionId, undo
  // stack, and therefore its own time-travel history.
  useEffect(() => {
    activeFileRef.current = activeFile
    const editor = editorRef.current
    const model = modelsRef.current.get(activeFile)
    if (editor && model && editor.getModel() !== model) editor.setModel(model)
  }, [activeFile])

  // Files added after the editor mounted (File > New File…) still need a
  // model; create them lazily so late additions behave like the starters.
  useEffect(() => {
    const monacoInstance = monacoRef.current
    if (!monacoInstance) return
    let added = false
    for (const file of files) {
      if (modelsRef.current.has(file.name)) continue
      const uri = monacoInstance.Uri.parse(`inmemory://lab/${encodeURIComponent(file.name)}`)
      const model =
        monacoInstance.editor.getModel(uri) ??
        monacoInstance.editor.createModel(file.initialContent, file.language, uri)
      modelsRef.current.set(file.name, model)
      if (!disposersRef.current.has(file.name)) {
        disposersRef.current.set(file.name, tracker.attachModel(file.name, model))
      }
      added = true
    }
    if (!added) return
    // The active file may have just gained its model — swap it in.
    const editor = editorRef.current
    const model = modelsRef.current.get(activeFile)
    if (editor && model && editor.getModel() !== model) editor.setModel(model)
  }, [files, activeFile, tracker])

  // Files removed from the workspace (tab close) get their tracker
  // listener and model released. Declared after the model-swap effects
  // above so the editor has already moved off the closed tab's model
  // before it is disposed.
  useEffect(() => {
    for (const [name, model] of modelsRef.current) {
      if (files.some((file) => file.name === name)) continue
      disposersRef.current.get(name)?.()
      disposersRef.current.delete(name)
      analysisDisposersRef.current.get(name)?.dispose()
      analysisDisposersRef.current.delete(name)
      const timer = analysisTimersRef.current.get(name)
      if (timer) clearTimeout(timer)
      analysisTimersRef.current.delete(name)
      analysisCacheRef.current.delete(model.uri.toString())
      modelsRef.current.delete(name)
      model.dispose()
    }
  }, [files])

  const analysisFor = (model: monacoTypes.editor.ITextModel): PythonAnalysis | null => {
    if (model.getLanguageId() !== 'python') return null
    const key = model.uri.toString()
    const cached = analysisCacheRef.current.get(key)
    if (cached && cached.version === model.getVersionId()) return cached.analysis
    const analysis = analyzePython(model.getValue())
    analysisCacheRef.current.set(key, { version: model.getVersionId(), analysis })
    return analysis
  }

  const publishAnalysis = (fileName: string, model: monacoTypes.editor.ITextModel): void => {
    const monacoInstance = monacoRef.current
    const analysis = analysisFor(model)

    if (monacoInstance) {
      if (!analysis) {
        monacoInstance.editor.setModelMarkers(model, 'python', [])
      } else {
        const markers: monacoTypes.editor.IMarkerData[] = analysis.diagnostics.map((diagnostic) => {
          const maxColumn = model.getLineMaxColumn(diagnostic.line)
          const startColumn = Math.min(Math.max(1, diagnostic.column), maxColumn)
          const endColumn = Math.min(
            Math.max(diagnostic.endColumn, startColumn + 1),
            Math.max(maxColumn, startColumn + 1)
          )
          return {
            severity: monacoInstance.MarkerSeverity.Error,
            message: diagnostic.message,
            source: 'python',
            startLineNumber: diagnostic.line,
            startColumn,
            endLineNumber: diagnostic.endLine,
            endColumn
          }
        })
        monacoInstance.editor.setModelMarkers(model, 'python', markers)
      }
    }

    if (activeFileRef.current === fileName) {
      onAnalysisChangeRef.current?.(analysis)
    }
  }

  const scheduleAnalysis = (fileName: string, model: monacoTypes.editor.ITextModel): void => {
    const existing = analysisTimersRef.current.get(fileName)
    if (existing) clearTimeout(existing)
    analysisTimersRef.current.set(
      fileName,
      setTimeout(() => {
        analysisTimersRef.current.delete(fileName)
        publishAnalysis(fileName, model)
      }, 350)
    )
  }

  const registerPythonProviders = (monacoInstance: typeof monacoTypes): void => {
    if (providerDisposablesRef.current.length > 0) return

    const completion = monacoInstance.languages.registerCompletionItemProvider('python', {
      provideCompletionItems(model, position) {
        const analysis = analyzePython(model.getValue())
        const word = model.getWordUntilPosition(position)
        const range = new monacoInstance.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        )
        const { CompletionItemKind } = monacoInstance.languages
        const suggestions: monacoTypes.languages.CompletionItem[] = []
        const seen = new Set<string>()

        const add = (
          label: string,
          kind: monacoTypes.languages.CompletionItemKind,
          detail: string,
          sortText: string
        ): void => {
          if (seen.has(label)) return
          seen.add(label)
          suggestions.push({
            label,
            kind,
            detail,
            insertText: label,
            range,
            sortText
          })
        }

        const kindFor = (kind: PythonSymbolKind): monacoTypes.languages.CompletionItemKind => {
          if (kind === 'class') return CompletionItemKind.Class
          if (kind === 'variable') return CompletionItemKind.Variable
          return CompletionItemKind.Function
        }

        analysis.symbols.forEach((symbol, index) => {
          add(
            symbol.name,
            kindFor(symbol.kind),
            `${symbol.kind} · line ${symbol.line}`,
            `0_${String(index).padStart(4, '0')}`
          )
        })
        analysis.names.forEach((name, index) => {
          add(
            name,
            CompletionItemKind.Variable,
            'name in this file',
            `1_${String(index).padStart(4, '0')}`
          )
        })
        PYTHON_KEYWORDS.forEach((keyword) => {
          add(keyword, CompletionItemKind.Keyword, 'keyword', '2')
        })
        PYTHON_BUILTINS.forEach((builtin) => {
          add(builtin, CompletionItemKind.Function, 'builtin', '3')
        })

        return { suggestions }
      }
    })

    const hover = monacoInstance.languages.registerHoverProvider('python', {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position)
        if (!word) return null
        const analysis = analyzePython(model.getValue())
        const symbol = analysis.symbols.find((item) => item.name === word.word)
        if (!symbol) return null
        return {
          range: new monacoInstance.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: [
            { value: `**${symbol.kind}** \`${symbol.name}\`` },
            { value: `Defined on line ${symbol.line}` }
          ]
        }
      }
    })

    providerDisposablesRef.current = [completion, hover]
  }

  const handleBeforeMount: BeforeMount = (monacoInstance) => {
    defineMonacoThemes(monacoInstance)
    registerPythonProviders(monacoInstance)
  }

  // Keep the latest analysis function available to the tab-switch effect.
  useEffect(() => {
    publishAnalysisRef.current = publishAnalysis
  })

  useEffect(() => {
    const model = modelsRef.current.get(activeFile)
    if (model) publishAnalysisRef.current(activeFile, model)
  }, [activeFile])

  const handleMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance

    for (const file of files) {
      // One model per file, addressed by a stable URI (encoded so names
      // with spaces or non-ASCII characters stay valid). The getModel
      // guard makes this safe under React StrictMode's double mount.
      const uri = monacoInstance.Uri.parse(`inmemory://lab/${encodeURIComponent(file.name)}`)
      const model =
        monacoInstance.editor.getModel(uri) ??
        monacoInstance.editor.createModel(file.initialContent, file.language, uri)
      modelsRef.current.set(file.name, model)
      if (!disposersRef.current.has(file.name)) {
        disposersRef.current.set(file.name, tracker.attachModel(file.name, model))
      }
      if (!analysisDisposersRef.current.has(file.name)) {
        analysisDisposersRef.current.set(
          file.name,
          model.onDidChangeContent(() => scheduleAnalysis(file.name, model))
        )
      }
    }

    const current = modelsRef.current.get(activeFileRef.current)
    if (current) {
      editor.setModel(current)
      publishAnalysis(activeFileRef.current, current)
    }

    // Editor-level paste hook (fires after the paste lands in the model).
    editor.onDidPaste((event) => {
      tracker.handlePaste(activeFileRef.current, event)
    })

    editor.onDidChangeCursorPosition((event) => {
      onCursorChangeRef.current?.({
        lineNumber: event.position.lineNumber,
        column: event.position.column
      })
    })

    // Route Alt+Z through the app's toggle state. Dynamic keybindings take
    // precedence over built-in ones, so the editor option and the View-menu
    // checkmark can never disagree.
    editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyZ, () =>
      onToggleWordWrapRef.current?.()
    )

    // --- Menu command surface ---------------------------------------------

    const runAction = (id: string): void => {
      editor.focus()
      void editor.getAction(id)?.run()
    }

    const copyOrCut = async (cut: boolean): Promise<void> => {
      const model = editor.getModel()
      const selections = editor.getSelections()
      if (!model || !selections) return
      const ranges = selections.filter((range) => !range.isEmpty())
      if (ranges.length === 0) return
      const text = ranges.map((range) => model.getValueInRange(range)).join('\n')
      if (text) await writeClipboardText(text)
      if (!cut) return
      editor.focus()
      // A real edit (not a synthetic clipboard event), so the deletion
      // lands on the undo stack and the tracker sees it.
      editor.executeEdits(
        'menu-cut',
        ranges.map((range) => ({ range, text: '' }))
      )
    }

    const pasteFromClipboard = async (): Promise<void> => {
      const selection = editor.getSelection()
      if (!selection) return
      const text = await readClipboardText()
      if (!text) return
      editor.focus()
      // executeEdits (not a synthetic paste event) keeps this undoable;
      // the tracker's change analysis still records the insertion.
      editor.executeEdits('menu-paste', [{ range: selection, text }])
    }

    if (commandsRef) {
      commandsRef.current = {
        focus: () => {
          editor.focus()
        },
        reveal: (line, column) => {
          editor.revealLineInCenter(line)
          editor.setPosition({ lineNumber: line, column })
          editor.focus()
        },
        undo: () => {
          editor.focus()
          editor.trigger('menu', 'undo', null)
        },
        redo: () => {
          editor.focus()
          editor.trigger('menu', 'redo', null)
        },
        cut: () => void copyOrCut(true),
        copy: () => void copyOrCut(false),
        paste: () => void pasteFromClipboard(),
        find: () => runAction('actions.find'),
        replace: () => runAction('editor.action.startFindReplaceAction'),
        toggleComment: () => runAction('editor.action.commentLine'),
        selectAll: () => {
          editor.focus()
          const model = editor.getModel()
          if (model) editor.setSelection(model.getFullModelRange())
        },
        commandPalette: () => runAction('editor.action.quickCommand')
      }
    }
  }

  useEffect(() => {
    const timers = analysisTimersRef.current
    const disposers = analysisDisposersRef.current
    const providers = providerDisposablesRef
    const cache = analysisCacheRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      for (const disposable of disposers.values()) disposable.dispose()
      disposers.clear()
      for (const disposable of providers.current) disposable.dispose()
      providers.current = []
      cache.clear()
    }
  }, [])

  return (
    <div className="glass-panel editor-window">
      <div className="editor-tabs">
        {files.map((file) => (
          <div
            key={file.name}
            className={`editor-tab ${activeFile === file.name ? 'active' : ''}`}
            onClick={() => onSelectFile(file.name)}
            title={file.path ?? file.name}
          >
            {file.dirty && <span className="tab-dirty-dot" aria-label="Unsaved changes" />}
            {fileDisplayName(file.name)}
            {/* Hidden on single-file workspaces: App never closes the last
                tab, so the button would be dead UI. */}
            {files.length > 1 && onCloseFile && (
              <button
                className="tab-close"
                title={`Close ${fileDisplayName(file.name)}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onCloseFile(file.name)
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="editor-host">
        <Editor
          height="100%"
          theme={monacoTheme}
          keepCurrentModel
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={{
            minimap: { enabled: viewOptions.minimap },
            wordWrap: viewOptions.wordWrap ? 'on' : 'off',
            lineNumbers: viewOptions.lineNumbers ? 'on' : 'off',
            padding: { top: 16 },
            fontSize,
            fontFamily: font.family,
            fontLigatures: ligatures
          }}
        />
      </div>
    </div>
  )
}
