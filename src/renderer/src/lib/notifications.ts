/**
 * Lightweight, device-local "seen" state for student notifications. Nothing
 * is written to Supabase: the dashboard marks feedback and class visits on
 * this machine and derives unread counts from timestamps.
 */

const PREFIX = 'unicode-lab.seen'

function storageKey(kind: 'feedback' | 'class' | 'grade', id: string): string {
  return `${PREFIX}.${kind}.${id}`
}

function readTimestamp(key: string): number {
  try {
    const raw = window.localStorage.getItem(key)
    const value = raw ? Number(raw) : 0
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function writeTimestamp(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Private mode / disabled storage: badges simply stay unread.
  }
}

/** When the student last opened the feedback panel. */
export function feedbackSeenAt(userId: string): number {
  return readTimestamp(storageKey('feedback', userId))
}

export function markFeedbackSeen(userId: string, at = Date.now()): void {
  writeTimestamp(storageKey('feedback', userId), at)
}

/** When the student last acknowledged a released grade. */
export function gradesSeenAt(userId: string): number {
  return readTimestamp(storageKey('grade', userId))
}

export function markGradesSeen(userId: string, at = Date.now()): void {
  writeTimestamp(storageKey('grade', userId), at)
}

/** When the student last opened a class's detail page. */
export function classSeenAt(classId: string): number {
  return readTimestamp(storageKey('class', classId))
}

export function markClassSeen(classId: string, at = Date.now()): void {
  writeTimestamp(storageKey('class', classId), at)
}

/** Professor's last view of student replies for one class. */
function replyKey(professorId: string, classId: string): string {
  return `${PREFIX}.replies.${professorId}.${classId}`
}

export function repliesSeenAt(professorId: string, classId: string): number {
  return readTimestamp(replyKey(professorId, classId))
}

export function markRepliesSeen(professorId: string, classId: string, at = Date.now()): void {
  writeTimestamp(replyKey(professorId, classId), at)
}

/** Professor's last view of new submissions for one class. */
function submissionKey(professorId: string, classId: string): string {
  return `${PREFIX}.submissions.${professorId}.${classId}`
}

export function submissionsSeenAt(professorId: string, classId: string): number {
  return readTimestamp(submissionKey(professorId, classId))
}

export function markSubmissionsSeen(professorId: string, classId: string, at = Date.now()): void {
  writeTimestamp(submissionKey(professorId, classId), at)
}

/** Items created after `seenAt`. Invalid timestamps never count as new. */
export function countNewer(items: Array<{ createdAt: string }>, seenAt: number): number {
  if (!Number.isFinite(seenAt) || seenAt <= 0) return items.length
  let count = 0
  for (const item of items) {
    const created = Date.parse(item.createdAt)
    if (Number.isFinite(created) && created > seenAt) count += 1
  }
  return count
}
