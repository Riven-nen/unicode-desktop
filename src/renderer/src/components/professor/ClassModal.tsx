import { useState } from 'react'
import ProfessorModal from './ProfessorModal'
import { createClass, updateClass } from '../../lib/professorQueries'
import type { ClassSummary } from '../../types/professor'

interface ClassModalProps {
  professorId: string
  initial: ClassSummary | null
  onClose: () => void
  onSaved: (classId: string) => void
}

export default function ClassModal({
  professorId,
  initial,
  onClose,
  onSaved
}: ClassModalProps): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!name.trim() || !code.trim()) {
      setError('Enter both a class name and a short code.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (initial) {
        await updateClass({ classId: initial.id, name, code })
        onSaved(initial.id)
      } else {
        const classId = await createClass({ professorId, name, code })
        onSaved(classId)
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the class.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfessorModal title={initial ? 'Edit class' : 'New class'} onClose={onClose}>
      <p className="auth-sub">
        The code becomes the workspace folder name for students (for example <code>CS101</code>).
      </p>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="form-field">
          <label htmlFor="class-name">Class name</label>
          <input
            id="class-name"
            autoFocus
            value={name}
            placeholder="CS101 - Intro to Programming"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="class-code">Code</label>
          <input
            id="class-code"
            value={code}
            placeholder="CS101"
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save class' : 'Create class'}
          </button>
        </div>
      </form>
    </ProfessorModal>
  )
}
