/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Unicode Lab — demo seed
 * ============================================================================ * Creates the test professor, three students, two classes, assignments, test
 * cases, submissions with snapshot timelines + paste events, ICS scores, and
 * professor comments.
 *
 * SQL cannot create auth users directly (or read environment variables), so
 * this seed uses the Supabase admin API with the service-role key. It is
 * idempotent: every row has a deterministic id and is upserted, so re-running
 * updates the same rows instead of duplicating them.
 *
 * IMPORTANT
 *   - Run the Step 2 migration first (grade / is_hidden / parent_id).
 *   - The service-role key is read from the environment and never written to
 *     disk or printed. Never commit it.
 *
 * Usage (PowerShell, from the repo root):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key from Project Settings > API>"
 *   node scripts/seed.mjs
 *
 * SUPABASE_URL defaults to the project above; override it with a shell
 * variable when seeding a different project.
 *
 * The service-role key bypasses RLS, which is required to create auth users
 * and to promote the professor profile.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ythiuchtlbfnvzcvgioa.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set it in the shell before running this script (see the header comment).'
  )
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const PASSWORD = 'Password123!'

const PROFESSOR = { email: 'professor@unicode.test', name: 'Professor Demo' }
const ADMIN = { email: 'admin@unicode.test', name: 'Admin Demo' }
const STUDENTS = [
  { key: 's1', email: 'student1@unicode.test', name: 'Student One' },
  { key: 's2', email: 'student2@unicode.test', name: 'Student Two' },
  { key: 's3', email: 'student3@unicode.test', name: 'Student Three' }
]

// ---------------------------------------------------------------------------
// Deterministic ids (valid UUID v4 shape) so re-runs upsert instead of insert.
// ---------------------------------------------------------------------------

const CLASS_IDS = {
  cs101: 'c1a55000-0000-4000-8000-000000000101',
  cs102: 'c1a55000-0000-4000-8000-000000000102'
}

const ASSIGNMENT_IDS = {
  hello: 'a5510000-0000-4000-8000-000000000101',
  loops: 'a5510000-0000-4000-8000-000000000102',
  fibonacci: 'a5510000-0000-4000-8000-000000000103',
  linkedList: 'a5510000-0000-4000-8000-000000000201',
  scheduled: 'a5510000-0000-4000-8000-000000000202'
}

const TEST_CASE_IDS = {
  hello: ['7e570000-0000-4000-8000-000000000101', '7e570000-0000-4000-8000-000000000102'],
  loops: ['7e570000-0000-4000-8000-000000000201', '7e570000-0000-4000-8000-000000000202'],
  fibonacci: [
    '7e570000-0000-4000-8000-000000000301',
    '7e570000-0000-4000-8000-000000000302',
    '7e570000-0000-4000-8000-000000000303'
  ],
  linkedList: ['7e570000-0000-4000-8000-000000000401', '7e570000-0000-4000-8000-000000000402']
}

const SUBMISSION_IDS = {
  s1: '5ab00000-0000-4000-8000-000000000001',
  s2: '5ab00000-0000-4000-8000-000000000002',
  s3: '5ab00000-0000-4000-8000-000000000003'
}

const PASTE_IDS = [
  '9a5e0000-0000-4000-8000-000000000001',
  '9a5e0000-0000-4000-8000-000000000002',
  '9a5e0000-0000-4000-8000-000000000003'
]

const COMMENT_IDS = [
  'c0110000-0000-4000-8000-000000000001',
  'c0110000-0000-4000-8000-000000000002',
  'c0110000-0000-4000-8000-000000000003'
]

const snapshotId = (student, index) => `5a090000-0000-4000-8000-0000000000${student}${index}`

// ---------------------------------------------------------------------------
// Seed content
// ---------------------------------------------------------------------------

