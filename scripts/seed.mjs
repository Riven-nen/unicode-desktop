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
 *   - Run the migrations first (including the ICS evidence model).
 *   - The service-role key is read from the environment and never written to
 *     disk or printed. Never commit it.
 *   - The public key (VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY) is
 *     also required: the seed signs in as the demo professor so the live
 *     security-definer `recompute_ics` RPC produces the v3 demo scores.
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
const PUBLIC_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY

if (!SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set it in the shell before running this script (see the header comment).'
  )
  process.exit(1)
}
if (!PUBLIC_KEY) {
  console.error(
    'Missing VITE_SUPABASE_PUBLISHABLE_KEY.\n' +
      'The seed signs in as the demo professor to recompute ICS scores with the live v3 function.'
  )
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// The public-key client signs in as the demo professor so seeded ICS rows are
// produced by the same security-definer RPC students' submissions use.
const professorClient = createClient(SUPABASE_URL, PUBLIC_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const PASSWORD = 'Password123!'

const PROFESSORS = [
  { key: 'p1', email: 'professor@unicode.test', name: 'Professor Demo' },
  { key: 'p2', email: 'professor2@unicode.test', name: 'Professor Lin' },
  { key: 'p3', email: 'professor3@unicode.test', name: 'Professor Ortega' }
]
const ADMIN = { email: 'admin@unicode.test', name: 'Admin Demo' }
const STUDENTS = [
  { key: 's1', email: 'student1@unicode.test', name: 'Student One' },
  { key: 's2', email: 'student2@unicode.test', name: 'Student Two' },
  { key: 's3', email: 'student3@unicode.test', name: 'Student Three' },
  { key: 's4', email: 'student4@unicode.test', name: 'Student Four' },
  { key: 's5', email: 'student5@unicode.test', name: 'Student Five' },
  { key: 's6', email: 'student6@unicode.test', name: 'Student Six' },
  { key: 's7', email: 'student7@unicode.test', name: 'Student Seven' },
  { key: 's8', email: 'student8@unicode.test', name: 'Student Eight' },
  { key: 's9', email: 'student9@unicode.test', name: 'Student Nine' },
  { key: 's10', email: 'student10@unicode.test', name: 'Student Ten' }
]

// Only the first three students get the full Fibonacci history, so the
// professor analytics stay focused and the seed remains quick.
const SUBMISSION_STUDENTS = STUDENTS.slice(0, 3)

// ---------------------------------------------------------------------------
// Deterministic ids (valid UUID v4 shape) so re-runs upsert instead of insert.
// ---------------------------------------------------------------------------

const CLASS_IDS = {
  cs101: 'c1a55000-0000-4000-8000-000000000101',
  cs102: 'c1a55000-0000-4000-8000-000000000102',
  cs201: 'c1a55000-0000-4000-8000-000000000201',
  cs301: 'c1a55000-0000-4000-8000-000000000301',
  html101: 'c1a55000-0000-4000-8000-000000000401',
  web102: 'c1a55000-0000-4000-8000-000000000501'
}

const ASSIGNMENT_IDS = {
  hello: 'a5510000-0000-4000-8000-000000000101',
  loops: 'a5510000-0000-4000-8000-000000000102',
  fibonacci: 'a5510000-0000-4000-8000-000000000103',
  linkedList: 'a5510000-0000-4000-8000-000000000201',
  scheduled: 'a5510000-0000-4000-8000-000000000202',
  javaShapes: 'a5510000-0000-4000-8000-000000000301',
  cppVectors: 'a5510000-0000-4000-8000-000000000401',
  htmlFirstPage: 'a5510000-0000-4000-8000-000000000501',
  htmlLinks: 'a5510000-0000-4000-8000-000000000502',
  htmlForms: 'a5510000-0000-4000-8000-000000000503',
  htmlCss: 'a5510000-0000-4000-8000-000000000504',
  htmlScript: 'a5510000-0000-4000-8000-000000000505',
  htmlProject: 'a5510000-0000-4000-8000-000000000506',
  cssBasics: 'a5510000-0000-4000-8000-000000000601',
  flexbox: 'a5510000-0000-4000-8000-000000000602',
  domEvents: 'a5510000-0000-4000-8000-000000000603',
  gallery: 'a5510000-0000-4000-8000-000000000604'
}

const TEST_CASE_IDS = {
  hello: ['7e570000-0000-4000-8000-000000000101', '7e570000-0000-4000-8000-000000000102'],
  loops: ['7e570000-0000-4000-8000-000000000201', '7e570000-0000-4000-8000-000000000202'],
  fibonacci: [
    '7e570000-0000-4000-8000-000000000301',
    '7e570000-0000-4000-8000-000000000302',
    '7e570000-0000-4000-8000-000000000303'
  ],
  linkedList: ['7e570000-0000-4000-8000-000000000401', '7e570000-0000-4000-8000-000000000402'],
  javaShapes: ['7e570000-0000-4000-8000-000000000501', '7e570000-0000-4000-8000-000000000502'],
  cppVectors: ['7e570000-0000-4000-8000-000000000601', '7e570000-0000-4000-8000-000000000602']
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

// Synthetic authorship counters. The live professor RPC recomputes ICS v3 from
// these, so the seeded rows exercise the same evidence model as real work.
// Student One is a normal authored session (pass), Two is mixed/short (review),
// and Three is a line-chunk + paste profile (flag).
const EDIT_STATS = {
  s1: {
    insertedChars: 120,
    inserts: 40,
    deletes: 2,
    reworks: 2,
    revisits: 1,
    midLinePauses: 0,
    undoRedo: 0,
    pauses: 4,
    chunkBursts: 0,
    chunkChars: 0,
    immediateChunks: 0,
    bursts: 5
  },
  s2: {
    insertedChars: 60,
    inserts: 20,
    deletes: 1,
    reworks: 1,
    revisits: 0,
    midLinePauses: 1,
    undoRedo: 0,
    pauses: 3,
    chunkBursts: 1,
    chunkChars: 30,
    immediateChunks: 0,
    bursts: 3
  },
  s3: {
    insertedChars: 20,
    inserts: 5,
    deletes: 0,
    reworks: 0,
    revisits: 0,
    midLinePauses: 2,
    undoRedo: 0,
    pauses: 4,
    chunkBursts: 1,
    chunkChars: 20,
    immediateChunks: 1,
    bursts: 2
  }
}

const editStatsFor = (studentKey, snapshotIndex) => {
  const profile = EDIT_STATS[studentKey] ?? EDIT_STATS.s2
  return {
    ...profile,
    insertedChars: profile.insertedChars + snapshotIndex * 2,
    inserts: profile.inserts + (snapshotIndex % 2)
  }
}

const focusStatsFor = (studentKey) => ({
  blurs: studentKey === 's3' ? 1 : 0,
  returns: studentKey === 's3' ? 1 : 0,
  awayMs: studentKey === 's3' ? 5000 : 0
})

// Fixed dates keep re-runs byte-for-byte stable.
const iso = (day, hour, minute, second = 0) =>
  new Date(Date.UTC(2026, 10, day, hour, minute, second)).toISOString()

const studentDay = (index) => 10 + index // 11, 12, 13
const studentHour = (index) => 13 + index // 14, 15, 16
const snapshotMinutes = [5, 12, 20, 31, 42]

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

  const professorIds = {}
  for (const professor of PROFESSORS) {
    professorIds[professor.key] = await ensureUser(professor, byEmail)
  }
  const professorId = professorIds.p1
  const adminId = await ensureUser(ADMIN, byEmail)
  const studentIds = {}
  for (const student of STUDENTS) {
    studentIds[student.key] = await ensureUser(student, byEmail)
  }

  await upsert(
    'profiles',
    [
      ...PROFESSORS.map((professor) => ({
        id: professorIds[professor.key],
        email: professor.email,
        display_name: professor.name,
        role: 'professor'
      })),
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
      },
      {
        id: CLASS_IDS.cs201,
        name: 'CS201 - Object-Oriented Programming',
        code: 'CS201',
        year_section: '2 - A',
        academic_year: '2026-2027',
        join_code: 'CS201R7A',
        professor_id: professorIds.p2
      },
      {
        id: CLASS_IDS.cs301,
        name: 'CS301 - Systems Programming',
        code: 'CS301',
        year_section: '3 - A',
        academic_year: '2026-2027',
        join_code: 'CS301M2Z',
        professor_id: professorIds.p3
      },
      {
        id: CLASS_IDS.html101,
        name: 'HTML101 - Web Foundations',
        code: 'HTML101',
        year_section: '1 - C',
        academic_year: '2026-2027',
        join_code: 'HTML101L5V',
        professor_id: professorId
      },
      {
        id: CLASS_IDS.web102,
        name: 'WEB102 - CSS & JavaScript',
        code: 'WEB102',
        year_section: '2 - A',
        academic_year: '2026-2027',
        join_code: 'WEB102C4S',
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
      { class_id: CLASS_IDS.cs101, student_id: studentIds.s4 },
      { class_id: CLASS_IDS.cs101, student_id: studentIds.s5 },
      { class_id: CLASS_IDS.cs101, student_id: studentIds.s6 },
      { class_id: CLASS_IDS.cs102, student_id: studentIds.s1 },
      { class_id: CLASS_IDS.cs102, student_id: studentIds.s2 },
      { class_id: CLASS_IDS.cs102, student_id: studentIds.s4 },
      { class_id: CLASS_IDS.cs201, student_id: studentIds.s3 },
      { class_id: CLASS_IDS.cs201, student_id: studentIds.s5 },
      { class_id: CLASS_IDS.cs201, student_id: studentIds.s6 },
      { class_id: CLASS_IDS.cs201, student_id: studentIds.s7 },
      { class_id: CLASS_IDS.cs301, student_id: studentIds.s8 },
      { class_id: CLASS_IDS.cs301, student_id: studentIds.s9 },
      { class_id: CLASS_IDS.cs301, student_id: studentIds.s10 },
      { class_id: CLASS_IDS.html101, student_id: studentIds.s1 },
      { class_id: CLASS_IDS.html101, student_id: studentIds.s2 },
      { class_id: CLASS_IDS.html101, student_id: studentIds.s3 },
      { class_id: CLASS_IDS.html101, student_id: studentIds.s4 },
      { class_id: CLASS_IDS.html101, student_id: studentIds.s5 },
      { class_id: CLASS_IDS.html101, student_id: studentIds.s6 },
      { class_id: CLASS_IDS.web102, student_id: studentIds.s1 },
      { class_id: CLASS_IDS.web102, student_id: studentIds.s2 },
      { class_id: CLASS_IDS.web102, student_id: studentIds.s3 },
      { class_id: CLASS_IDS.web102, student_id: studentIds.s4 },
      { class_id: CLASS_IDS.web102, student_id: studentIds.s5 },
      { class_id: CLASS_IDS.web102, student_id: studentIds.s6 }
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
      },
      {
        id: ASSIGNMENT_IDS.javaShapes,
        class_id: CLASS_IDS.cs201,
        title: 'Shapes in Java',
        description: 'Read a side length and print the square area as "Area: <value>".',
        language: 'java',
        file_name: 'Shapes.java',
        published: true,
        publish_at: null,
        auto_test_enabled: true,
        due_at: '2026-11-27T23:59:00.000Z',
        starter_code:
          'import java.util.Scanner;\n\npublic class Shapes {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int side = scanner.nextInt();\n        // print the square area as "Area: <value>"\n    }\n}\n'
      },
      {
        id: ASSIGNMENT_IDS.cppVectors,
        class_id: CLASS_IDS.cs301,
        title: 'Vector Sum in C++',
        description: 'Read n followed by n integers and print their sum.',
        language: 'cpp',
        file_name: 'vector_sum.cpp',
        published: true,
        publish_at: null,
        auto_test_enabled: true,
        due_at: '2026-11-28T23:59:00.000Z',
        starter_code:
          '#include <iostream>\n#include <vector>\n\nint main() {\n    int count = 0;\n    std::cin >> count;\n    std::vector<int> values(count);\n    // read the values and print their sum\n    return 0;\n}\n'
      },
      {
        id: ASSIGNMENT_IDS.htmlFirstPage,
        class_id: CLASS_IDS.html101,
        title: 'Lesson 1: Your First Page',
        description: `A web page is a text file made of elements. In this lesson you will build your first page and see it render live.

1. The doctype tells the browser this is HTML5.
2. The html element wraps the page.
3. The head holds information about the page; the title appears in the browser tab.
4. The body holds everything people see.

Add an h1 heading, a p paragraph, and a ul list with at least two li items. The preview below the editor updates as you type.`,
        language: 'html',
        file_name: 'index.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-05T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My First Page</title>
  </head>
  <body>
    <!-- Add an h1, a p, and a ul with two li items. -->
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.htmlLinks,
        class_id: CLASS_IDS.html101,
        title: 'Lesson 2: Links, Images, and Structure',
        description: `Pages become useful when they connect and when their structure is meaningful.

- Use a with href to link to another page or site.
- Use img with src and alt. Alt text describes the image for screen readers and when the image fails.
- Use header, nav, main, section, and footer to describe page regions instead of generic divs.

Build a short "About me" page with a header, a main section, one link, one image, and a footer. Add a second link back to index.html once that file exists.`,
        language: 'html',
        file_name: 'links.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-08T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>About me</title>
  </head>
  <body>
    <header>
      <h1>About me</h1>
      <nav>
        <!-- Add a link to index.html -->
      </nav>
    </header>

    <main>
      <section>
        <h2>Who I am</h2>
        <p>Introduce yourself in a short paragraph.</p>
        <!-- Add an img with src and alt text. -->
      </section>
    </main>

    <footer>
      <!-- Add a link to a site you like. -->
    </footer>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.htmlForms,
        class_id: CLASS_IDS.html101,
        title: 'Lesson 3: Tables and Forms',
        description: `Forms collect information. Every input needs a label so the control has a readable name.

- form groups the controls.
- label with for links to an input id.
- input type can be text, email, number, or password.
- select and option create a drop-down.
- button submits the form.

Build a sign-up form with a name, email, a number input, a select, and a submit button. Put a small table underneath that lists three example users with a header row.`,
        language: 'html',
        file_name: 'forms.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-11T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign up</title>
  </head>
  <body>
    <h1>Join the club</h1>

    <form>
      <!-- Add labeled name, email, and number inputs. -->
      <!-- Add a select with at least two options. -->
      <!-- Add a submit button. -->
    </form>

    <h2>Members</h2>
    <table>
      <thead>
        <tr><th>Name</th><th>Email</th><th>Year</th></tr>
      </thead>
      <tbody>
        <!-- Add three rows. -->
      </tbody>
    </table>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.htmlCss,
        class_id: CLASS_IDS.html101,
        title: 'Lesson 4: Style with CSS',
        description: `CSS controls presentation. A rule has a selector and a declaration block.

- Select elements with a tag, a class like .card, or an id like #hero.
- The box model is content, padding, border, and margin.
- Use color, background, font-family, and line-height for readable text.
- Use display: flex and gap to lay out a row or column.

Style the page in the starter: add a card class, set a readable font, add padding and a border, and use flexbox for the button row.`,
        language: 'html',
        file_name: 'styles.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-14T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Styled card</title>
    <style>
      body {
        margin: 2rem;
        font-family: system-ui, sans-serif;
      }

      /* Style .card: padding, border, border-radius, background. */
      /* Style .card h2: color and margin. */
      /* Style .actions: display flex and gap. */
    </style>
  </head>
  <body>
    <main>
      <article class="card">
        <h2>HTML + CSS</h2>
        <p>Structure is HTML. Presentation is CSS.</p>
        <div class="actions">
          <button>Primary</button>
          <button>Secondary</button>
        </div>
      </article>
    </main>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.htmlScript,
        class_id: CLASS_IDS.html101,
        title: 'Lesson 5: Interactivity with JavaScript',
        description: `JavaScript lets a page respond to people. In this lesson you will select elements, listen for a click, and change the page.

- document.querySelector selects the first matching element.
- addEventListener attaches a function to an event.
- textContent changes visible text.
- classList.toggle changes styling without editing CSS values directly.

Build a counter or a greeting. The starter has a button and a paragraph; make the button update the paragraph and toggle a class.`,
        language: 'html',
        file_name: 'interactive.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-17T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interactive page</title>
    <style>
      body { margin: 2rem; font-family: system-ui, sans-serif; }
      .is-on { color: #0f766e; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Mini interaction</h1>
    <p id="message">The button has not been clicked yet.</p>
    <button id="action">Click me</button>

    <script>
      // Select #message and #action, then listen for a click.
      // Update the message and toggle the is-on class.
    </script>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.htmlProject,
        class_id: CLASS_IDS.html101,
        title: 'Project: Personal Profile Page',
        description: `Combine the lessons into one polished multi-file project that introduces you.

This project lives in the profile-project folder. Use New File and Add Images in the class file tree to create the supporting assets.

Requirements:
- A semantic page with header, nav, main, and footer.
- A heading, at least two paragraphs, and a list.
- One image with meaningful alt text, added with Add Images.
- At least two working links.
- A styles.css file linked from the page.
- A script.js file linked from the page with one interaction, such as a button that reveals a fun fact or toggles a theme.

Preview often, keep the markup readable, and make sure the page still makes sense without CSS.`,
        language: 'html',
        file_name: 'profile-project/index.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-20T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My profile</title>
    <!-- Create styles.css in this folder, then link it here. -->
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header>
      <h1>Your name</h1>
      <nav>
        <!-- Add links. -->
      </nav>
    </header>

    <main>
      <section class="card">
        <h2>About me</h2>
        <p>Write an introduction.</p>
        <!-- Add an image with alt text and a list. -->
      </section>

      <section class="card">
        <h2>Fun fact</h2>
        <p id="fact">Press the button to reveal a fact.</p>
        <button id="reveal">Reveal</button>
      </section>
    </main>

    <footer>
      <p>Built in HTML101.</p>
    </footer>

    <!-- Create script.js in this folder, then link it here. -->
    <script src="script.js"></script>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.cssBasics,
        class_id: CLASS_IDS.web102,
        title: 'CSS: Selectors and the Box Model',
        description: `CSS controls how HTML looks. This lesson introduces selectors, the cascade, and the box model.

- A type selector targets a tag: p { ... }
- A class selector starts with a dot: .card { ... }
- An id selector starts with #: #hero { ... }
- The box model is content, padding, border, and margin.
- Use color, background, font-family, and line-height for readable text.

Style the card and button row in the starter. Add a class selector, padding, border, border-radius, and margin.`,
        language: 'html',
        file_name: 'css-basics/index.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-22T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CSS box model</title>
    <style>
      body { margin: 2rem; font-family: system-ui, sans-serif; }
      /* Style .card here. */
      /* Style the buttons with flex and gap. */
    </style>
  </head>
  <body>
    <main class="card">
      <h1>CSS box model</h1>
      <p>Padding is inside the border. Margin is outside it.</p>
      <div class="actions">
        <button>Save</button>
        <button>Cancel</button>
      </div>
    </main>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.flexbox,
        class_id: CLASS_IDS.web102,
        title: 'CSS: Flexbox Layout',
        description: `Flexbox lays elements out in one direction while distributing space.

- display: flex creates a flex container.
- flex-direction chooses row or column.
- justify-content distributes along the main axis.
- align-items aligns across the cross axis.
- gap adds space between children.

Turn the starter into a responsive card row with a header and footer. Use wrap so cards stack on narrow screens.`,
        language: 'html',
        file_name: 'flexbox/index.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-24T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flexbox</title>
    <style>
      body { margin: 2rem; font-family: system-ui, sans-serif; }
      .row { /* add display, gap, wrap */ }
      .card { padding: 1rem; border: 1px solid #cbd5e1; border-radius: 10px; flex: 1 1 180px; }
    </style>
  </head>
  <body>
    <h1>Flexbox cards</h1>
    <section class="row">
      <article class="card"><h2>One</h2><p>First card.</p></article>
      <article class="card"><h2>Two</h2><p>Second card.</p></article>
      <article class="card"><h2>Three</h2><p>Third card.</p></article>
    </section>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.domEvents,
        class_id: CLASS_IDS.web102,
        title: 'JavaScript: DOM and Events',
        description: `JavaScript makes a page respond. This lesson uses the DOM and event listeners.

- document.querySelector selects an element.
- addEventListener attaches a function to an event.
- textContent changes visible text.
- classList.toggle changes styling.
- event.preventDefault stops a form from navigating.

Build a greeting form. On submit, read the name and show a personalized message.`,
        language: 'html',
        file_name: 'dom-events/index.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-27T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DOM and events</title>
    <style>
      body { margin: 2rem; font-family: system-ui, sans-serif; }
      .is-ready { color: #0f766e; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Greeting form</h1>
    <form id="greeting">
      <label for="name">Name</label>
      <input id="name" />
      <button type="submit">Greet</button>
    </form>
    <p id="output">Submit the form to see a message.</p>

    <script>
      // Select the form, input, and output.
      // Prevent the form from navigating.
      // Read the name, update the output, and toggle .is-ready.
    </script>
  </body>
</html>
`
      },
      {
        id: ASSIGNMENT_IDS.gallery,
        class_id: CLASS_IDS.web102,
        title: 'Project: Interactive Gallery',
        description: `Build a small interactive gallery that combines CSS and JavaScript.

Requirements:
- A responsive flex or grid layout for at least three items.
- A CSS class for the selected item.
- A JavaScript click handler that changes the selected item.
- A keyboard-accessible button or link for every action.
- One image with alt text, added with Add Images.
- A short description for each item.

Keep the HTML semantic and the CSS in a style block or a linked stylesheet.`,
        language: 'html',
        file_name: 'gallery/index.html',
        published: true,
        publish_at: null,
        auto_test_enabled: false,
        due_at: '2026-12-30T23:59:00.000Z',
        starter_code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interactive gallery</title>
    <style>
      body { margin: 2rem; font-family: system-ui, sans-serif; }
      .gallery { display: flex; flex-wrap: wrap; gap: 1rem; }
      .item { padding: 1rem; border: 1px solid #cbd5e1; border-radius: 10px; flex: 1 1 180px; }
      .item.is-selected { outline: 3px solid #0f766e; }
    </style>
  </head>
  <body>
    <h1>Gallery</h1>
    <section class="gallery" id="gallery">
      <button class="item" type="button"><h2>Item one</h2><p>Description.</p></button>
      <button class="item" type="button"><h2>Item two</h2><p>Description.</p></button>
      <button class="item" type="button"><h2>Item three</h2><p>Description.</p></button>
    </section>
    <p id="status">Select an item.</p>

    <script>
      // Add a click listener to each .item.
      // Toggle .is-selected and update #status.
    </script>
  </body>
</html>
`
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
      },
      {
        id: TEST_CASE_IDS.javaShapes[0],
        assignment_id: ASSIGNMENT_IDS.javaShapes,
        stdin: '5',
        expected_stdout: 'Area: 25\n',
        ordinal: 0,
        is_hidden: false
      },
      {
        id: TEST_CASE_IDS.javaShapes[1],
        assignment_id: ASSIGNMENT_IDS.javaShapes,
        stdin: '3',
        expected_stdout: 'Area: 9\n',
        ordinal: 1,
        is_hidden: true
      },
      {
        id: TEST_CASE_IDS.cppVectors[0],
        assignment_id: ASSIGNMENT_IDS.cppVectors,
        stdin: '5\n1 2 3 4 5\n',
        expected_stdout: '15\n',
        ordinal: 0,
        is_hidden: false
      },
      {
        id: TEST_CASE_IDS.cppVectors[1],
        assignment_id: ASSIGNMENT_IDS.cppVectors,
        stdin: '0\n',
        expected_stdout: '0\n',
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
  const submissionRows = SUBMISSION_STUDENTS.map((student, index) => {
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
    SUBMISSION_STUDENTS.flatMap((student, index) => {
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
  for (const [index, student] of SUBMISSION_STUDENTS.entries()) {
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
        typing_intervals: typingSamplesFor(student.key, snapIndex),
        edit_stats: editStatsFor(student.key, snapIndex),
        focus_stats: focusStatsFor(student.key)
      })
    })
  }

  await upsert('code_snapshots', snapshotRows, 'id')

  for (const [index, student] of SUBMISSION_STUDENTS.entries()) {
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

  // Recompute through the real professor RPC so the seeded rows use the live
  // ICS v3 evidence model rather than a copy of the formula in this script.
  const login = await professorClient.auth.signInWithPassword({
    email: 'professor@unicode.test',
    password: PASSWORD
  })
  if (login.error) throw new Error(`professor sign-in for ICS: ${login.error.message}`)

  const expectedBands = { s1: 'pass', s2: 'review', s3: 'flag' }
  for (const student of SUBMISSION_STUDENTS) {
    const { error } = await professorClient.rpc('recompute_ics', {
      target_submission: SUBMISSION_IDS[student.key]
    })
    if (error) throw new Error(`recompute_ics ${student.key}: ${error.message}`)
  }

  const { data: seededScores, error: scoreError } = await db
    .from('ics_scores')
    .select('*')
    .in(
      'submission_id',
      SUBMISSION_STUDENTS.map((student) => SUBMISSION_IDS[student.key])
    )
  if (scoreError) throw new Error(`ics_scores: ${scoreError.message}`)

  const scoreRows = SUBMISSION_STUDENTS.map((student) => {
    const row = seededScores?.find((score) => score.submission_id === SUBMISSION_IDS[student.key])
    if (!row) throw new Error(`ICS row missing for ${student.key}`)
    const expected = expectedBands[student.key]
    if (row.band !== expected || row.model !== 'v3') {
      throw new Error(
        `ICS sanity check failed for ${student.key}: expected ${expected}/v3, got ${row.band}/${row.model} (${row.ics})`
      )
    }
    return row
  })

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
  console.log('Professors:')
  for (const professor of PROFESSORS) {
    console.log(`  ${professor.email}  ${PASSWORD}  (role=professor)`)
  }
  console.log('\nAdmin:')
  console.log(`  ${ADMIN.email}  ${PASSWORD}  (role=admin)\n`)
  console.log('Students:')
  for (const student of STUDENTS) {
    console.log(`  ${student.email}  ${PASSWORD}`)
  }
  console.log('\nClasses:')
  console.log('  CS101 - Intro to Programming  (student1-student6)')
  console.log('  CS102 - Data Structures        (student1, student2, student4)')
  console.log('  CS201 - Object-Oriented Programming  (student3, student5-student7)')
  console.log('  CS301 - Systems Programming    (student8-student10)')
  console.log('  HTML101 - Web Foundations      (student1-student6, HTML lessons + project)')
  console.log('  WEB102 - CSS & JavaScript      (student1-student6, CSS/JS lessons + gallery)')
  console.log('\nICS:')
  for (const row of scoreRows) {
    console.log(
      `  ${row.submission_id}  ${Number(row.ics).toFixed(2)}  ${row.band}/${row.model}  confidence ${Number(row.confidence ?? 0).toFixed(2)}  ${row.band_reason}`
    )
  }
  console.log('\nDone.')
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message}`)
  process.exit(1)
})
