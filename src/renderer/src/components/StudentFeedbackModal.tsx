import { useCallback, useEffect, useMemo, useState } from 'react'
import { Reply, X } from 'lucide-react'
import { fetchStudentFeedback, insertComment } from '../lib/professorQueries'
import { markFeedbackSeen } from '../lib/notifications'
import { supabase } from '../lib/supabase'
import type { StudentFeedbackItem } from '../types/professor'

interface StudentFeedbackModalProps {
  open: boolean
  studentId: string | null
  onClose: () => void
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function StudentFeedbackModal({
  open,
  studentId,
  onClose
}: StudentFeedbackModalProps): React.ReactElement | null {
  const [items, setItems] = useState<StudentFeedbackItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [replyingTo, setReplyingTo] = useState<StudentFeedbackItem | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  // Comments belong to a submission, so group them per handed-in assignment
  // and surface the mark and submission time once per group.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        classCode: string
        assignmentTitle: string
        submittedAt: string
        grade: number | null
        items: StudentFeedbackItem[]
      }
    >()
    for (const item of items ?? []) {
      const existing = map.get(item.submissionId)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(item.submissionId, {
          id: item.submissionId,
          classCode: item.classCode,
          assignmentTitle: item.assignmentTitle,
          submittedAt: item.submittedAt,
          grade: item.grade,
          items: [item]
        })
      }
    }
    for (const group of map.values()) {
      group.items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    return [...map.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  }, [items])

  useEffect(() => {
    if (!open || !studentId) return
    let cancelled = false
    void fetchStudentFeedback(studentId)
      .then((feedback) => {
        if (cancelled) return
        setItems(feedback)
        setError(null)
        const newest = feedback.reduce(
          (latest, item) => Math.max(latest, Date.parse(item.createdAt) || 0),
          0
        )
        if (newest > 0) markFeedbackSeen(studentId, newest)
      })
      .catch((feedbackError) => {
        if (cancelled) return
        setItems([])
        setError(
          feedbackError instanceof Error ? feedbackError.message : 'Could not load feedback.'
        )
      })
    return () => {
      cancelled = true
    }
  }, [open, studentId, version])

  // Keep the open thread current when a reply or comment arrives.
  useEffect(() => {
    if (!open || !studentId || !supabase) return
    const channel = supabase
      .channel(`feedback:${studentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () =>
        setVersion((current) => current + 1)
      )
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [open, studentId])

  const closeModal = useCallback((): void => {
    setReplyingTo(null)
    setReplyBody('')
    setReplyError(null)
    onClose()
  }, [onClose])

  const startReply = (item: StudentFeedbackItem): void => {
    setReplyingTo(item)
    setReplyBody('')
    setReplyError(null)
  }

  const sendReply = async (): Promise<void> => {
    if (!replyingTo || !studentId) return
    const body = replyBody.trim()
    if (!body) return
    setReplyBusy(true)
    setReplyError(null)
    try {
      await insertComment({
        submissionId: replyingTo.submissionId,
        authorId: studentId,
        snapshotId: replyingTo.anchorSnapshotId,
        anchorLine: replyingTo.anchorLine ?? 1,
        body,
        parentId: replyingTo.id
      })
      setReplyingTo(null)
      setReplyBody('')
      setVersion((current) => current + 1)
    } catch (replyFailure) {
      setReplyError(
        replyFailure instanceof Error ? replyFailure.message : 'Could not send your reply.'
      )
    } finally {
      setReplyBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeModal])

  if (!open) return null

  return (
    <div className="auth-overlay">
      <div className="auth-modal glass-panel feedback-modal">
        <header className="auth-header">
          <span className="auth-title">Feedback from your professor</span>
          <button className="diff-close" onClick={closeModal} title="Close">
            <X size={14} />
          </button>
        </header>

        <p className="auth-sub">
          Reply to a professor comment to ask a question or explain your work. Replies stay attached
          to the same submission line.
        </p>

        {items === null && !error && <div className="professor-empty">Loading feedback…</div>}
        {error && <div className="professor-error">{error}</div>}
        {items !== null && items.length === 0 && !error && (
          <div className="professor-empty">No feedback yet.</div>
        )}

        <div className="feedback-list">
          {groups.map((group) => (
            <section key={group.id} className="feedback-group">
              <header className="feedback-group-head">
                <div className="feedback-group-copy">
                  <span className="feedback-context">
                    {group.classCode ? `${group.classCode} · ` : ''}
                    {group.assignmentTitle}
                  </span>
                  <span className="feedback-group-submitted">
                    Submitted {formatDate(group.submittedAt)}
                  </span>
                </div>
                {group.grade !== null ? (
                  <span className="feedback-grade">Grade {group.grade}</span>
                ) : (
                  <span className="feedback-grade is-pending">Not graded</span>
                )}
              </header>

              {group.items.map((item) => (
                <article
                  key={item.id}
                  className={`feedback-card ${item.parentId ? 'feedback-card-reply' : ''}`}
                >
                  <header className="feedback-card-head">
                    <span
                      className={`feedback-author ${
                        item.authorRole === 'professor' ? 'is-professor' : 'is-student'
                      }`}
                    >
                      {item.authorRole === 'professor' ? 'Professor' : 'You'}
                    </span>
                    {item.anchorLine !== null && (
                      <span className="comment-line">Line {item.anchorLine}</span>
                    )}
                  </header>
                  <p>{item.body}</p>
                  <div className="feedback-card-foot">
                    <span className="feedback-time">{formatDate(item.createdAt)}</span>
                    {item.authorRole === 'professor' && (
                      <button className="feedback-reply-btn" onClick={() => startReply(item)}>
                        <Reply size={11} /> Reply
                      </button>
                    )}
                  </div>

                  {replyingTo?.id === item.id && (
                    <div className="feedback-reply-box">
                      <textarea
                        value={replyBody}
                        placeholder="Reply to your professor…"
                        rows={2}
                        autoFocus
                        onChange={(event) => setReplyBody(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault()
                            void sendReply()
                          }
                        }}
                      />
                      {replyError && <div className="feedback-reply-error">{replyError}</div>}
                      <div className="feedback-reply-actions">
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setReplyingTo(null)
                            setReplyBody('')
                            setReplyError(null)
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          disabled={replyBusy || replyBody.trim().length === 0}
                          onClick={() => void sendReply()}
                        >
                          {replyBusy ? 'Sending…' : 'Send reply'}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