const SNAPSHOT_CONTENTS = [
  'def fib(n):\n    # TODO\n    pass\n\n\nprint(fib(int(input())))\n',
  'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\n\nprint(fib(int(input())))\n',
  'def fib(n):\n    if n == 0:\n        return 0\n    if n == 1:\n        return 1\n    a, b = 0, 1\n    for _ in range(n - 1):\n        a, b = b, a + b\n    return b\n\n\nprint(fib(int(input())))\n',
  'def fib(n: int) -> int:\n    """Return the nth Fibonacci number (0-indexed)."""\n    if n < 2:\n        return n\n\n    a, b = 0, 1\n    for _ in range(n - 1):\n        a, b = b, a + b\n    return b\n\n\nif __name__ == "__main__":\n    print(fib(int(input())))\n',
  'def fib(n: int) -> int:\n    """Return the nth Fibonacci number (0-indexed)."""\n    if n < 2:\n        return n\n\n    previous, current = 0, 1\n    for _ in range(n - 1):\n        previous, current = current, previous + current\n    return current\n\n\nif __name__ == "__main__":\n    print(fib(int(input())))\n'
]

const SNAPSHOT_TYPES = ['manual', 'auto', 'paste', 'manual', 'auto']

// Final snapshots differ by student so the similarity panel has something
// meaningful to show: One and Two share a structural copy, Three solved it
// with a different approach.
const FINAL_BY_STUDENT = {
  s1: SNAPSHOT_CONTENTS[SNAPSHOT_CONTENTS.length - 1],
  s2: 'def fib(n: int) -> int:\n    """Return the nth Fibonacci number (0-indexed)."""\n    if n < 2:\n        return n\n\n    left, right = 0, 1\n    for _ in range(n - 1):\n        left, right = right, left + right\n    return right\n\n\nif __name__ == "__main__":\n    print(fib(int(input())))\n',
  s3: 'def fib(n):\n    """Return the nth Fibonacci number (0-indexed)."""\n    values = [0, 1]\n    while len(values) < n + 1:\n        values.append(values[-1] + values[-2])\n    return values[n]\n\n\nif __name__ == "__main__":\n    print(fib(int(input())))\n'
}

const snapshotContentsFor = (studentKey) => {
  const contents = [...SNAPSHOT_CONTENTS]
  contents[contents.length - 1] = FINAL_BY_STUDENT[studentKey] ?? contents[contents.length - 1]
  return contents
}

const PASTED_TEXTS = [
  'def fib(n):\n    if n == 0:\n        return 0\n    if n == 1:\n        return 1\n    a, b = 0, 1\n    for _ in range(n - 1):\n        a, b = b, a + b\n    return b\n',
  'if __name__ == "__main__":\n    print(fib(int(input())))\n'
]

// A shared paste on student2's submission, for the cross-student pg_trgm
// similarity panel.
const SHARED_PASTE_TEXT = PASTED_TEXTS[0]

// Deterministic edit-gap samples for the typing heatmap. Student One has a
// jagged rhythm with long pauses, Two is steadier, and Three is fast/flat.
const typingSamplesFor = (studentKey, snapshotIndex) => {
  const patterns = {
    s1: [1, 0.6, 1.2, 0.8, 3.8, 1.1, 0.5, 2.4, 0.9, 1.5, 0.7, 1.9],
    s2: [1, 0.9, 1.4, 0.8, 2.2, 1.1, 0.7, 1.6, 1, 1.3],
    s3: [1, 1.02, 0.96, 1.05, 1, 0.98, 1.03, 0.95, 1.01, 0.99]
  }
  const base = studentKey === 's1' ? 170 : studentKey === 's2' ? 240 : 85
  const pattern = patterns[studentKey] ?? patterns.s2
  return Array.from({ length: 40 }, (_, index) =>
    Math.max(20, Math.round(base * pattern[index % pattern.length] * (1 + snapshotIndex * 0.04)))
  )
}

// Raw formula inputs. One deliberate pass, one review, one flag.
const ICS_INPUTS = [
  { key: 's1', label: 'Student One', P: 0.1, C: 90, F: 88, K: 92, expected: 'pass' },
  { key: 's2', label: 'Student Two', P: 0.45, C: 68, F: 72, K: 65, expected: 'review' },
  { key: 's3', label: 'Student Three', P: 0.78, C: 42, F: 35, K: 30, expected: 'flag' }
]

