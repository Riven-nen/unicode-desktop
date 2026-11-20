import { useState } from 'react'
import { EyeOff, Save, Send } from 'lucide-react'
import { saveGrade, setSubmissionGradeRelease } from '../../lib/professorQueries'

interface GradeBoxProps {
  submissionId: string
  professorId: string
  initialGrade: number | null
  initialReleased: boolean
  initialReleasedAt: string | null
  /** Refreshes the detail after a save or release. */
  onChanged?: () => void
}

export default function GradeBox({
  submissionId,
  professorId,
  initialGrade,
  initialReleased,
  initialReleasedAt,
  onChanged
}: GradeBoxProps): React.ReactElement {
  const [value, setValue] = useState(initialGrade === null ? '' : String(initialGrade))
  const [hasGrade, setHasGrade] = useState(initialGrade !== null)
  const [released, setReleased] = useState(initialReleased)
  const [releasedAt, setReleasedAt] = useState<string | null>(initialReleasedAt)
  const [busy, setBusy] = useState(false)
  const [releaseBusy, setReleaseBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const submit = async (): Promise<void> => {
    const grade = Number(value)
    if (value.trim() === '' || Number.isNaN(grade) || grade < 0 || grade > 100) {
      setError('Enter a grade between 0 and 100.')
      setSaved(false)
      return
    }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await saveGrade({ submissionId, professorId, grade })
      setHasGrade(true)
      setReleased(false)
      setReleasedAt(null)
      setSaved(true)
      onChanged?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the grade.')
    } finally {
      setBusy(false)
    }
  }

  const toggleRelease = async (): Promise<void> => {
    const next = !released
    setReleaseBusy(true)
    setReleaseError(null)
    try {
      await setSubmissionGradeRelease({ submissionId, released: next })
      setReleased(next)
      setReleasedAt(next ? new Date().toISOString() : null)
      onChanged?.()
    } catch (releaseFailure) {
      setReleaseError(
        releaseFailure instanceof Error
          ? releaseFailure.message
          : 'Could not update grade visibility.'
      )
    } finally {
      setReleaseBusy(false)
    }
  }

  return (
    <section className="grade-box">
      <header className="panel-head">
        <h3>Grade</h3>
        <span className={`release-badge ${released ? 'is-released' : 'is-private'}`}>
          {released ? 'Released' : 'Private'}
        </span>
        {saved && <span className="saved-note">Saved</span>}
      </header>

      <div className="grade-row">
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          inputMode="decimal"
          placeholder="0–100"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setSaved(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
          }}
          aria-label="Submission grade"
        />
        <button className="btn-primary" onClick={() => void submit()} disabled={busy}>
          <Save size={13} /> {busy ? 'Saving…' : 'Save grade'}
        </button>
      </div>

      <div className="grade-release-row">
        <button
          className="btn-secondary"
          onClick={() => void toggleRelease()}
          disabled={releaseBusy || !hasGrade}
        >
          {released ? <EyeOff size={13} /> : <Send size={13} />}
          {releaseBusy ? 'Updating…' : released ? 'Hide from student' : 'Release to student'}
        </button>
        <span className="grade-release-note">
          {released && releasedAt
            ? `Visible since ${new Date(releasedAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}.`
            : 'Saving hides the mark until you release it.'}
        </span>
      </div>

      {error && <div className="grade-error">{error}</div>}
      {releaseError && <div className="grade-error">{releaseError}</div>}
      <p className="grade-note">
        Only the grade fields are writable; the submission itself is immutable.
      </p>
    </section>
  )
}
