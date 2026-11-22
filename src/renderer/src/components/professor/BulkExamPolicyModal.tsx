import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { applyExamPolicyToClass } from '../../lib/examTemplates'

interface BulkExamPolicyModalProps {
  classId: string
  className: string
  onClose: () => void
  onApplied: (updated: number) => void
}

export default function BulkExamPolicyModal({
  classId,
  className,
  onClose,
  onApplied
}: BulkExamPolicyModalProps): React.ReactElement {
  const [allowedTabOuts, setAllowedTabOuts] = useState('1')
  const [fullscreenRequired, setFullscreenRequired] = useState(true)
  const [blockPaste, setBlockPaste] = useState(true)
  const [runOnlyTerminal, setRunOnlyTerminal] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const updated = await applyExamPolicyToClass({
        classId,
        allowedTabOuts: Math.max(0, Math.min(10, Number(allowedTabOuts) || 0)),
        fullscreenRequired,
        blockPaste,
        runOnlyTerminal
      })
      onApplied(updated)
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Could not apply the policy.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal glass-panel" onClick={(event) => event.stopPropagation()}>
        <header className="auth-header">
          <span className="auth-title">
            <ShieldCheck size={15} /> Bulk exam policy
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          Apply these controls to every seatwork in {className}. Existing sessions keep their
          snapshotted settings.
        </p>
        <div className="auth-form">
          <div className="form-field">
            <label htmlFor="bulk-tab-outs">Allowed interruptions</label>
            <input
              id="bulk-tab-outs"
              type="number"
              min={0}
              max={10}
              value={allowedTabOuts}
              onChange={(event) => setAllowedTabOuts(event.target.value)}
            />
          </div>
          <label className="checkbox-field" htmlFor="bulk-fullscreen">
            <input
              id="bulk-fullscreen"
              type="checkbox"
              checked={fullscreenRequired}
              onChange={(event) => setFullscreenRequired(event.target.checked)}
            />
            <span>Require fullscreen</span>
          </label>
          <label className="checkbox-field" htmlFor="bulk-paste">
            <input
              id="bulk-paste"
              type="checkbox"
              checked={blockPaste}
              onChange={(event) => setBlockPaste(event.target.checked)}
            />
            <span>Block paste and drag-drop</span>
          </label>
          <label className="checkbox-field" htmlFor="bulk-run-only">
            <input
              id="bulk-run-only"
              type="checkbox"
              checked={runOnlyTerminal}
              onChange={(event) => setRunOnlyTerminal(event.target.checked)}
            />
            <span>Run-only terminal</span>
          </label>
          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void apply()} disabled={busy}>
              {busy ? 'Applying…' : 'Apply to seatworks'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
