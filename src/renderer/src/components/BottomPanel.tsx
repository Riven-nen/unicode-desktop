import { useRef, useState } from 'react'
import { ClipboardCheck, Send, Terminal } from 'lucide-react'
import TerminalPanel from './TerminalPanel'
import TestCasesPanel from './TestCasesPanel'
import type { StudentAssignment } from '../types/student'
import type { ToolchainStatus } from '../../../shared/toolchains'

interface BottomPanelProps {
  workspaceRoot: string | null
  activeFile: string
  filePath: string | null
  language: string
  toolchain: ToolchainStatus | null
  onRecheckToolchain: () => void
  readSource: () => string | null
  assignment: StudentAssignment | null
  onSubmit: () => Promise<void>
  onSubmitted: () => void
}

const MIN_HEIGHT = 160
const MAX_HEIGHT = 560

export default function BottomPanel({
  workspaceRoot,
  activeFile,
  filePath,
  language,
  toolchain,
  onRecheckToolchain,
  readSource,
  assignment,
  onSubmit,
  onSubmitted
}: BottomPanelProps): React.ReactElement {
  const [testsOpen, setTestsOpen] = useState(false)
  const [height, setHeight] = useState(300)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  const testsAvailable = assignment?.autoTestEnabled ?? false
  const showTests = testsOpen && testsAvailable && assignment !== null

  const startResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = height
    const handleMove = (moveEvent: PointerEvent): void => {
      const next = startHeight + (startY - moveEvent.clientY)
      setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next)))
    }
    const handleUp = (): void => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const submit = async (): Promise<void> => {
    if (!assignment) return
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      await onSubmit()
      setNotice(`Submitted “${assignment.title}”.`)
      onSubmitted()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Could not submit the assignment.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bottom-panel" style={{ height }} ref={panelRef}>
      <div
        className="bottom-panel-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal panel"
        onPointerDown={startResize}
      />

      <header className="bottom-panel-head">
        <div className="bottom-panel-title">
          <Terminal size={13} /> Terminal
          <span className="bottom-panel-file">{activeFile}</span>
        </div>

        <div className="bottom-panel-actions">
          {testsAvailable && (
            <button
              className={`bottom-tab ${testsOpen ? 'active' : ''}`}
              aria-pressed={testsOpen}
              onClick={() => setTestsOpen((open) => !open)}
              title={testsOpen ? 'Hide test cases' : 'Show test cases'}
            >
              <ClipboardCheck size={13} /> Test cases
            </button>
          )}
          {notice && <span className="auth-info bottom-notice">{notice}</span>}
          {error && <span className="grade-error bottom-notice">{error}</span>}
          {assignment ? (
            <button
              className="btn-primary"
              onClick={() => void submit()}
              disabled={submitting}
              title={`Submit ${activeFile}`}
            >
              <Send size={13} />
              {submitting
                ? 'Submitting…'
                : assignment.latestSubmission
                  ? 'Resubmit'
                  : 'Submit assignment'}
            </button>
          ) : (
            <span className="bottom-unlinked">No assignment linked to {activeFile}</span>
          )}
        </div>
      </header>

      <div className="bottom-panel-body">
        <div className="terminal-dock">
          <TerminalPanel
            key={workspaceRoot ?? 'no-workspace'}
            workspaceRoot={workspaceRoot}
            filePath={filePath}
            language={language}
            toolchain={toolchain}
            onRecheckToolchain={onRecheckToolchain}
          />
        </div>

        {showTests && assignment && (
          <div className="tests-dock">
            <TestCasesPanel
              key={assignment.id}
              assignment={assignment}
              language={language}
              readSource={readSource}
            />
          </div>
        )}
      </div>
    </section>
  )
}
