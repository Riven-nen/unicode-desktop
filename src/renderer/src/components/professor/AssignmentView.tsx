import { useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ListChecks,
  Pencil,
  RefreshCw,
  Send,
  Trash2
} from 'lucide-react'
import SubmissionTable from './SubmissionTable'
import AssignmentAnalytics from './AssignmentAnalytics'
import SimilarityPanel from './SimilarityPanel'
import { fileNameForAssignment } from '../../lib/assignments'
import { recomputeIcsForAssignment, releaseAssignmentGrades } from '../../lib/professorQueries'
import type { AssignmentSummary, SubmissionSummary } from '../../types/professor'

interface AssignmentViewProps {
  assignment: AssignmentSummary
  submissions: SubmissionSummary[]
  /** Enrolled students in the assignment's class. */
  rosterCount: number
  loading: boolean
  error: string | null
  onBack: () => void
  onEdit: () => void
  onManageTests: () => void
  onOpenSubmission: (submissionId: string) => void
  onRefresh: () => void
  onArchive: () => void
  onDelete: () => void
  archiveBusy: boolean
}

const formatDue = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function AssignmentView({
  assignment,
  submissions,
  rosterCount,
  loading,
  error,
  onBack,
  onEdit,
  onManageTests,
  onOpenSubmission,
  onRefresh,
  onArchive,
  onDelete,
  archiveBusy
}: AssignmentViewProps): React.ReactElement {
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeError, setRecomputeError] = useState<string | null>(null)
  const [recomputeMessage, setRecomputeMessage] = useState<string | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null)
  // Captured once per open so the scheduled label is stable during renders.
  const [now] = useState(() => Date.now())

  const unreleasedGrades = submissions.filter(
    (submission) => submission.grade !== null && !submission.gradeReleased
  ).length

  const releaseAll = async (): Promise<void> => {
    setReleasing(true)
    setReleaseError(null)
    setReleaseMessage(null)
    try {
      const count = await releaseAssignmentGrades(assignment.id)
      setReleaseMessage(
        count === 0
          ? 'No saved grades were waiting to be released.'
          : count === 1
            ? 'Released 1 grade to its student.'
            : `Released ${count} grades to students.`
      )
      onRefresh()
    } catch (releaseFailure) {
      setReleaseError(
        releaseFailure instanceof Error ? releaseFailure.message : 'Could not release the grades.'
      )
    } finally {
      setReleasing(false)
    }
  }

  const recomputeAll = async (): Promise<void> => {
    setRecomputing(true)
    setRecomputeError(null)
    setRecomputeMessage(null)
    try {
      const count = await recomputeIcsForAssignment(assignment.id)
      setRecomputeMessage(count === 1 ? 'Rescored 1 submission.' : `Rescored ${count} submissions.`)
      onRefresh()
    } catch (scoreError) {
      setRecomputeError(
        scoreError instanceof Error ? scoreError.message : 'Could not recompute scores.'
      )
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div className="assignment-view">
      <header className="assignment-view-head">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={14} /> Class overview
        </button>
        <div className="assignment-view-copy">
          <span className="class-hero-code">{assignment.language ?? 'plaintext'}</span>
          <h1>{assignment.title}</h1>
          <p className="professor-sub">
            {fileNameForAssignment(assignment)} · {assignment.testCaseCount}{' '}
            {assignment.testCaseCount === 1 ? 'test' : 'tests'}
            {assignment.hiddenCaseCount > 0
              ? ` · ${assignment.hiddenCaseCount} hidden from students`
              : ''}
            {!assignment.published
              ? ' · Draft'
              : assignment.publishAt && new Date(assignment.publishAt).getTime() > now
                ? ` · Scheduled ${formatDue(assignment.publishAt)}`
                : ''}
            {assignment.archivedAt ? ' · Archived' : ''}
            {assignment.dueAt ? ` · Due ${formatDue(assignment.dueAt)}` : ''}
            {assignment.autoTestEnabled ? ' · Auto tests on' : ' · Auto tests off'}
          </p>
        </div>
        <div className="assignment-view-actions">
          <button
            className="btn-secondary"
            onClick={() => void releaseAll()}
            disabled={releasing || unreleasedGrades === 0}
            title={
              unreleasedGrades === 0
                ? 'Save a grade first'
                : `Release ${unreleasedGrades} saved grade${unreleasedGrades === 1 ? '' : 's'}`
            }
          >
            <Send size={13} />
            {releasing
              ? 'Releasing…'
              : `Release grades${unreleasedGrades > 0 ? ` (${unreleasedGrades})` : ''}`}
          </button>
          <button
            className="btn-secondary"
            onClick={() => void recomputeAll()}
            disabled={recomputing}
          >
            <RefreshCw size={13} /> {recomputing ? 'Recomputing…' : 'Recompute ICS'}
          </button>
          <button className="btn-secondary" onClick={onEdit}>
            <Pencil size={13} /> Edit assignment
          </button>
          <button className="btn-secondary" onClick={onManageTests}>
            <ListChecks size={13} /> Test cases
          </button>
          <button className="btn-secondary" onClick={onArchive} disabled={archiveBusy}>
            {assignment.archivedAt ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            {assignment.archivedAt ? 'Restore' : 'Archive'}
          </button>
          <button className="btn-danger" onClick={onDelete} disabled={archiveBusy}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </header>

      {recomputeError && <div className="professor-error">{recomputeError}</div>}
      {releaseError && <div className="professor-error">{releaseError}</div>}
      {releaseMessage && <div className="auth-info">{releaseMessage}</div>}
      {recomputeMessage && <div className="auth-info">{recomputeMessage}</div>}

      {assignment.description && (
        <p className="assignment-view-description">{assignment.description}</p>
      )}

      {assignment.starterCode && (
        <details className="assignment-starter">
          <summary>Starter code</summary>
          <pre>{assignment.starterCode}</pre>
        </details>
      )}

      <AssignmentAnalytics
        submissions={submissions}
        dueAt={assignment.dueAt}
        rosterCount={rosterCount}
        loading={loading}
      />

      <SimilarityPanel
        key={assignment.id}
        assignmentId={assignment.id}
        onOpenSubmission={onOpenSubmission}
      />

      <SubmissionTable
        submissions={submissions}
        loading={loading}
        error={error}
        onSelect={onOpenSubmission}
      />
    </div>
  )
}
