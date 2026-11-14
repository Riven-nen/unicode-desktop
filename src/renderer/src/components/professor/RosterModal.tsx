import { useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import ProfessorModal from './ProfessorModal'
import { addStudentToClass, fetchRoster, removeStudentFromClass } from '../../lib/professorQueries'
import type { RosterStudent } from '../../types/professor'

interface RosterModalProps {
  classId: string
  className: string
  onClose: () => void
  onChanged: () => void
}

export default function RosterModal({
  classId,
  className,
  onClose,
  onChanged
}: RosterModalProps): React.ReactElement {
  const [roster, setRoster] = useState<RosterStudent[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchRoster(classId)
      .then((rows) => {
        if (!cancelled) setRoster(rows)
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setRoster([])
          setLoadError(
            fetchError instanceof Error ? fetchError.message : 'Could not load the roster.'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [classId])

  const reload = async (): Promise<void> => {
    try {
      setRoster(await fetchRoster(classId))
      setLoadError(null)
    } catch (fetchError) {
      setLoadError(fetchError instanceof Error ? fetchError.message : 'Could not load the roster.')
    }
  }

  const add = async (): Promise<void> => {
    if (!email.trim()) {
      setError('Enter the student email address.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addStudentToClass(classId, email)
      setEmail('')
      await reload()
      onChanged()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add the student.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (student: RosterStudent): Promise<void> => {
    if (
      !window.confirm(
        `Remove ${student.name} from ${className}? Their submissions and history are kept.`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await removeStudentFromClass(classId, student.studentId)
      await reload()
      onChanged()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the student.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfessorModal title={`Students · ${className}`} onClose={onClose} wide>
      <p className="auth-sub">
        Enroll a student by the email on their Unicode Lab account. The class appears in their
        workspace automatically.
      </p>

      <form
        className="roster-add"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <input
          autoFocus
          type="email"
          placeholder="student@university.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? (
            'Adding…'
          ) : (
            <>
              <UserPlus size={13} /> Add student
            </>
          )}
        </button>
      </form>

      {error && <div className="auth-error">{error}</div>}
      {loadError && <div className="auth-error">{loadError}</div>}
      {roster === null && <div className="professor-empty">Loading roster…</div>}

      {roster !== null && roster.length === 0 && (
        <div className="professor-empty">No students enrolled yet.</div>
      )}

      <div className="roster-list">
        {roster?.map((student) => (
          <div key={student.studentId} className="roster-row">
            <div className="roster-who">
              <span className="roster-name">{student.name}</span>
              <span className="roster-email">{student.email}</span>
            </div>
            <button
              className="icon-danger"
              title={`Remove ${student.name}`}
              onClick={() => void remove(student)}
              disabled={busy}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </ProfessorModal>
  )
}
