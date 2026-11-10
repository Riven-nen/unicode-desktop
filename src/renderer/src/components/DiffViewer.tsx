import { useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import type { DiffBeforeMount } from '@monaco-editor/react'
import { ChevronLeft, ChevronRight, ClipboardPaste, RotateCcw, X } from 'lucide-react'
import { formatClockTime } from '../lib/time'
import { useTheme } from '../themes/useTheme'
import { useFont } from '../fonts/useFont'
import { defineMonacoThemes } from '../themes/themes'
import type { CodeSnapshot, PasteEventRecord } from '../types/tracker'

interface DiffViewerProps {
  open: boolean
  fileName: string
  language: string
  snapshots: CodeSnapshot[]
  snapshotId: string | null
  currentContent: string
  pastes: PasteEventRecord[]
  onClose: () => void
  onSelect: (snapshot: CodeSnapshot) => void
  onRestore: (snapshot: CodeSnapshot) => void
}

type CompareMode = 'previous' | 'current'

export default function DiffViewer({
  open,
  fileName,
  language,
  snapshots,
  snapshotId,
  currentContent,
  pastes,
  onClose,
  onSelect,
  onRestore
}: DiffViewerProps): React.ReactElement | null {
  const [compareMode, setCompareMode] = useState<CompareMode>('previous')
  const { monacoTheme } = useTheme()
  const { font, fontSize, ligatures } = useFont()
  // Side-by-side diffs need horizontal room; narrow windows get inline diffs.
  const [sideBySide, setSideBySide] = useState(() => window.innerWidth > 720)

  useEffect(() => {
    const handleResize = (): void => setSideBySide(window.innerWidth > 720)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleBeforeMount: DiffBeforeMount = (monacoInstance) => {
    defineMonacoThemes(monacoInstance)
  }

  if (!open || !snapshotId) return null

  const index = snapshots.findIndex((snapshot) => snapshot.id === snapshotId)
  if (index === -1) return null

  const selected = snapshots[index]
  const older = snapshots[index + 1]
  const newer = snapshots[index - 1]

  // 'previous' shows what this snapshot introduced at that moment;
  // 'current' shows what would be reverted by restoring it.
  const original = compareMode === 'previous' ? (older?.content ?? '') : selected.content
  const modified = compareMode === 'previous' ? selected.content : currentContent
  const pasteRecord = pastes.find((paste) => paste.snapshot_id === selected.id)

  return (
    <div className="diff-overlay">
      <div className="diff-modal glass-panel">
        <header className="diff-header">
          <span className="diff-title">Time Travel — {fileName}</span>
          <span className={`diff-type-badge type-${selected.snapshot_type}`}>
            {selected.snapshot_type}
          </span>
          <span className="diff-time">
            {formatClockTime(selected.created_at)} · v{selected.version}
          </span>
          <div className="diff-nav">
            <button
              disabled={!older}
              onClick={() => older && onSelect(older)}
              title="Older snapshot"
            >
              <ChevronLeft size={14} />
            </button>
            <span>
              {index + 1} / {snapshots.length}
            </span>
            <button
              disabled={!newer}
              onClick={() => newer && onSelect(newer)}
              title="Newer snapshot"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="diff-compare-toggle">
            <button
              className={compareMode === 'previous' ? 'active' : ''}
              onClick={() => setCompareMode('previous')}
            >
              vs previous
            </button>
            <button
              className={compareMode === 'current' ? 'active' : ''}
              onClick={() => setCompareMode('current')}
            >
              vs current
            </button>
          </div>
          <button className="diff-restore" onClick={() => onRestore(selected)}>
            <RotateCcw size={12} /> Restore
          </button>
          <button className="diff-close" onClick={onClose} title="Close (Esc)">
            <X size={14} />
          </button>
        </header>
        {pasteRecord && (
          <div className="paste-callout">
            <div className="paste-callout-title">
              <ClipboardPaste size={12} />
              <span>
                Pasted {pasteRecord.pasted_chars} chars ({pasteRecord.paste_mode}, detected via{' '}
                {pasteRecord.detected_via})
              </span>
            </div>
            <pre className="paste-text">{pasteRecord.pasted_text}</pre>
          </div>
        )}
        <div className="diff-body">
          <DiffEditor
            height="100%"
            theme={monacoTheme}
            beforeMount={handleBeforeMount}
            language={language}
            original={original}
            modified={modified}
            options={{
              renderSideBySide: sideBySide,
              ignoreTrimWhitespace: false,
              readOnly: true,
              originalEditable: false,
              minimap: { enabled: false },
              fontSize: fontSize - 1,
              fontFamily: font.family,
              fontLigatures: ligatures,
              scrollBeyondLastLine: false
            }}
          />
        </div>
      </div>
    </div>
  )
}
