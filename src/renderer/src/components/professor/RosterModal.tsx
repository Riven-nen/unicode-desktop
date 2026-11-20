import { useEffect, useState } from 'react'
import { Download, FileUp, Trash2, UserPlus } from 'lucide-react'
import ProfessorModal from './ProfessorModal'
import {
  addStudentToClass,
  addStudentsToClass,
  fetchRoster,
  removeStudentFromClass
} from '../../lib/professorQueries'
import { downloadCsv, parseEmails } from '../../lib/csv'
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
  const [bulkText, setBulkText] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [bulkMissing, setBulkMissing] = useState<string[]>([])

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

  const importBulk = async (): Promise<void> => {
    const emails = parseEmails(bulkText)
    if (emails.length === 0) {
      setBulkError('Paste at least one valid email address or choose a CSV file.')
      return
    }
    setBulkBusy(true)
    setBulkError(null)
    setBulkMessage(null)
    setBulkMissing([])
    try {
      const results = await addStudentsToClass(classId, emails)
      const added = results.filter((item) => item.result === 'added').length
      const already = results.filter((item) => item.result === 'already_enrolled').length
      const missing = results
        .filter((item) => item.result === 'not_found')
        .map((item) => item.email)
      setBulkMessage(`Added ${added}; ${already} already enrolled; ${missing.length} not found.`)
      setBulkMissing(missing)
      setBulkText('')
      await reload()
      onChanged()
    } catch (importError) {
      setBulkError(
        importError instanceof Error ? importError.message : 'Could not import those emails.'
      )
    } finally {
      setBulkBusy(false)
    }
  }

  const exportRoster = (): void => {
    if (!roster) return
    const slug = className
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    downloadCsv(`roster-${slug || 'class'}.csv`, [
      ['Name', 'Email', 'Enrolled at'],
      ...roster.map((student) => [student.name, student.email, student.enrolledAt])
    ])
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

      <div className="roster-bulk">
        <div className="roster-bulk-head">
          <span>Bulk import</span>
          <button className="icon-text-btn" onClick={exportRoster}>
            <Download size={12} /> Export CSV
          </button>
        </div>
        <p className="ics-note">
          Paste emails one per line (or comma-separated), or choose a CSV file. Existing students
          are skipped.
        </p>
        <textarea
          rows={4}
          value={bulkText}
          spellCheck={false}
          placeholder={'student1@university.edu\nstudent2@university.edu'}
          onChange={(event) => setBulkText(event.target.value)}
        />
        <div className="roster-bulk-actions">
          <label className="roster-file">
            <FileUp size={12} /> Choose CSV
            <input
              type="file"
              accept=".csv,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void file
                  .text()
                  .then(setBulkText)
                  .catch(() => setBulkError('Could not read that file.'))
                event.target.value = ''
              }}
            />
          </label>
          <button
            className="btn-secondary"
            onClick={() => void importBulk()}
            disabled={bulkBusy || bulkText.trim().length === 0}
          >
            {bulkBusy ? 'Importing…' : 'Import emails'}
          </button>
        </div>
        {bulkError && <div className="auth-error">{bulkError}</div>}
        {bulkMessage && <div className="auth-info">{bulkMessage}</div>}
        {bulkMissing.length > 0 && <p className="ics-note">Not found: {bulkMissing.join(', ')}</p>}
      </div>

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
