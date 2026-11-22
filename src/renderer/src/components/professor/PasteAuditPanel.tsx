import { ClipboardPaste } from 'lucide-react'
import type { PasteEntry } from '../../types/professor'

interface PasteAuditPanelProps {
  pastes: PasteEntry[]
}

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

export default function PasteAuditPanel({ pastes }: PasteAuditPanelProps): React.ReactElement {
  return (
    <section className="paste-panel paste-audit">
      <header className="panel-head">
        <h3>Paste audit</h3>
        <span className="panel-meta">
          <ClipboardPaste size={11} /> {pastes.length}
        </span>
      </header>

      {pastes.length === 0 ? (
        <div className="paste-empty">No paste events were recorded for this submission.</div>
      ) : (
        <div className="paste-audit-list">
          {pastes.map((paste) => (
            <article key={paste.id} className="paste-audit-entry">
              <header>
                <strong>{paste.chars} chars</strong>
                <span>{paste.mode ?? 'paste'}</span>
                <span>{paste.detectedVia}</span>
                <time>{formatMoment(paste.createdAt)}</time>
              </header>
              <pre className="paste-snippet">{paste.text}</pre>
              <span className="paste-audit-file">{paste.fileName}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
