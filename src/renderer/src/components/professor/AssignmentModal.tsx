import { useState } from 'react'
import ProfessorModal from './ProfessorModal'
import { defaultAssignmentFileName } from '../../lib/assignments'
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

/** ISO timestamp -> the value shape a datetime-local input expects. */
function toDateTimeLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
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
  const [fileName, setFileName] = useState(initial?.fileName ?? '')
  const [starterCode, setStarterCode] = useState(initial?.starterCode ?? '')
  const [published, setPublished] = useState(initial?.published ?? true)
  const [autoTestEnabled, setAutoTestEnabled] = useState(initial?.autoTestEnabled ?? true)
  const [publishAt, setPublishAt] = useState(toDateTimeLocal(initial?.publishAt ?? null))
  const [dueAt, setDueAt] = useState(toDateTimeLocal(initial?.dueAt ?? null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedFileName = fileName.trim() || defaultAssignmentFileName(title, language)

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
          fileName: resolvedFileName,
          starterCode,
          published,
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          autoTestEnabled
        })
        onSaved(initial.id)
      } else {
        const assignmentId = await createAssignment({
          classId,
          title,
          description,
          language,
          fileName: resolvedFileName,
          starterCode,
          published,
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          autoTestEnabled
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
          <label htmlFor="assignment-file">Workspace file name</label>
          <input
            id="assignment-file"
            value={fileName}
            placeholder={defaultAssignmentFileName(title, language)}
            spellCheck={false}
            onChange={(event) => setFileName(event.target.value)}
          />
          <span className="form-hint">
            Students open this file inside the class folder. Blank uses the title above.
          </span>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="assignment-publish-at">Publish at (optional)</label>
            <input
              id="assignment-publish-at"
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
            />
            <span className="form-hint">
              Leave blank to publish immediately. A future time keeps the assignment hidden until
              then.
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="assignment-due">Due date (optional)</label>
            <input
              id="assignment-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
        </div>
        <div className="form-field">
          <label className="checkbox-field" htmlFor="assignment-published">
            <input
              id="assignment-published"
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            <span>Published to students</span>
          </label>
          <span className="form-hint">
            Drafts stay hidden from students. Published assignments also respect the publish time
            above.
          </span>
        </div>
        <div className="form-field">
          <label className="checkbox-field" htmlFor="assignment-auto-tests">
            <input
              id="assignment-auto-tests"
              type="checkbox"
              checked={autoTestEnabled}
              onChange={(event) => setAutoTestEnabled(event.target.checked)}
            />
            <span>Enable Judge0 auto tests</span>
          </label>
          <span className="form-hint">
            Students get a Test cases tab and a Run tests button when this is on.
          </span>
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
