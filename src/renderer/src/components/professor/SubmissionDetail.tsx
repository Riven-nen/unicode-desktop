import { useEffect, useRef, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import type { BeforeMount, OnMount } from '@monaco-editor/react'
import type * as monacoTypes from 'monaco-editor'
import { AlertTriangle, ChevronLeft, GitCompareArrows, Terminal } from 'lucide-react'
import { useTheme } from '../../themes/useTheme'
import { defineMonacoThemes } from '../../themes/themes'
import { useFont } from '../../fonts/useFont'
import { ensureFontLoaded } from '../../fonts/fontLoading'
import { useToolchainStatus } from '../../hooks/useToolchainStatus'
import TerminalPanel from '../TerminalPanel'
import type { SubmissionLocalRun } from '../../../../shared/terminal'
import BandBadge from './BandBadge'
import CommentMargin from './CommentMargin'
import GradeBox from './GradeBox'
import IcsPanel from './IcsPanel'
import PasteAuditPanel from './PasteAuditPanel'
import PasteSimilarityPanel from './PasteSimilarityPanel'
import RunHistory from './RunHistory'
import SnapshotTimeline from './SnapshotTimeline'
import TestRunner from './TestRunner'
import { fetchPasteSimilarity, insertComment, recomputeIcs } from '../../lib/professorQueries'
import type {
  CommentEntry,
  PasteSimilarityMatch,
  SubmissionDetailData
} from '../../types/professor'

interface SubmissionDetailProps {
  detail: SubmissionDetailData
  professorId: string
  onBack: () => void
  onCommentAdded: () => void
  onRecomputed: () => void
}

interface ComposerState {
  line: number
  parentId: string | null
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function SubmissionDetail({
  detail,
  professorId,
  onBack,
  onCommentAdded,
  onRecomputed
}: SubmissionDetailProps): React.ReactElement {
  const { monacoTheme } = useTheme()
  const { font, fontSize, ligatures } = useFont()

  const lastSnapshot = detail.snapshots[detail.snapshots.length - 1] ?? null
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    detail.finalSnapshotId ?? lastSnapshot?.id ?? null
  )
  const [editor, setEditor] = useState<monacoTypes.editor.IStandaloneCodeEditor | null>(null)
  const [monaco, setMonaco] = useState<typeof monacoTypes | null>(null)
  const [cursorLine, setCursorLine] = useState(1)
  const [composer, setComposer] = useState<ComposerState | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [icsBusy, setIcsBusy] = useState(false)
  const [icsError, setIcsError] = useState<string | null>(null)
  const [runsVersion, setRunsVersion] = useState(0)
  const [diffMode, setDiffMode] = useState(false)
  const [pasteMatches, setPasteMatches] = useState<PasteSimilarityMatch[]>([])
  const [pasteLoading, setPasteLoading] = useState(true)
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [localRun, setLocalRun] = useState<SubmissionLocalRun | null>(null)
  const [localTerminalOpen, setLocalTerminalOpen] = useState(false)
  const [localTerminalBusy, setLocalTerminalBusy] = useState(false)
  const [localTerminalError, setLocalTerminalError] = useState<string | null>(null)
  const [localSnapshotLabel, setLocalSnapshotLabel] = useState<string | null>(null)
  const localRunRef = useRef<SubmissionLocalRun | null>(null)
  const localTerminalRef = useRef<HTMLDivElement | null>(null)
  const toolchain = useToolchainStatus(detail.language ?? '')

  const recompute = async (): Promise<void> => {
    setIcsBusy(true)
    setIcsError(null)
    try {
      await recomputeIcs(detail.summary.id)
      onRecomputed()
    } catch (scoreError) {
      setIcsError(
        scoreError instanceof Error ? scoreError.message : 'Could not recompute the score.'
      )
    } finally {
      setIcsBusy(false)
    }
  }

  const selectedSnapshot =
    detail.snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? lastSnapshot
  const selectedIndex = detail.snapshots.findIndex(
    (snapshot) => snapshot.id === selectedSnapshot?.id
  )
  const previousSnapshot = selectedIndex > 0 ? detail.snapshots[selectedIndex - 1] : null

  const selectSnapshot = (snapshotId: string): void => {
    setSelectedSnapshotId(snapshotId)
  }

  useEffect(() => {
    localRunRef.current = localRun
  }, [localRun])

  // Opening the terminal should not leave it below the visible editor area.
  useEffect(() => {
    if (!localTerminalOpen || !localRun) return
    requestAnimationFrame(() => {
      localTerminalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [localTerminalOpen, localRun])

  // Releasing the detail view must also release the temporary copy and shell.
  useEffect(() => {
    return () => {
      const run = localRunRef.current
      if (run) window.api.submissions.discard(run.runId)
    }
  }, [])

  const openLocalTerminal = async (): Promise<void> => {
    if (!selectedSnapshot || localTerminalBusy) return
    setLocalTerminalBusy(true)
    setLocalTerminalError(null)
    try {
      const run = await window.api.submissions.prepare({
        submissionId: detail.summary.id,
        fileName: detail.fileName ?? 'submission',
        language: detail.language ?? 'plaintext',
        content: selectedSnapshot.content
      })
      const previous = localRunRef.current
      if (previous) window.api.submissions.discard(previous.runId)
      localRunRef.current = run
      setLocalRun(run)
      setLocalSnapshotLabel(formatDate(selectedSnapshot.createdAt))
      setLocalTerminalOpen(true)
    } catch (error) {
      setLocalTerminalError(
        error instanceof Error ? error.message : 'Could not prepare the local submission.'
      )
    } finally {
      setLocalTerminalBusy(false)
    }
  }

  const closeLocalTerminal = (): void => {
    const run = localRunRef.current
    if (run) window.api.submissions.discard(run.runId)
    localRunRef.current = null
    setLocalRun(null)
    setLocalSnapshotLabel(null)
    setLocalTerminalOpen(false)
    setLocalTerminalError(null)
  }

  useEffect(() => {
    let cancelled = false
    void fetchPasteSimilarity(detail.summary.id)
      .then((matches) => {
        if (!cancelled) setPasteMatches(matches)
      })
      .catch((error) => {
        if (!cancelled) {
          setPasteMatches([])
          setPasteError(error instanceof Error ? error.message : 'Could not compare paste events.')
        }
      })
      .finally(() => {
        if (!cancelled) setPasteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detail.summary.id])

  const openComposer = (line: number = cursorLine, parentId: string | null = null): void => {
    setComposer({ line: Math.max(1, line), parentId })
    setCommentBody('')
    setCommentError(null)
  }

  // Keep the editor font in sync with the studio settings.
  useEffect(() => {
    let cancelled = false
    void ensureFontLoaded(font.family).then(() => {
      if (cancelled) return
      editor?.updateOptions({ fontFamily: font.family, fontSize, fontLigatures: ligatures })
      monaco?.editor.remeasureFonts()
    })
    return () => {
      cancelled = true
    }
  }, [editor, monaco, font, fontSize, ligatures])

  // Highlight every line that has a comment.
  useEffect(() => {
    if (!editor || !monaco) return
    const decorations = detail.comments
      .filter((comment) => comment.anchorLine !== null)
      .map((comment) => ({
        range: new monaco.Range(comment.anchorLine as number, 1, comment.anchorLine as number, 1),
        options: {
          isWholeLine: true,
          className: 'comment-line-highlight',
          linesDecorationsClassName: 'comment-line-glyph'
        }
      }))
    editor.deltaDecorations([], decorations)
  }, [editor, monaco, detail.comments])

  const handleBeforeMount: BeforeMount = (monacoInstance) => {
    defineMonacoThemes(monacoInstance)
  }

  const handleMount: OnMount = (mountedEditor, monacoInstance) => {
    setEditor(mountedEditor)
    setMonaco(monacoInstance)

    mountedEditor.onDidChangeCursorPosition((event) => {
      setCursorLine(event.position.lineNumber)
    })

    // Clicking a line number (or its glyph margin) opens the comment composer.
    mountedEditor.onMouseDown((event) => {
      const { MouseTargetType } = monacoInstance.editor
      const type = event.target.type
      if (
        type === MouseTargetType.GUTTER_LINE_NUMBERS ||
        type === MouseTargetType.GUTTER_LINE_DECORATIONS ||
        type === MouseTargetType.GUTTER_GLYPH_MARGIN
      ) {
        const line = event.target.position?.lineNumber
        if (line) openComposer(line)
      }
    })
  }

  const jumpToComment = (comment: CommentEntry): void => {
    if (comment.snapshotId) selectSnapshot(comment.snapshotId)
    const line = comment.anchorLine ?? 1
    window.setTimeout(() => {
      editor?.revealLineInCenter(line)
      editor?.setPosition({ lineNumber: line, column: 1 })
      editor?.focus()
    }, 60)
  }

  const startReply = (comment: CommentEntry): void => {
    openComposer(comment.anchorLine ?? 1, comment.id)
  }

  const submitComment = async (): Promise<void> => {
    if (!composer) return
    const body = commentBody.trim()
    if (!body) return

    setCommentBusy(true)
    setCommentError(null)
    try {
      await insertComment({
        submissionId: detail.summary.id,
        authorId: professorId,
        snapshotId: selectedSnapshot?.id ?? null,
        anchorLine: composer.line,
        body,
        parentId: composer.parentId
      })
      setComposer(null)
      setCommentBody('')
      onCommentAdded()
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Could not post the comment.')
    } finally {
      setCommentBusy(false)
    }
  }

  return (
    <div className="professor-detail">
      <header className="detail-head">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={14} /> Back
        </button>
        <div className="detail-who">
          <span className="detail-name">{detail.summary.studentName}</span>
          <span className="detail-sub">
            {detail.summary.studentEmail} · {detail.assignmentTitle} · {detail.classCode}
          </span>
        </div>
        <div className="detail-head-meta">
          {detail.summary.pasteCount > 0 && (
            <span className="paste-alert">
              <AlertTriangle size={11} /> Paste detected
            </span>
          )}
          <BandBadge band={detail.summary.band} />
          {detail.summary.ics !== null && (
            <span className="detail-ics">{detail.summary.ics.toFixed(1)}</span>
          )}
        </div>
      </header>

      <div className="detail-body">
        <div className="detail-left">
          <section className={`detail-editor-panel ${localTerminalOpen ? 'has-terminal' : ''}`}>
            <header className="panel-head">
              <h3>Submission</h3>
              <div className="detail-editor-actions">
                <button
                  className={`icon-text-btn ${localTerminalOpen ? 'is-active' : ''}`}
                  onClick={() => {
                    if (localTerminalOpen) closeLocalTerminal()
                    else void openLocalTerminal()
                  }}
                  disabled={!selectedSnapshot || localTerminalBusy}
                  title={
                    localTerminalOpen
                      ? 'Close the local submission terminal'
                      : 'Run the selected snapshot in a local terminal (uses your local OS permissions)'
                  }
                >
                  <Terminal size={11} />
                  {localTerminalBusy
                    ? 'Preparing…'
                    : localTerminalOpen
                      ? 'Close terminal'
                      : 'Local terminal'}
                </button>
                <button
                  className={`icon-text-btn ${diffMode && previousSnapshot ? 'is-active' : ''}`}
                  onClick={() => setDiffMode((current) => !current)}
                  disabled={!previousSnapshot}
                  title="Compare with the previous snapshot"
                >
                  <GitCompareArrows size={11} />
                  {diffMode && previousSnapshot ? 'Single' : 'Diff'}
                </button>
                <span className="panel-meta">
                  {selectedSnapshot
                    ? `${selectedSnapshot.type} · ${formatDate(selectedSnapshot.createdAt)}`
                    : 'No snapshot'}
                </span>
              </div>
            </header>
            <div className="detail-monaco">
              {diffMode && previousSnapshot && selectedSnapshot ? (
                <DiffEditor
                  height="100%"
                  theme={monacoTheme}
                  original={previousSnapshot.content}
                  modified={selectedSnapshot.content}
                  language={detail.language ?? 'plaintext'}
                  beforeMount={handleBeforeMount}
                  keepCurrentOriginalModel
                  keepCurrentModifiedModel
                  options={{
                    readOnly: true,
                    originalEditable: false,
                    renderSideBySide: false,
                    enableSplitViewResizing: false,
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'off',
                    fontSize,
                    fontFamily: font.family,
                    fontLigatures: ligatures,
                    padding: { top: 12 },
                    automaticLayout: true
                  }}
                />
              ) : (
                <Editor
                  height="100%"
                  theme={monacoTheme}
                  value={selectedSnapshot?.content ?? ''}
                  language={detail.language ?? 'plaintext'}
                  beforeMount={handleBeforeMount}
                  onMount={handleMount}
                  options={{
                    readOnly: true,
                    domReadOnly: true,
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'off',
                    fontSize,
                    fontFamily: font.family,
                    fontLigatures: ligatures,
                    padding: { top: 12 },
                    automaticLayout: true
                  }}
                />
              )}
            </div>
            {localTerminalError && <div className="grade-error">{localTerminalError}</div>}
            {localTerminalOpen && localRun && (
              <div className="detail-terminal" ref={localTerminalRef}>
                <div className="detail-terminal-head">
                  <span className="detail-terminal-title">
                    <Terminal size={12} /> Local terminal
                  </span>
                  <span className="panel-meta">
                    {localSnapshotLabel ? `Snapshot ${localSnapshotLabel}` : 'Selected snapshot'}
                  </span>
                  <button
                    className="icon-text-btn"
                    onClick={() => void openLocalTerminal()}
                    disabled={localTerminalBusy || !selectedSnapshot}
                    title="Restart the terminal with the currently selected snapshot"
                  >
                    {localTerminalBusy ? 'Preparing…' : 'Use selected snapshot'}
                  </button>
                  <button className="icon-text-btn" onClick={closeLocalTerminal}>
                    Close
                  </button>
                </div>
                <TerminalPanel
                  key={localRun.runId}
                  workspaceRoot={null}
                  submissionRunId={localRun.runId}
                  filePath={localRun.filePath}
                  language={detail.language ?? 'plaintext'}
                  toolchain={toolchain.status}
                  onRecheckToolchain={toolchain.recheck}
                />
              </div>
            )}
          </section>

          <div className="detail-comments">
            {composer && (
              <div className="comment-composer">
                <div className="comment-composer-head">
                  <span>{composer.parentId ? 'Reply on line' : 'Comment on line'}</span>
                  <input
                    className="comment-line-input"
                    type="number"
                    min={1}
                    value={composer.line}
                    aria-label="Comment line number"
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      if (!Number.isFinite(next)) return
                      setComposer({ ...composer, line: Math.max(1, Math.round(next)) })
                    }}
                  />
                </div>
                <textarea
                  autoFocus
                  rows={3}
                  value={commentBody}
                  placeholder={`Write feedback for line ${composer.line}…`}
                  aria-label={`Comment on line ${composer.line}`}
                  onChange={(event) => setCommentBody(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setComposer(null)
                      setCommentBody('')
                      setCommentError(null)
                    }
                  }}
                />
                {commentError && <div className="grade-error">{commentError}</div>}
                <div className="comment-composer-actions">
                  <button
                    className="btn-secondary"
                    disabled={commentBusy}
                    onClick={() => {
                      setComposer(null)
                      setCommentBody('')
                      setCommentError(null)
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    disabled={commentBusy || !commentBody.trim()}
                    onClick={() => void submitComment()}
                  >
                    {commentBusy ? 'Posting…' : 'Post comment'}
                  </button>
                </div>
              </div>
            )}
            <CommentMargin
              comments={detail.comments}
              onAddComment={() => openComposer()}
              onReply={startReply}
              onJump={jumpToComment}
            />
          </div>
        </div>

        <aside className="detail-right">
          <SnapshotTimeline
            snapshots={detail.snapshots}
            selectedId={selectedSnapshot?.id ?? null}
            onSelect={selectSnapshot}
          />
          <IcsPanel
            score={detail.icsScore}
            snapshots={detail.snapshots}
            onRecompute={() => void recompute()}
            busy={icsBusy}
            error={icsError}
          />
          <PasteAuditPanel pastes={detail.pastes} />
          <PasteSimilarityPanel
            pasteCount={detail.summary.pasteCount}
            matches={pasteMatches}
            loading={pasteLoading}
            error={pasteError}
          />
          <GradeBox
            submissionId={detail.summary.id}
            professorId={professorId}
            initialGrade={detail.summary.grade}
            initialReleased={detail.summary.gradeReleased}
            initialReleasedAt={detail.summary.gradeReleasedAt}
            onChanged={onRecomputed}
          />
          <TestRunner
            key={`${selectedSnapshot?.id ?? 'none'}-${detail.testCases.length}`}
            source={selectedSnapshot?.content ?? ''}
            language={detail.language}
            testCases={detail.testCases}
            userId={professorId}
            submissionId={detail.summary.id}
            assignmentId={detail.assignmentId}
            snapshotId={selectedSnapshot?.id ?? null}
            fileName={detail.fileName}
            onRecorded={() => setRunsVersion((version) => version + 1)}
            onRunLocally={() => void openLocalTerminal()}
          />
          <RunHistory submissionId={detail.summary.id} version={runsVersion} />
        </aside>
      </div>
    </div>
  )
}
