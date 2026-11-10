import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { BeforeMount, OnMount } from '@monaco-editor/react'
import type * as monacoTypes from 'monaco-editor'
import { useTheme } from '../themes/useTheme'
import { defineMonacoThemes } from '../themes/themes'
import { useFont } from '../fonts/useFont'
import { ensureFontLoaded } from '../fonts/fontLoading'
import type { CodeTrackerApi } from '../hooks/useCodeTracker'
import type { LabFile } from '../types/tracker'

interface EditorPaneProps {
  files: LabFile[]
  activeFile: string
  onSelectFile: (name: string) => void
  onCursorChange?: (position: { lineNumber: number; column: number }) => void
  tracker: CodeTrackerApi
}

export default function EditorPane({
  files,
  activeFile,
  onSelectFile,
  onCursorChange,
  tracker
}: EditorPaneProps): React.ReactElement {
  const { monacoTheme } = useTheme()
  const { font, fontSize, ligatures } = useFont()
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monacoTypes | null>(null)
  const modelsRef = useRef(new Map<string, monacoTypes.editor.ITextModel>())
  const activeFileRef = useRef(activeFile)
  const onCursorChangeRef = useRef(onCursorChange)

  // Keep the cursor callback fresh without re-attaching editor listeners.
  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  })

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

  const handleBeforeMount: BeforeMount = (monacoInstance) => {
    defineMonacoThemes(monacoInstance)
  }

  const handleMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance

    for (const file of files) {
      // One model per file, addressed by a stable URI. The getModel guard
      // makes this safe under React StrictMode's double mount.
      const uri = monacoInstance.Uri.parse(`inmemory://lab/${file.name}`)
      const model =
        monacoInstance.editor.getModel(uri) ??
        monacoInstance.editor.createModel(file.initialContent, file.language, uri)
      modelsRef.current.set(file.name, model)
      tracker.attachModel(file.name, model)
    }

    const current = modelsRef.current.get(activeFileRef.current)
    if (current) editor.setModel(current)

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
  }

  return (
    <div className="glass-panel editor-window">
      <div className="editor-tabs">
        {files.map((file) => (
          <div
            key={file.name}
            className={`editor-tab ${activeFile === file.name ? 'active' : ''}`}
            onClick={() => onSelectFile(file.name)}
          >
            {file.name}
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
            minimap: { enabled: false },
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
