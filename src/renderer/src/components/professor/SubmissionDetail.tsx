import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { BeforeMount, OnMount } from '@monaco-editor/react'
import type * as monacoTypes from 'monaco-editor'
import { ChevronLeft } from 'lucide-react'
import { useTheme } from '../../themes/useTheme'
import { defineMonacoThemes } from '../../themes/themes'
import { useFont } from '../../fonts/useFont'
import { ensureFontLoaded } from '../../fonts/fontLoading'
import BandBadge from './BandBadge'
import CommentMargin from './CommentMargin'
import GradeBox from './GradeBox'
import IcsPanel from './IcsPanel'
import SnapshotTimeline from './SnapshotTimeline'
import TestRunner from './TestRunner'
import { insertComment } from '../../lib/professorQueries'
import type { CommentEntry, SubmissionDetailData } from '../../types/professor'

interface SubmissionDetailProps {
  detail: SubmissionDetailData
  professorId: string
  onBack: () => void
  onCommentAdded: () => void
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
  onCommentAdded
}: SubmissionDetailProps): React.ReactElement {
  const { monacoTheme } = useTheme()
  const { font, fontSize, ligatures } = useFont()

  const lastSnapshot = detail.snapshots[detail.snapshots.length - 1] ?? null
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    detail.finalSnapshotId ?? lastSnapshot?.id ?? null
  )
  const [editor, setEditor] = useState<monacoTypes.editor.IStandaloneCodeEditor | null>(null)
  const [monaco, setMonaco] = useState<typeof monacoTypes | null>(null)
  const [composer, setComposer] = useState<ComposerState | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const selectedSnapshot =
    detail.snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? lastSnapshot

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
        if (line) {
          setComposer({ line, parentId: null })
          setCommentBody('')
          setCommentError(null)
        }
      }
    })
  }

  const jumpToComment = (comment: CommentEntry): void => {
    if (comment.snapshotId) setSelectedSnapshotId(comment.snapshotId)
    const line = comment.anchorLine ?? 1
    window.setTimeout(() => {
      editor?.revealLineInCenter(line)
      editor?.setPosition({ lineNumber: line, column: 1 })
      editor?.focus()
    }, 60)
  }

  const startReply = (comment: CommentEntry): void => {
    setComposer({ line: comment.anchorLine ?? 1, parentId: comment.id })
    setCommentBody('')
    setCommentError(null)
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
        professorId,
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
          <ChevronLeft size={14} /> All submissions
        </button>
        <div className="detail-who">
          <span className="detail-name">{detail.summary.studentName}</span>
          <span className="detail-sub">
            {detail.summary.studentEmail} · {detail.assignmentTitle} · {detail.classCode}
          </span>
        </div>
        <div className="detail-head-meta">
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
              <span className="panel-meta">
                {selectedSnapshot
                  ? `${selectedSnapshot.type} · ${formatDate(selectedSnapshot.createdAt)}`
                  : 'No snapshot'}
              </span>
            </header>
            <div className="detail-monaco">
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
            </div>
          </section>

          <div className="detail-comments">
            {composer && (
              <div className="comment-composer">
                <div className="comment-composer-head">
                  {composer.parentId ? 'Reply' : 'Comment'} on line {composer.line}
                </div>
                <textarea
                  autoFocus
                  rows={3}
                  value={commentBody}
                  placeholder="Write feedback for this line…"
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
            <CommentMargin comments={detail.comments} onReply={startReply} onJump={jumpToComment} />
          </div>
        </div>

        <aside className="detail-right">
          <SnapshotTimeline
            snapshots={detail.snapshots}
            selectedId={selectedSnapshot?.id ?? null}
            onSelect={setSelectedSnapshotId}
          />
          <IcsPanel score={detail.icsScore} />
          <GradeBox
            submissionId={detail.summary.id}
            professorId={professorId}
            initialGrade={detail.summary.grade}
          />
          <TestRunner
            source={selectedSnapshot?.content ?? ''}
            language={detail.language}
            testCases={detail.testCases}
          />
        </aside>
      </div>
    </div>
  )
}
