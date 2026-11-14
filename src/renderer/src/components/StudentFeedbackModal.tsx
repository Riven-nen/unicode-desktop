import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { fetchStudentFeedback } from '../lib/professorQueries'
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

  useEffect(() => {
    if (!open || !studentId) return
    let cancelled = false
    void fetchStudentFeedback(studentId)
      .then((feedback) => {
        if (cancelled) return
        setItems(feedback)
        setError(null)
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
  }, [open, studentId])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="auth-overlay">
      <div className="auth-modal glass-panel feedback-modal">
        <header className="auth-header">
          <span className="auth-title">Feedback from your professor</span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        <p className="auth-sub">
          Comments are read-only. They are anchored to lines in your submission.
        </p>

        {items === null && !error && <div className="professor-empty">Loading feedback…</div>}
        {error && <div className="professor-error">{error}</div>}
        {items !== null && items.length === 0 && !error && (
          <div className="professor-empty">No feedback yet.</div>
        )}

        <div className="feedback-list">
          {items?.map((item) => (
            <article
              key={item.id}
              className={`feedback-card ${item.parentId ? 'feedback-card-reply' : ''}`}
            >
              <header className="feedback-card-head">
                <span className="feedback-context">
                  {item.classCode} · {item.assignmentTitle}
                </span>
                {item.anchorLine !== null && (
                  <span className="comment-line">Line {item.anchorLine}</span>
                )}
              </header>
              <p>{item.body}</p>
              <span className="feedback-time">{formatDate(item.createdAt)}</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
