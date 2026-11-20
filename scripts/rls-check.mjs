/**
 * RLS regression checks against the live Supabase project.
 *
 * Uses the seeded demo accounts and the public (anon/publishable) key, so
 * every query is subject to the same policies the app runs under. The
 * service-role key is only used to clean up the test reply.
 *
 * Usage:
 *   npm run test:rls
 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = 'Password123!'
const TEST_BODY = `rls-check-${Date.now()}-student-reply`

if (!URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.')
  process.exit(1)
}
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY (needed to clean up the test reply).')
  process.exit(1)
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
}

const makeClient = async (email) => {
  const client = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`${email}: ${error.message}`)
  return { client, user: data.user }
}

const service = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

let privateSubmissionId = null
let promotedProfileId = null
let presenceStudentId = null
const inviteIds = []

try {
  const professor = await makeClient('professor@unicode.test')
  const student = await makeClient('student3@unicode.test')
  const studentOne = await makeClient('student1@unicode.test')
  const studentTwo = await makeClient('student2@unicode.test')
  const adminUser = await makeClient('admin@unicode.test')

  const { data: klass, error: classError } = await professor.client
    .from('classes')
    .select('id, code')
    .eq('code', 'CS101')
    .maybeSingle()
  if (classError) throw new Error(classError.message)

  const { data: assignment, error: assignmentError } = await professor.client
    .from('assignments')
    .select('id, title')
    .eq('class_id', klass.id)
    .eq('title', 'Fibonacci')
    .maybeSingle()
  if (assignmentError) throw new Error(assignmentError.message)

  const { data: professorSubs, error: professorSubsError } = await professor.client
    .from('submissions')
    .select('id, student_id')
    .eq('assignment_id', assignment.id)
  if (professorSubsError) throw new Error(professorSubsError.message)
  check(
    'Professor sees every class submission',
    professorSubs.length === 3,
    `${professorSubs.length} rows`
  )

  const { data: professorTests, error: professorTestsError } = await professor.client
    .from('test_cases')
    .select('id, is_hidden')
    .eq('assignment_id', assignment.id)
  if (professorTestsError) throw new Error(professorTestsError.message)
  check(
    'Professor sees hidden test cases',
    professorTests.some((test) => test.is_hidden),
    `${professorTests.length} cases`
  )

  const { data: studentSubs, error: studentSubsError } = await student.client
    .from('submissions')
    .select('id, student_id')
    .eq('assignment_id', assignment.id)
  if (studentSubsError) throw new Error(studentSubsError.message)
  check(
    'Student sees only their own submission',
    studentSubs.length === 1 && studentSubs[0].student_id === student.user.id,
    `${studentSubs.length} rows`
  )

  const submissionId = studentSubs[0].id

  const { data: studentTests, error: studentTestsError } = await student.client
    .from('test_cases')
    .select('id, is_hidden')
    .eq('assignment_id', assignment.id)
  if (studentTestsError) throw new Error(studentTestsError.message)
  check(
    'Student never receives hidden test cases',
    studentTests.every((test) => !test.is_hidden),
    `${studentTests.length} visible cases`
  )

  const { data: comments, error: commentsError } = await student.client
    .from('comments')
    .select('id, author_id, parent_id')
    .eq('submission_id', submissionId)
  if (commentsError) throw new Error(commentsError.message)
  const professorComment = comments.find(
    (comment) => comment.parent_id === null && comment.author_id !== student.user.id
  )
  check('Student reads feedback on their submission', comments.length > 0 && !!professorComment)

  if (professorComment) {
    const { error: replyError } = await student.client.from('comments').insert({
      submission_id: submissionId,
      author_id: student.user.id,
      snapshot_id: null,
      anchor_line: null,
      parent_id: professorComment.id,
      body: TEST_BODY
    })
    check('Student can reply inside a thread on their submission', !replyError, replyError?.message)
  }

  const { error: topLevelError } = await student.client.from('comments').insert({
    submission_id: submissionId,
    author_id: student.user.id,
    snapshot_id: null,
    anchor_line: null,
    parent_id: null,
    body: `${TEST_BODY}-top-level`
  })
  check('Student cannot start a top-level comment', Boolean(topLevelError))

  const { data: gradeRows, error: gradeError } = await student.client
    .from('submissions')
    .update({ grade: 99 })
    .eq('id', submissionId)
    .select('id')
  check(
    'Student cannot change a grade',
    Boolean(gradeError) || (gradeRows?.length ?? 0) === 0,
    gradeError?.message
  )

  // Grade release -----------------------------------------------------------
  const privateSubmission = professorSubs.find((row) => row.student_id === studentTwo.user.id)
  if (privateSubmission) {
    privateSubmissionId = privateSubmission.id
    const { data: maskedRows, error: maskedError } = await studentTwo.client
      .from('student_submissions')
      .select('id, grade, grade_released_at')
      .eq('assignment_id', assignment.id)
      .maybeSingle()
    check(
      'Student view hides a private grade',
      !maskedError && maskedRows?.grade === null && maskedRows?.grade_released_at === null,
      maskedError?.message
    )

    const { data: privateGrades, error: privateGradeError } = await professor.client
      .from('submission_grades')
      .select('submission_id, grade')
      .eq('submission_id', privateSubmission.id)
      .maybeSingle()
    check(
      'Professor sees the private grade',
      !privateGradeError && privateGrades?.grade !== null,
      privateGradeError?.message
    )

    const { data: studentPrivateGrades, error: studentPrivateGradeError } = await studentTwo.client
      .from('submission_grades')
      .select('submission_id')
      .eq('submission_id', privateSubmission.id)
    check(
      'Student cannot read the private grade table',
      !studentPrivateGradeError && (studentPrivateGrades?.length ?? 0) === 0,
      studentPrivateGradeError?.message
    )

    const { data: baseSubmission, error: baseSubmissionError } = await studentTwo.client
      .from('submissions')
      .select('id, grade')
      .eq('id', privateSubmission.id)
      .maybeSingle()
    check(
      'Student base submission stores no private grade',
      !baseSubmissionError && baseSubmission?.grade === null,
      baseSubmissionError?.message
    )

    const { error: studentReleaseError } = await studentTwo.client.rpc(
      'set_submission_grade_release',
      { target_submission: privateSubmission.id, released: true }
    )
    check(
      'Student cannot release a grade',
      Boolean(studentReleaseError),
      studentReleaseError?.message
    )

    const { error: professorReleaseError } = await professor.client.rpc(
      'set_submission_grade_release',
      { target_submission: privateSubmission.id, released: true }
    )
    check(
      'Professor can release a saved grade',
      !professorReleaseError,
      professorReleaseError?.message
    )

    const { data: revealedRows, error: revealedError } = await studentTwo.client
      .from('student_submissions')
      .select('id, grade, grade_released_at')
      .eq('assignment_id', assignment.id)
      .maybeSingle()
    check(
      'Released grade becomes visible to the student',
      !revealedError && revealedRows?.grade !== null && Boolean(revealedRows?.grade_released_at),
      revealedError?.message
    )

    await professor.client.rpc('set_submission_grade_release', {
      target_submission: privateSubmission.id,
      released: false
    })
  } else {
    check('Private grade fixture exists', false, 'student2 submission missing')
  }

  // Assignment scheduling ---------------------------------------------------
  const { data: professorScheduled, error: professorScheduledError } = await professor.client
    .from('assignments')
    .select('id')
    .eq('title', 'Recursion Warmup')
  check(
    'Professor sees a scheduled assignment',
    !professorScheduledError && (professorScheduled?.length ?? 0) === 1,
    professorScheduledError?.message
  )

  const { data: studentScheduled, error: studentScheduledError } = await studentTwo.client
    .from('assignments')
    .select('id')
    .eq('title', 'Recursion Warmup')
  check(
    'Student does not see an assignment before its publish time',
    !studentScheduledError && (studentScheduled?.length ?? 0) === 0,
    studentScheduledError?.message
  )

  const { data: replyRows, error: replyReadError } = await professor.client
    .from('comments')
    .select('id, author_id')
    .eq('submission_id', submissionId)
  if (replyReadError) throw new Error(replyReadError.message)
  check(
    'Professor sees the student reply',
    replyRows.some((comment) => comment.author_id === student.user.id)
  )

  const { data: adminProfiles, error: adminProfilesError } = await adminUser.client
    .from('profiles')
    .select('id')
  if (adminProfilesError) throw new Error(adminProfilesError.message)
  const { data: studentProfiles, error: studentProfilesError } = await student.client
    .from('profiles')
    .select('id')
  if (studentProfilesError) throw new Error(studentProfilesError.message)
  check(
    'Admin sees every profile; student sees fewer',
    adminProfiles.length > studentProfiles.length,
    `admin ${adminProfiles.length}, student ${studentProfiles.length}`
  )

  const { data: adminClasses, error: adminClassesError } = await adminUser.client
    .from('classes')
    .select('id')
  if (adminClassesError) throw new Error(adminClassesError.message)
  const { data: studentClasses, error: studentClassesError } = await student.client
    .from('classes')
    .select('id')
  if (studentClassesError) throw new Error(studentClassesError.message)
  check(
    'Admin sees every class; student sees only enrollments',
    adminClasses.length >= 2 && studentClasses.length === 1,
    `admin ${adminClasses.length}, student ${studentClasses.length}`
  )

  const { error: selfRoleError } = await adminUser.client.rpc('admin_set_role', {
    target_profile: adminUser.user.id,
    new_role: 'student'
  })
  check('Admin cannot change their own role', Boolean(selfRoleError), selfRoleError?.message)

  const { error: studentRoleError } = await student.client.rpc('admin_set_role', {
    target_profile: professor.user.id,
    new_role: 'student'
  })
  check('Student cannot change roles', Boolean(studentRoleError), studentRoleError?.message)

  const { error: demoteProfessorError } = await adminUser.client.rpc('admin_set_role', {
    target_profile: professor.user.id,
    new_role: 'student'
  })
  check(
    'Professor with classes cannot be demoted',
    Boolean(demoteProfessorError),
    demoteProfessorError?.message
  )

  // Professor insight views ------------------------------------------------
  const { data: pasteMatches, error: pasteMatchError } = await professor.client.rpc(
    'professor_paste_matches',
    { target_submission: submissionId, min_similarity: 0.45 }
  )
  check(
    'Professor sees cross-student paste similarity',
    !pasteMatchError &&
      Array.isArray(pasteMatches) &&
      pasteMatches.length > 0 &&
      Number(pasteMatches[0].similarity) >= 0.45,
    pasteMatchError?.message
  )

  const { error: studentPasteMatchError } = await studentOne.client.rpc('professor_paste_matches', {
    target_submission: submissionId,
    min_similarity: 0.45
  })
  check(
    'Student cannot run paste similarity',
    Boolean(studentPasteMatchError),
    studentPasteMatchError?.message
  )

  const { data: typingRows, error: typingError } = await professor.client
    .from('code_snapshots')
    .select('typing_intervals')
    .eq('submission_id', submissionId)
    .not('typing_intervals', 'is', null)
    .limit(1)
  check(
    'Professor sees typing intervals',
    !typingError && (typingRows?.[0]?.typing_intervals?.length ?? 0) > 0,
    typingError?.message
  )

  const { error: heartbeatError } = await studentOne.client.rpc('touch_student_presence', {
    current_file: 'fibonacci.py',
    current_status: 'active',
    current_idle_seconds: 0
  })
  check('Student heartbeat is accepted', !heartbeatError, heartbeatError?.message)
  if (!heartbeatError) presenceStudentId = studentOne.user.id

  const { data: professorPresence, error: professorPresenceError } = await professor.client
    .from('student_presence')
    .select('student_id, status, current_file')
    .eq('student_id', studentOne.user.id)
  check(
    'Professor reads their student presence',
    !professorPresenceError && (professorPresence?.length ?? 0) === 1,
    professorPresenceError?.message
  )

  const { data: otherStudentPresence, error: otherPresenceError } = await studentTwo.client
    .from('student_presence')
    .select('student_id')
  check(
    'Student cannot read another student presence',
    !otherPresenceError &&
      (otherStudentPresence ?? []).every((row) => row.student_id === studentTwo.user.id),
    otherPresenceError?.message
  )

  // Professor invites -------------------------------------------------------
  const { data: createdInviteData, error: createInviteError } = await adminUser.client.rpc(
    'admin_create_professor_invite',
    {
      lifespan_hours: 24,
      allowed_uses: 1,
      invite_note: 'RLS check'
    }
  )
  const createdInvite = Array.isArray(createdInviteData) ? createdInviteData[0] : createdInviteData
  if (createdInvite?.id) inviteIds.push(createdInvite.id)
  check(
    'Admin can generate a professor invite',
    !createInviteError && Boolean(createdInvite?.code?.startsWith('PROF-')),
    createInviteError?.message
  )

  const { error: studentCreateInviteError } = await student.client.rpc(
    'admin_create_professor_invite',
    { lifespan_hours: 24, allowed_uses: 1, invite_note: null }
  )
  check(
    'Student cannot generate professor invites',
    Boolean(studentCreateInviteError),
    studentCreateInviteError?.message
  )

  const { data: studentInviteRows, error: studentInviteReadError } = await student.client
    .from('professor_invites')
    .select('id')
  check(
    'Student cannot read professor invites',
    !studentInviteReadError && (studentInviteRows?.length ?? 0) === 0,
    studentInviteReadError?.message
  )

  const { error: studentRevokeError } = await student.client.rpc('admin_revoke_professor_invite', {
    target_invite: createdInvite.id
  })
  check(
    'Student cannot revoke professor invites',
    Boolean(studentRevokeError),
    studentRevokeError?.message
  )

  const { error: badInviteError } = await student.client.rpc('redeem_professor_invite', {
    invite_code: 'PROF-NOPE-NOPE'
  })
  check('Invalid professor invite is rejected', Boolean(badInviteError), badInviteError?.message)

  const { error: redeemError } = await student.client.rpc('redeem_professor_invite', {
    invite_code: createdInvite.code.toLowerCase()
  })
  check('Student redeems a professor invite', !redeemError, redeemError?.message)
  if (!redeemError) promotedProfileId = student.user.id

  const { data: promotedProfile, error: promotedProfileError } = await student.client
    .from('profiles')
    .select('role')
    .eq('id', student.user.id)
    .maybeSingle()
  check(
    'Redeemed account becomes a professor',
    !promotedProfileError && promotedProfile?.role === 'professor',
    promotedProfileError?.message
  )

  const { error: usageLimitError } = await studentOne.client.rpc('redeem_professor_invite', {
    invite_code: createdInvite.code
  })
  check(
    'Invite usage limit blocks another account',
    Boolean(usageLimitError),
    usageLimitError?.message
  )

  const { error: revokeInviteError } = await adminUser.client.rpc('admin_revoke_professor_invite', {
    target_invite: createdInvite.id
  })
  check('Admin can revoke a professor invite', !revokeInviteError, revokeInviteError?.message)

  const { error: revokedRedeemError } = await studentOne.client.rpc('redeem_professor_invite', {
    invite_code: createdInvite.code
  })
  check('Revoked invite is rejected', Boolean(revokedRedeemError), revokedRedeemError?.message)

  const { data: expiringInviteData } = await adminUser.client.rpc('admin_create_professor_invite', {
    lifespan_hours: 24,
    allowed_uses: 5,
    invite_note: 'RLS expiry check'
  })
  const expiringInvite = Array.isArray(expiringInviteData)
    ? expiringInviteData[0]
    : expiringInviteData
  if (expiringInvite?.id) inviteIds.push(expiringInvite.id)
  if (expiringInvite?.id) {
    await service
      .from('professor_invites')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', expiringInvite.id)
  }
  const { error: expiredInviteError } = await studentOne.client.rpc('redeem_professor_invite', {
    invite_code: expiringInvite.code
  })
  check(
    'Expired professor invite is rejected',
    Boolean(expiredInviteError),
    expiredInviteError?.message
  )
} catch (error) {
  check('RLS checks completed', false, error instanceof Error ? error.message : String(error))
} finally {
  const { error: cleanupError } = await service.from('comments').delete().eq('body', TEST_BODY)
  if (cleanupError) console.warn(`Cleanup failed: ${cleanupError.message}`)
  if (privateSubmissionId) {
    const { error: resetGradeError } = await service
      .from('submissions')
      .update({ grade_released: false, grade_released_at: null })
      .eq('id', privateSubmissionId)
    if (resetGradeError) console.warn(`Grade reset failed: ${resetGradeError.message}`)
  }
  if (inviteIds.length > 0) {
    const { error: inviteCleanupError } = await service
      .from('professor_invites')
      .delete()
      .in('id', inviteIds)
    if (inviteCleanupError) console.warn(`Invite cleanup failed: ${inviteCleanupError.message}`)
  }
  if (promotedProfileId) {
    const { error: roleResetError } = await service
      .from('profiles')
      .update({ role: 'student' })
      .eq('id', promotedProfileId)
    if (roleResetError) console.warn(`Role reset failed: ${roleResetError.message}`)
  }
  if (presenceStudentId) {
    const { error: presenceCleanupError } = await service
      .from('student_presence')
      .delete()
      .eq('student_id', presenceStudentId)
    if (presenceCleanupError) {
      console.warn(`Presence cleanup failed: ${presenceCleanupError.message}`)
    }
  }
}

for (const result of results) {
  console.log(
    `${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`
  )
}
const failures = results.filter((result) => !result.ok)
console.log(`\n${results.length - failures.length}/${results.length} checks passed`)
process.exit(failures.length === 0 ? 0 : 1)
