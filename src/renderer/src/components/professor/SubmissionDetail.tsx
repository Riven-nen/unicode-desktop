import { useEffect, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import type { BeforeMount, OnMount } from '@monaco-editor/react'
import type * as monacoTypes from 'monaco-editor'
import { AlertTriangle, ChevronLeft, GitCompareArrows, Play, Square } from 'lucide-react'
import { useTheme } from '../../themes/useTheme'
import { defineMonacoThemes } from '../../themes/themes'
import { useFont } from '../../fonts/useFont'
import { ensureFontLoaded } from '../../fonts/fontLoading'
import BandBadge from './BandBadge'
import CommentMargin from './CommentMargin'
import GradeBox from './GradeBox'
import IcsPanel from './IcsPanel'
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
  const [replaying, setReplaying] = useState(false)
  const [replayContent, setReplayContent] = useState<string | null>(null)
  const [replayLabel, setReplayLabel] = useState<string | null>(null)
  const [replayProgress, setReplayProgress] = useState(0)
  const [pasteMatches, setPasteMatches] = useState<PasteSimilarityMatch[]>([])
  const [pasteLoading, setPasteLoading] = useState(true)
  const [pasteError, setPasteError] = useState<string | null>(null)

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

  const stopReplay = (): void => {
    setReplaying(false)
    setReplayContent(null)
    setReplayLabel(null)
    setReplayProgress(0)
  }

  const startReplay = (): void => {
    if (detail.snapshots.length === 0) return
    setDiffMode(false)
    setReplayContent('')
    setReplayProgress(0)
    setSelectedSnapshotId(detail.snapshots[0].id)
    setReplaying(true)
  }

  const selectSnapshot = (snapshotId: string): void => {
    if (replaying) stopReplay()
    setSelectedSnapshotId(snapshotId)
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

  useEffect(() => {
    if (!replaying) return
    const frames = detail.snapshots
    if (frames.length === 0) return

    const firstAt = Date.parse(frames[0].createdAt)
    const lastAt = Date.parse(frames[frames.length - 1].createdAt)
    const sourceSpan = Math.max(1, lastAt - firstAt)
    const duration = Math.min(45_000, Math.max(3_000, sourceSpan))
    const starts = frames.map(
      (frame) => ((Date.parse(frame.createdAt) - firstAt) / sourceSpan) * duration
    )
    const startedAt = Date.now()
    let currentIndex = -1

    const tick = (): void => {
      const elapsed = Math.min(Date.now() - startedAt, duration)
      let index = 0
      while (index + 1 < frames.length && starts[index + 1] <= elapsed) index += 1

      if (index !== currentIndex) {
        currentIndex = index
        setSelectedSnapshotId(frames[index].id)
      }

      const frameStart = starts[index]
      const frameEnd = index + 1 < frames.length ? starts[index + 1] : duration
      const progress =
        frameEnd > frameStart
          ? Math.max(0, Math.min(1, (elapsed - frameStart) / (frameEnd - frameStart)))
          : 1
      const previous = index === 0 ? '' : frames[index - 1].content
      const current = frames[index].content
      let display = current
      if (current.length > previous.length) {
        const reveal = Math.max(
          0,
          Math.min(
            current.length,
            Math.floor(previous.length + (current.length - previous.length) * progress)
          )
        )
        display = current.slice(0, reveal)
      }

      setReplayContent(display)
      setReplayLabel(`${index + 1}/${frames.length}`)
      setReplayProgress(duration === 0 ? 100 : Math.round((elapsed / duration) * 100))

      if (elapsed >= duration) {
        setReplayContent(null)
        setReplayLabel(null)
        setReplayProgress(0)
        setReplaying(false)
      }
    }

    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [replaying, detail.snapshots])

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
          <section className="detail-editor-panel">
            <header className="panel-head">
              <h3>Submission</h3>
              <div className="detail-editor-actions">
                <button
                  className="icon-text-btn"
                  onClick={replaying ? stopReplay : startReplay}
                  disabled={detail.snapshots.length === 0}
                  title={replaying ? 'Stop replay' : 'Replay this submission'}
                >
                  {replaying ? <Square size={11} /> : <Play size={11} />}
                  {replaying ? 'Stop' : 'Replay'}
                </button>
                <button
                  className={`icon-text-btn ${diffMode && previousSnapshot ? 'is-active' : ''}`}
                  onClick={() => {
                    stopReplay()
                    setDiffMode((current) => !current)
                  }}
                  disabled={!previousSnapshot}
                  title="Compare with the previous snapshot"
                >
                  <GitCompareArrows size={11} />
                  {diffMode && previousSnapshot ? 'Single' : 'Diff'}
                </button>
                <span className="panel-meta">
                  {replaying
                    ? `Replay ${replayLabel ?? ''}`
                    : selectedSnapshot
                      ? `${selectedSnapshot.type} · ${formatDate(selectedSnapshot.createdAt)}`
                      : 'No snapshot'}
                </span>
              </div>
            </header>
            <div className="detail-monaco">
              {replaying ? (
                <Editor
                  height="100%"
                  theme={monacoTheme}
                  value={replayContent ?? ''}
                  language={detail.language ?? 'plaintext'}
                  beforeMount={handleBeforeMount}
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
              ) : diffMode && previousSnapshot && selectedSnapshot ? (
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
            {replaying && (
              <div className="replay-status">
                <span>
                  <Play size={10} /> Replaying {replayLabel ?? '…'} · {replayProgress}%
                </span>
                <span className="replay-track">
                  <span style={{ width: `${replayProgress}%` }} />
                </span>
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
          />
          <RunHistory submissionId={detail.summary.id} version={runsVersion} />
        </aside>
      </div>
    </div>
  )
}
