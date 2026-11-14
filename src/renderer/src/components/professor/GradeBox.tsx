import { useState } from 'react'
import { Save } from 'lucide-react'
import { saveGrade } from '../../lib/professorQueries'

interface GradeBoxProps {
  submissionId: string
  professorId: string
  initialGrade: number | null
}

export default function GradeBox({
  submissionId,
  professorId,
  initialGrade
}: GradeBoxProps): React.ReactElement {
  const [value, setValue] = useState(initialGrade === null ? '' : String(initialGrade))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the grade.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grade-box">
      <header className="panel-head">
        <h3>Grade</h3>
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

      {error && <div className="grade-error">{error}</div>}
      <p className="grade-note">
        Only the grade fields are writable; the submission itself is immutable.
      </p>
    </section>
  )
}
