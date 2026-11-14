import { useState } from 'react'
import ProfessorModal from './ProfessorModal'
import { createAssignment, updateAssignment } from '../../lib/professorQueries'
import type { AssignmentSummary } from '../../types/professor'

const LANGUAGES = [
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'javascript',
  'typescript',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'plaintext'
]

interface AssignmentModalProps {
  classId: string
  initial: AssignmentSummary | null
  onClose: () => void
  onSaved: (assignmentId: string) => void
}

export default function AssignmentModal({
  classId,
  initial,
  onClose,
  onSaved
}: AssignmentModalProps): React.ReactElement {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [language, setLanguage] = useState(initial?.language ?? 'python')
  const [starterCode, setStarterCode] = useState(initial?.starterCode ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!title.trim()) {
      setError('Enter an assignment title.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (initial) {
        await updateAssignment({
          assignmentId: initial.id,
          title,
          description,
          language,
          starterCode
        })
        onSaved(initial.id)
      } else {
        const assignmentId = await createAssignment({
          classId,
          title,
          description,
          language,
          starterCode
        })
        onSaved(assignmentId)
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the assignment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfessorModal title={initial ? 'Edit assignment' : 'New assignment'} onClose={onClose} wide>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="form-field">
          <label htmlFor="assignment-title">Title</label>
          <input
            id="assignment-title"
            autoFocus
            value={title}
            placeholder="Fibonacci"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="assignment-language">Language</label>
          <select
            id="assignment-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="assignment-description">Description</label>
          <textarea
            id="assignment-description"
            rows={3}
            value={description}
            placeholder="Read n and print the nth Fibonacci number…"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="assignment-starter">Starter code</label>
          <textarea
            id="assignment-starter"
            className="code-textarea"
            rows={8}
            value={starterCode}
            spellCheck={false}
            placeholder="def fib(n):&#10;    pass"
            onChange={(event) => setStarterCode(event.target.value)}
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save assignment' : 'Create assignment'}
          </button>
        </div>
      </form>
    </ProfessorModal>
  )
}
