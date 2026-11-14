import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import ProfessorModal from './ProfessorModal'
import {
  createTestCase,
  deleteTestCase,
  fetchTestCases,
  setTestCaseHidden
} from '../../lib/professorQueries'
import type { TestCaseEntry } from '../../types/professor'

interface TestCaseModalProps {
  assignmentId: string
  assignmentTitle: string
  onClose: () => void
  onChanged: () => void
}

const preview = (value: string | null): string => {
  if (!value) return '—'
  const oneLine = value.replace(/\n/g, ' ↵ ')
  return oneLine.length > 90 ? `${oneLine.slice(0, 90)}…` : oneLine
}

export default function TestCaseModal({
  assignmentId,
  assignmentTitle,
  onClose,
  onChanged
}: TestCaseModalProps): React.ReactElement {
  const [tests, setTests] = useState<TestCaseEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stdin, setStdin] = useState('')
  const [expected, setExpected] = useState('')
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchTestCases(assignmentId)
      .then((rows) => {
        if (!cancelled) setTests(rows)
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setTests([])
          setLoadError(
            fetchError instanceof Error ? fetchError.message : 'Could not load the test cases.'
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [assignmentId])

  const reload = async (): Promise<void> => {
    try {
      setTests(await fetchTestCases(assignmentId))
      setLoadError(null)
    } catch (fetchError) {
      setLoadError(
        fetchError instanceof Error ? fetchError.message : 'Could not load the test cases.'
      )
    }
  }

  const nextOrdinal =
    tests && tests.length > 0 ? Math.max(...tests.map((test) => test.ordinal)) + 1 : 0

  const add = async (): Promise<void> => {
    if (!expected.trim()) {
      setError('Enter the expected output for this case.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createTestCase({
        assignmentId,
        stdin,
        expectedStdout: expected,
        hidden,
        ordinal: nextOrdinal
      })
      setStdin('')
      setExpected('')
      setHidden(false)
      await reload()
      onChanged()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not add the test case.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (test: TestCaseEntry): Promise<void> => {
    if (!window.confirm(`Delete case ${test.ordinal + 1}?`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteTestCase(test.id)
      await reload()
      onChanged()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the test case.'
      )
    } finally {
      setBusy(false)
    }
  }

  const toggleHidden = async (test: TestCaseEntry): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await setTestCaseHidden(test.id, !test.isHidden)
      await reload()
      onChanged()
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : 'Could not update the test case.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfessorModal title={`Test cases · ${assignmentTitle}`} onClose={onClose} wide>
      <p className="auth-sub">
        Hidden cases are visible only to professors. Students see visible cases for their
        assignments.
      </p>

      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="test-stdin">Input (stdin)</label>
            <textarea
              id="test-stdin"
              className="code-textarea"
              rows={3}
              value={stdin}
              spellCheck={false}
              placeholder="10"
              onChange={(event) => setStdin(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="test-expected">Expected output</label>
            <textarea
              id="test-expected"
              className="code-textarea"
              rows={3}
              value={expected}
              spellCheck={false}
              placeholder="55"
              onChange={(event) => setExpected(event.target.value)}
            />
          </div>
        </div>
        <label className="form-check">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(event) => setHidden(event.target.checked)}
          />
          Hidden from students
        </label>
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button type="submit" className="btn-primary" disabled={busy}>
            <Plus size={13} /> {busy ? 'Saving…' : 'Add test case'}
          </button>
        </div>
      </form>

      {loadError && <div className="auth-error">{loadError}</div>}
      {tests === null && <div className="professor-empty">Loading test cases…</div>}
      {tests !== null && tests.length === 0 && (
        <div className="professor-empty">No test cases yet.</div>
      )}

      <div className="test-manage-list">
        {tests?.map((test) => (
          <div key={test.id} className="test-manage-row">
            <div className="test-manage-info">
              <div className="test-manage-head">
                <span>Case {test.ordinal + 1}</span>
                {test.isHidden && <span className="mini-badge">hidden</span>}
              </div>
              <div className="test-manage-preview">
                <span>in: {preview(test.stdin)}</span>
                <span>out: {preview(test.expectedStdout)}</span>
              </div>
            </div>
            <label className="form-check">
              <input
                type="checkbox"
                checked={test.isHidden}
                disabled={busy}
                onChange={() => void toggleHidden(test)}
              />
              Hidden
            </label>
            <button
              className="icon-danger"
              title={`Delete case ${test.ordinal + 1}`}
              disabled={busy}
              onClick={() => void remove(test)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </ProfessorModal>
  )
}
