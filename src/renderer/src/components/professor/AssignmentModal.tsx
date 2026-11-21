import { useState } from 'react'
import ProfessorModal from './ProfessorModal'
import { defaultAssignmentFileName } from '../../lib/assignments'
import { createAssignment, updateAssignment } from '../../lib/professorQueries'
import type { AssessmentKind, AssessmentTimingMode } from '../../types/assessment'
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
  'html',
  'css',
  'plaintext'
]

interface AssignmentModalProps {
  classId: string
  initial: AssignmentSummary | null
  /** Which class tab opened the modal; new seatworks start timed. */
  defaultKind?: AssessmentKind
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
  defaultKind = 'assignment',
  onClose,
  onSaved
}: AssignmentModalProps): React.ReactElement {
  const startingKind = initial?.kind ?? defaultKind
  const [kind, setKind] = useState<AssessmentKind>(startingKind)
  const [timingMode, setTimingMode] = useState<AssessmentTimingMode>(
    initial?.timingMode ?? (startingKind === 'seatwork' ? 'live_window' : 'none')
  )
  const [durationMinutes, setDurationMinutes] = useState(
    initial?.durationMinutes !== null && initial?.durationMinutes !== undefined
      ? String(initial.durationMinutes)
      : startingKind === 'seatwork'
        ? '60'
        : ''
  )
  const [opensAt, setOpensAt] = useState(toDateTimeLocal(initial?.opensAt ?? null))
  const [closesAt, setClosesAt] = useState(toDateTimeLocal(initial?.closesAt ?? null))
  const [autoSubmit, setAutoSubmit] = useState(initial?.autoSubmit ?? true)
  const [showTimer, setShowTimer] = useState(initial?.showTimer ?? true)
  const [allowedTabOuts, setAllowedTabOuts] = useState(String(initial?.allowedTabOuts ?? 1))
  const [fullscreenRequired, setFullscreenRequired] = useState(initial?.fullscreenRequired ?? true)
  const [blockPaste, setBlockPaste] = useState(initial?.blockPaste ?? true)
  const [runOnlyTerminal, setRunOnlyTerminal] = useState(initial?.runOnlyTerminal ?? true)
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
  const timed = timingMode !== 'none'
  const autoTestsSupported = language !== 'html' && language !== 'css'

  const changeLanguage = (next: string): void => {
    setLanguage(next)
    if (next === 'html' || next === 'css') setAutoTestEnabled(false)
  }

  const changeKind = (next: AssessmentKind): void => {
    setKind(next)
    if (next === 'seatwork') {
      if (timingMode === 'none') setTimingMode('live_window')
      if (!durationMinutes.trim()) setDurationMinutes('60')
    }
  }

  const submit = async (): Promise<void> => {
    if (!title.trim()) {
      setError('Enter an assignment title.')
      return
    }
    if (kind === 'seatwork' && timingMode === 'none') {
      setError('Seatworks are in-person timed work. Choose a timing mode.')
      return
    }

    const parsedDuration = Number(durationMinutes)
    if (timed && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
      setError('Enter a time limit in minutes.')
      return
    }
    if (timingMode === 'live_window' && !opensAt) {
      setError('Live seatworks need an opening time so every student shares the same clock.')
      return
    }
    if (opensAt && closesAt && new Date(closesAt).getTime() <= new Date(opensAt).getTime()) {
      setError('The closing time must be after the opening time.')
      return
    }
    const parsedTabOuts = Number(allowedTabOuts)
    if (
      kind === 'seatwork' &&
      (!Number.isInteger(parsedTabOuts) || parsedTabOuts < 0 || parsedTabOuts > 10)
    ) {
      setError('Allowed interruptions must be a whole number from 0 to 10.')
      return
    }

    const timingPayload = {
      kind,
      timingMode,
      durationMinutes: timed ? Math.round(parsedDuration) : null,
      opensAt: timed && opensAt ? new Date(opensAt).toISOString() : null,
      closesAt: timed && closesAt ? new Date(closesAt).toISOString() : null,
      autoSubmit: timed ? autoSubmit : false,
      showTimer: timed ? showTimer : false,
      allowedTabOuts: kind === 'seatwork' ? parsedTabOuts : 1,
      fullscreenRequired: kind === 'seatwork' ? fullscreenRequired : false,
      blockPaste: kind === 'seatwork' ? blockPaste : false,
      runOnlyTerminal: kind === 'seatwork' ? runOnlyTerminal : false
    }

    setBusy(true)
    setError(null)
    try {
      if (initial) {
        await updateAssignment({
          assignmentId: initial.id,
          ...timingPayload,
          title,
          description,
          language,
          fileName: resolvedFileName,
          starterCode,
          published,
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          autoTestEnabled: autoTestsSupported ? autoTestEnabled : false
        })
        onSaved(initial.id)
      } else {
        const assignmentId = await createAssignment({
          classId,
          ...timingPayload,
          title,
          description,
          language,
          fileName: resolvedFileName,
          starterCode,
          published,
          publishAt: publishAt ? new Date(publishAt).toISOString() : null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          autoTestEnabled: autoTestsSupported ? autoTestEnabled : false
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
    <ProfessorModal
      title={
        initial
          ? `Edit ${initial.kind === 'seatwork' ? 'seatwork' : 'assignment'}`
          : kind === 'seatwork'
            ? 'New seatwork'
            : 'New assignment'
      }
      onClose={onClose}
      wide
    >
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
            onChange={(event) => changeLanguage(event.target.value)}
          >
            {LANGUAGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="assignment-kind">Type</label>
            <select
              id="assignment-kind"
              value={kind}
              onChange={(event) => changeKind(event.target.value as AssessmentKind)}
            >
              <option value="assignment">Assignment (take-home)</option>
              <option value="seatwork">Seatwork (in-person)</option>
            </select>
            <span className="form-hint">
              Assignments are listed in the take-home tab; seatworks are timed in-person work.
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="assignment-timing">Timing</label>
            <select
              id="assignment-timing"
              value={timingMode}
              onChange={(event) => setTimingMode(event.target.value as AssessmentTimingMode)}
            >
              {kind === 'assignment' && <option value="none">No timer</option>}
              <option value="duration">Per-student timer</option>
              <option value="live_window">Shared live window</option>
            </select>
            <span className="form-hint">
              {timingMode === 'none'
                ? 'Students work without a deadline.'
                : timingMode === 'live_window'
                  ? 'Every student’s deadline is opening time + duration.'
                  : 'The clock starts when each student opens the work.'}
            </span>
          </div>
        </div>

        {timed && (
          <>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="assignment-duration">Time limit (minutes)</label>
                <input
                  id="assignment-duration"
                  type="number"
                  min={1}
                  step={1}
                  value={durationMinutes}
                  placeholder="60"
                  onChange={(event) => setDurationMinutes(event.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="assignment-opens">
                  {timingMode === 'live_window' ? 'Opens at' : 'Available from (optional)'}
                </label>
                <input
                  id="assignment-opens"
                  type="datetime-local"
                  value={opensAt}
                  onChange={(event) => setOpensAt(event.target.value)}
                />
                <span className="form-hint">
                  {timingMode === 'live_window'
                    ? 'Required. The shared clock starts at this time.'
                    : 'Leave blank to let students start as soon as it is published.'}
                </span>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="assignment-closes">Hard cut-off (optional)</label>
              <input
                id="assignment-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
              />
              <span className="form-hint">
                Closes the assessment for everyone, even if a student still has time left.
              </span>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="checkbox-field" htmlFor="assignment-auto-submit">
                  <input
                    id="assignment-auto-submit"
                    type="checkbox"
                    checked={autoSubmit}
                    onChange={(event) => setAutoSubmit(event.target.checked)}
                  />
                  <span>Auto-submit at the limit</span>
                </label>
                <span className="form-hint">
                  Sends the latest saved draft when the server deadline passes.
                </span>
              </div>
              <div className="form-field">
                <label className="checkbox-field" htmlFor="assignment-show-timer">
                  <input
                    id="assignment-show-timer"
                    type="checkbox"
                    checked={showTimer}
                    onChange={(event) => setShowTimer(event.target.checked)}
                  />
                  <span>Show the countdown to students</span>
                </label>
              </div>
            </div>
          </>
        )}

        {kind === 'seatwork' && (
          <>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="assignment-tab-outs">Allowed interruptions</label>
                <input
                  id="assignment-tab-outs"
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={allowedTabOuts}
                  onChange={(event) => setAllowedTabOuts(event.target.value)}
                />
                <span className="form-hint">
                  0 submits on the first tab-out. 1 gives one warning, then submits on the next.
                </span>
              </div>
              <div className="form-field">
                <label className="checkbox-field" htmlFor="assignment-fullscreen">
                  <input
                    id="assignment-fullscreen"
                    type="checkbox"
                    checked={fullscreenRequired}
                    onChange={(event) => setFullscreenRequired(event.target.checked)}
                  />
                  <span>Require fullscreen</span>
                </label>
                <span className="form-hint">Exiting fullscreen counts as an interruption.</span>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="checkbox-field" htmlFor="assignment-block-paste">
                  <input
                    id="assignment-block-paste"
                    type="checkbox"
                    checked={blockPaste}
                    onChange={(event) => setBlockPaste(event.target.checked)}
                  />
                  <span>Block paste and drag-drop</span>
                </label>
                <span className="form-hint">Blocked attempts are logged in the monitor.</span>
              </div>
              <div className="form-field">
                <label className="checkbox-field" htmlFor="assignment-run-only">
                  <input
                    id="assignment-run-only"
                    type="checkbox"
                    checked={runOnlyTerminal}
                    onChange={(event) => setRunOnlyTerminal(event.target.checked)}
                  />
                  <span>Run-only terminal</span>
                </label>
                <span className="form-hint">
                  Shell input is disabled; Run file remains available.
                </span>
              </div>
            </div>
          </>
        )}

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
            Students open this file inside the class folder. Use a project path such as
            portfolio/index.html for a multi-file project. Blank uses the title above.
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
              checked={autoTestsSupported && autoTestEnabled}
              disabled={!autoTestsSupported}
              onChange={(event) => setAutoTestEnabled(event.target.checked)}
            />
            <span>Enable Judge0 auto tests</span>
          </label>
          <span className="form-hint">
            {autoTestsSupported
              ? 'Students get a Test cases tab and a Run tests button when this is on.'
              : 'HTML and CSS use the local live preview instead of Judge0 tests.'}
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
