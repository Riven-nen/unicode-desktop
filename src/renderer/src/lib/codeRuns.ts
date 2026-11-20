import { supabase } from './supabase'

export interface CodeRunRecord {
  userId: string
  assignmentId?: string | null
  submissionId?: string | null
  snapshotId?: string | null
  testCaseId?: string | null
  fileName?: string | null
  language: string | null
  source: string
  stdin: string
  expectedStdout: string | null
  stdout: string
  stderr: string
  compileOutput: string
  statusId: number
  statusDescription: string
  passed: boolean | null
  time: string | null
  memory: number | null
}

function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

const numericTime = (value: string | null): number | null => {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Stores one or more immutable Judge0 executions. */
export async function recordCodeRuns(runs: CodeRunRecord[]): Promise<void> {
  if (!supabase || runs.length === 0) return

  const { error } = await client()
    .from('code_runs')
    .insert(
      runs.map((run) => ({
        user_id: run.userId,
        assignment_id: run.assignmentId ?? null,
        submission_id: run.submissionId ?? null,
        snapshot_id: run.snapshotId ?? null,
        test_case_id: run.testCaseId ?? null,
        file_name: run.fileName ?? null,
        language: run.language,
        source: run.source,
        stdin: run.stdin,
        expected_stdout: run.expectedStdout,
        stdout: run.stdout,
        stderr: run.stderr,
        compile_output: run.compileOutput,
        status_id: run.statusId,
        status_description: run.statusDescription,
        passed: run.passed,
        time_seconds: numericTime(run.time),
        memory_kb: run.memory
      }))
    )

  if (error) throw new Error(error.message)
}