// Fixed dates keep re-runs byte-for-byte stable.
const iso = (day, hour, minute, second = 0) =>
  new Date(Date.UTC(2026, 10, day, hour, minute, second)).toISOString()

const studentDay = (index) => 10 + index // 11, 12, 13
const studentHour = (index) => 13 + index // 14, 15, 16
const snapshotMinutes = [5, 12, 20, 31, 42]

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100

function computeIcs({ P, C, F, K }) {
  // C, F and K are provided on a 0-100 scale; normalize them to 0-1 so the
  // weighted sum lands on the 0-100 ICS scale.
  const terms = {
    paste_term: round2(100 * 0.35 * (1 - P)),
    cadence_term: round2(100 * 0.25 * (C / 100)),
    focus_term: round2(100 * 0.2 * (F / 100)),
    compilation_term: round2(100 * 0.2 * (K / 100))
  }
  const ics = round2(
    terms.paste_term + terms.cadence_term + terms.focus_term + terms.compilation_term
  )
  const band = ics >= 80 ? 'pass' : ics >= 60 ? 'review' : 'flag'
  return { terms, ics, band }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function listAllUsers() {
  const users = []
  let page = 1
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    users.push(...data.users)
    if (!data.nextPage || data.nextPage <= page) break
    page = data.nextPage
  }
  return users
}

async function ensureUser({ email, name }, existingByEmail) {
  const existing = existingByEmail.get(email.toLowerCase())
  if (existing) {
    const { data, error } = await db.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: name }
    })
    if (error) throw new Error(`update ${email}: ${error.message}`)
    return data.user.id
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name }
  })
  if (error) throw new Error(`create ${email}: ${error.message}`)
  return data.user.id
}

