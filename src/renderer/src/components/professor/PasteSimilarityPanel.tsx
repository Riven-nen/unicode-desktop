import { AlertTriangle, ClipboardPaste } from 'lucide-react'
import type { PasteSimilarityMatch } from '../../types/professor'

interface PasteSimilarityPanelProps {
  pasteCount: number
  matches: PasteSimilarityMatch[]
  loading: boolean
  error: string | null
}

const preview = (text: string): string => (text.length > 260 ? `${text.slice(0, 260)}…` : text)

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function PasteSimilarityPanel({
  pasteCount,
  matches,
  loading,
  error
}: PasteSimilarityPanelProps): React.ReactElement {
  return (
    <section className="paste-panel">
      <header className="panel-head">
        <h3>Paste similarity</h3>
        {matches.length > 0 ? (
          <span className="paste-alert">
            <AlertTriangle size={11} /> Paste detected
          </span>
        ) : (
          <span className="panel-meta">
            <ClipboardPaste size={11} /> {pasteCount}
          </span>
        )}
      </header>

      {loading && <div className="professor-empty">Comparing pastes…</div>}
      {error && <div className="grade-error">{error}</div>}

      {!loading && !error && pasteCount === 0 && (
        <div className="paste-empty">No paste events were recorded for this submission.</div>
      )}

      {!loading && !error && pasteCount > 0 && matches.length === 0 && (
        <div className="paste-empty">
          {pasteCount} paste {pasteCount === 1 ? 'event' : 'events'} recorded. No cross-student
          match above 45% in this class.
        </div>
      )}

      {matches.length > 0 && (
        <div className="paste-match-list">
          {matches.map((match) => (
            <article className="paste-match" key={match.pasteId}>
              <header>
                <span className="paste-match-score">{Math.round(match.similarity * 100)}%</span>
                <span>
                  similar to <strong>{match.matchStudentName}</strong>
                </span>
                <time>{formatDate(match.matchCreatedAt)}</time>
              </header>

              <pre className="paste-snippet">{preview(match.pastedText)}</pre>

              <details className="paste-match-detail">
                <summary>Compare matched paste</summary>
                <pre className="paste-snippet is-match">{preview(match.matchText)}</pre>
              </details>

              <p className="paste-match-note">
                Compared with a paste on {match.matchStudentName}’s submission from{' '}
                {formatDate(match.matchCreatedAt)}.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