async function upsert(table, rows, onConflict) {
  const { error } = await db.from(table).upsert(rows, { onConflict })
  if (error) throw new Error(`${table}: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const existingUsers = await listAllUsers()
  const byEmail = new Map(
    existingUsers.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user])
  )

  const professorId = await ensureUser(PROFESSOR, byEmail)
  const adminId = await ensureUser(ADMIN, byEmail)
  const studentIds = {}
  for (const student of STUDENTS) {
    studentIds[student.key] = await ensureUser(student, byEmail)
  }

  await upsert(
    'profiles',
    [
      {
        id: professorId,
        email: PROFESSOR.email,
        display_name: PROFESSOR.name,
        role: 'professor'
      },
      {
        id: adminId,
        email: ADMIN.email,
        display_name: ADMIN.name,
        role: 'admin'
      },
      ...STUDENTS.map((student) => ({
        id: studentIds[student.key],
        email: student.email,
        display_name: student.name,
        role: 'student'
      }))
    ],
    'id'
  )

  await upsert(
    'classes',
    [
      {
        id: CLASS_IDS.cs101,
        name: 'CS101 - Intro to Programming',
        code: 'CS101',
        year_section: '1 - A',
        academic_year: '2026-2027',
        join_code: 'CS101J4K',
        professor_id: professorId
      },
      {
        id: CLASS_IDS.cs102,
        name: 'CS102 - Data Structures',
        code: 'CS102',
        year_section: '2 - B',
        academic_year: '2026-2027',
        join_code: 'CS102P8Q',
        professor_id: professorId
      }
    ],
    'id'
  )

  await upsert(
    'enrollments',
    [
      { class_id: CLASS_IDS.cs101, student_id: studentIds.s1 },
      { class_id: CLASS_IDS.cs101, student_id: studentIds.s2 },
      { class_id: CLASS_IDS.cs101, student_id: studentIds.s3 },
      { class_id: CLASS_IDS.cs102, student_id: studentIds.s1 },
      { class_id: CLASS_IDS.cs102, student_id: studentIds.s2 }
    ],
    'class_id,student_id'
  )

  await upsert(
    'assignments',
    [
      {
        id: ASSIGNMENT_IDS.hello,
        class_id: CLASS_IDS.cs101,
        title: 'Hello World',
        description: 'Print the traditional greeting exactly as specified.',
        language: 'python',
        file_name: 'hello.py',
        published: true,
        publish_at: null,
        auto_test_enabled: true,
        due_at: '2026-11-18T23:59:00.000Z',
        starter_code: '# Print the greeting below\n\n'
      },
      {
        id: ASSIGNMENT_IDS.loops,
        class_id: CLASS_IDS.cs101,
        title: 'Loops Practice',
        description: 'Read n and print every integer from 1 to n on its own line.',
        language: 'python',
        file_name: 'loops.py',
        published: true,
        publish_at: null,
        auto_test_enabled: true,
        due_at: '2026-11-20T23:59:00.000Z',
        starter_code: 'n = int(input())\n# print the numbers from 1 to n\n'
      },
      {
        id: ASSIGNMENT_IDS.fibonacci,
        class_id: CLASS_IDS.cs101,
        title: 'Fibonacci',
        description: 'Read n and print the nth Fibonacci number (0-indexed).',
        language: 'python',
        file_name: 'fibonacci.py',
        published: true,
        publish_at: null,
        auto_test_enabled: true,
        due_at: '2026-11-21T23:59:00.000Z',
        starter_code:
          'def fib(n: int) -> int:\n    # return the nth Fibonacci number\n    pass\n\n\nprint(fib(int(input())))\n'
      },
      {
        id: ASSIGNMENT_IDS.linkedList,
        class_id: CLASS_IDS.cs102,
        title: 'Linked List Insert',
        description: 'Read space-separated values and print them as a linked list.',
        language: 'python',
        file_name: 'linked_list.py',
        published: true,
        publish_at: null,
        auto_test_enabled: true,
        due_at: '2026-11-24T23:59:00.000Z',
        starter_code: 'values = input().split()\n# print the linked list\n'
      },
      {
        id: ASSIGNMENT_IDS.scheduled,
        class_id: CLASS_IDS.cs102,
        title: 'Recursion Warmup',
        description: 'A scheduled assignment that stays hidden until its publish time.',
        language: 'python',
        file_name: 'recursion.py',
        published: true,
        publish_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        auto_test_enabled: false,
        due_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        starter_code: 'def total(values):\n    # add the values recursively\n    pass\n'
      }
    ],
    'id'
  )

  await upsert(
    'test_cases',
    [
      {
        id: TEST_CASE_IDS.hello[0],
        assignment_id: ASSIGNMENT_IDS.hello,
        stdin: '',
        expected_stdout: 'Hello, World!\n',
        ordinal: 0,
        is_hidden: false
      },
      {
        id: TEST_CASE_IDS.hello[1],
        assignment_id: ASSIGNMENT_IDS.hello,
        stdin: '',
        expected_stdout: 'Hello, World!\n',
        ordinal: 1,
        is_hidden: true
      },
      {
        id: TEST_CASE_IDS.loops[0],
        assignment_id: ASSIGNMENT_IDS.loops,
        stdin: '5',
        expected_stdout: '1\n2\n3\n4\n5\n',
        ordinal: 0,
        is_hidden: false
      },
      {
        id: TEST_CASE_IDS.loops[1],
        assignment_id: ASSIGNMENT_IDS.loops,
        stdin: '1',
        expected_stdout: '1\n',
        ordinal: 1,
        is_hidden: true
      },
      {
        id: TEST_CASE_IDS.fibonacci[0],
        assignment_id: ASSIGNMENT_IDS.fibonacci,
        stdin: '10',
        expected_stdout: '55\n',
        ordinal: 0,
        is_hidden: false
      },
      {
        id: TEST_CASE_IDS.fibonacci[1],
        assignment_id: ASSIGNMENT_IDS.fibonacci,
        stdin: '1',
        expected_stdout: '1\n',
        ordinal: 1,
        is_hidden: false
      },
      {
        id: TEST_CASE_IDS.fibonacci[2],
        assignment_id: ASSIGNMENT_IDS.fibonacci,
        stdin: '20',
        expected_stdout: '6765\n',
        ordinal: 2,
        is_hidden: true
      },
      {
        id: TEST_CASE_IDS.linkedList[0],
        assignment_id: ASSIGNMENT_IDS.linkedList,
        stdin: '1 2 3',
        expected_stdout: '1 -> 2 -> 3\n',
        ordinal: 0,
        is_hidden: false
      },
      {
        id: TEST_CASE_IDS.linkedList[1],
        assignment_id: ASSIGNMENT_IDS.linkedList,
        stdin: '5',
        expected_stdout: '5\n',
        ordinal: 1,
        is_hidden: true
      }
    ],
    'id'
  )

  // Submissions first with a null final_snapshot_id (the FK points at a row
  // that does not exist yet), then snapshots, then point them at the last one.
  // Student 1 has a released grade, student 2 has a private grade waiting for
  // the professor to release it, and student 3 is ungraded.
  const demoGrades = [92, 78, null]
  const submissionRows = STUDENTS.map((student, index) => {
    const grade = demoGrades[index]
    const gradedAt = grade === null ? null : iso(studentDay(index + 1), studentHour(index + 1), 50)
    return {
      id: SUBMISSION_IDS[student.key],
      assignment_id: ASSIGNMENT_IDS.fibonacci,
      student_id: studentIds[student.key],
      final_snapshot_id: null,
      status: 'submitted',
      submitted_at: iso(studentDay(index + 1), studentHour(index + 1), 45),
      // Only released marks live on the public submission row.
      grade: index === 0 ? grade : null,
      graded_at: gradedAt,
      graded_by: grade === null ? null : professorId,
      grade_released: index === 0,
      grade_released_at: index === 0 ? gradedAt : null
    }
  })

  await upsert('submissions', submissionRows, 'id')

  // Private marks are stored in the professor-only grade table.
  await upsert(
    'submission_grades',
    STUDENTS.flatMap((student, index) => {
      const grade = demoGrades[index]
      if (grade === null) return []
      return [
        {
          submission_id: SUBMISSION_IDS[student.key],
          grade,
          graded_at: iso(studentDay(index + 1), studentHour(index + 1), 50),
          graded_by: professorId
        }
      ]
    }),
    'submission_id'
  )

  const snapshotRows = []
  for (const [index, student] of STUDENTS.entries()) {
    const day = studentDay(index + 1)
    const hour = studentHour(index + 1)
    snapshotContentsFor(student.key).forEach((content, snapIndex) => {
      snapshotRows.push({
        id: snapshotId(index + 1, snapIndex + 1),
        user_id: studentIds[student.key],
        lab_id: null,
        submission_id: SUBMISSION_IDS[student.key],
        file_name: 'CS101/fibonacci.py',
        content,
        snapshot_type: SNAPSHOT_TYPES[snapIndex],
        version: snapIndex + 1,
        char_count: content.length,
        line_count: content.split('\n').length,
        language: 'python',
        created_at: iso(day, hour, snapshotMinutes[snapIndex]),
        typing_intervals: typingSamplesFor(student.key, snapIndex)
      })
    })
  }

  await upsert('code_snapshots', snapshotRows, 'id')

  for (const [index, student] of STUDENTS.entries()) {
    const { error } = await db
      .from('submissions')
      .update({ final_snapshot_id: snapshotId(index + 1, SNAPSHOT_CONTENTS.length) })
      .eq('id', SUBMISSION_IDS[student.key])
    if (error) throw new Error(`submissions.final_snapshot_id: ${error.message}`)
  }

  // Two paste events on the flagged student's submission, at the paste
  // snapshot's minute.
  const flaggedDay = studentDay(3)
  const flaggedHour = studentHour(3)
  await upsert(
    'paste_events',
    [
      ...PASTED_TEXTS.map((text, index) => ({
        id: PASTE_IDS[index],
        snapshot_id: snapshotId(3, 3),
        user_id: studentIds.s3,
        lab_id: null,
        file_name: 'CS101/fibonacci.py',
        pasted_text: text,
        pasted_chars: text.length,
        paste_mode: 'multi-line',
        detected_via: 'onDidPaste',
        created_at: iso(flaggedDay, flaggedHour, snapshotMinutes[2], index * 8)
      })),
      {
        id: PASTE_IDS[2],
        snapshot_id: snapshotId(2, 5),
        user_id: studentIds.s2,
        lab_id: null,
        file_name: 'CS101/fibonacci.py',
        pasted_text: SHARED_PASTE_TEXT,
        pasted_chars: SHARED_PASTE_TEXT.length,
        paste_mode: 'multi-line',
        detected_via: 'onDidPaste',
        created_at: iso(studentDay(2), studentHour(2), snapshotMinutes[4], 10)
      }
    ],
    'id'
  )

  const scoreRows = ICS_INPUTS.map((input, index) => {
    const { terms, ics, band } = computeIcs(input)
    if (band !== input.expected) {
      throw new Error(
        `ICS sanity check failed for ${input.key}: expected ${input.expected}, computed ${band} (${ics})`
      )
    }
    return {
      submission_id: SUBMISSION_IDS[input.key],
      ...terms,
      ics,
      band,
      computed_at: iso(studentDay(index + 1), studentHour(index + 1), 47)
    }
  })

  await upsert('ics_scores', scoreRows, 'submission_id')

  // Comments: a professor note, a professor follow-up, and a student reply.
  await upsert(
    'comments',
    [
      {
        id: COMMENT_IDS[0],
        submission_id: SUBMISSION_IDS.s3,
        author_id: professorId,
        snapshot_id: snapshotId(3, SNAPSHOT_CONTENTS.length),
        anchor_line: 3,
        body: 'The base cases are right, but this section matches a published solution. Please rework it in your own words.',
        created_at: iso(14, 9, 15)
      }
    ],
    'id'
  )

  await upsert(
    'comments',
    [
      {
        id: COMMENT_IDS[1],
        submission_id: SUBMISSION_IDS.s3,
        author_id: professorId,
        snapshot_id: snapshotId(3, SNAPSHOT_CONTENTS.length),
        anchor_line: 3,
        parent_id: COMMENT_IDS[0],
        body: 'Reply: also rename the variables to explain the recurrence.',
        created_at: iso(14, 9, 20)
      },
      {
        id: COMMENT_IDS[2],
        submission_id: SUBMISSION_IDS.s3,
        author_id: studentIds.s3,
        snapshot_id: snapshotId(3, SNAPSHOT_CONTENTS.length),
        anchor_line: 3,
        parent_id: COMMENT_IDS[0],
        body: 'I rewrote the recurrence with clearer names and kept the base cases. Could you check the new version?',
        created_at: iso(14, 10, 5)
      }
    ],
    'id'
  )

  // -------------------------------------------------------------------------
  // Report (never prints the service-role key)
  // -------------------------------------------------------------------------
  console.log('Seed complete.\n')
  console.log('Professor:')
  console.log(`  ${PROFESSOR.email}  ${PASSWORD}  (role=professor)\n`)
  console.log('Admin:')
  console.log(`  ${ADMIN.email}  ${PASSWORD}  (role=admin)\n`)
  console.log('Students:')
  for (const student of STUDENTS) {
    console.log(`  ${student.email}  ${PASSWORD}`)
  }
  console.log('\nClasses:')
  console.log('  CS101 - Intro to Programming  (all three students)')
  console.log('  CS102 - Data Structures        (student1, student2)')
  console.log('\nICS:')
  for (const row of scoreRows) {
    console.log(
      `  ${row.submission_id}  ${row.ics.toFixed(2)}  ${row.band}  (paste ${row.paste_term}, cadence ${row.cadence_term}, focus ${row.focus_term}, compilation ${row.compilation_term})`
    )
  }
  console.log('\nDone.')
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message}`)
  process.exit(1)
})
