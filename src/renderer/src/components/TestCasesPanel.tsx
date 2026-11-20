import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import {
  friendlyJudge0Error,
  getJudge0Config,
  languageIdFor,
  runTestCases,
  testJudge0
} from '../lib/judge0'
import type { Judge0CaseResult } from '../lib/judge0'
import type { Judge0PublicConfig, Judge0Status } from '../../../shared/judge0'
import { fetchStudentTestCases } from '../lib/studentAssignments'
import type { TestCaseEntry } from '../types/professor'
import type { StudentAssignment } from '../types/student'

interface TestCasesPanelProps {
  assignment: StudentAssignment
  language: string
  readSource: () => string | null
}

export default function TestCasesPanel({
  assignment,
  language,
  readSource
}: TestCasesPanelProps): React.ReactElement {
  const [testCases, setTestCases] = useState<TestCaseEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [config, setConfig] = useState<Judge0PublicConfig | null>(null)
  const [status, setStatus] = useState<Judge0Status | null>(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Judge0CaseResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchStudentTestCases(assignment.id)
      .then((items) => {
        if (!cancelled) setTestCases(items)
      })
      .catch((fetchError) => {
        if (cancelled) return
        setTestCases([])
        setLoadError(
          fetchError instanceof Error ? fetchError.message : 'Could not load test cases.'
        )
      })
    return () => {
      cancelled = true
    }
  }, [assignment.id])

  useEffect(() => {
    let cancelled = false
    void getJudge0Config()
      .then(async (next) => {
        if (cancelled) return
        setConfig(next)
        if (!next.configured) return
        const judgeStatus = await testJudge0()
        if (!cancelled) setStatus(judgeStatus)
      })
      .catch((configError) => {
        if (!cancelled) setLoadError(friendlyJudge0Error(configError))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const languageSupported = languageIdFor(language) !== null
  const passed = results.filter((result) => result.pass).length
  const canRun = !running && languageSupported && testCases !== null && testCases.length > 0

  const run = async (): Promise<void> => {
    if (!testCases) return
    const source = readSource()
    if (!source || source.trim().length === 0) {
      setError('Open the assignment file with some code before running tests.')
      return
    }
    setRunning(true)
    setError(null)
    setResults([])
    try {
      setResults(await runTestCases({ source, language, testCases }))
    } catch (runError) {
      setError(friendlyJudge0Error(runError))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="student-tests">
      <div className="student-tests-head">
        <span className="student-tests-count">
          {testCases === null
            ? 'Loading tests…'
            : `${testCases.length} visible ${testCases.length === 1 ? 'test' : 'tests'}`}
        </span>
        <span className="judge0-endpoint">
          <span className={status?.ok === false ? 'judge0-dot judge0-dot-off' : 'judge0-dot'} />
          {status ? status.message : config === null ? 'Checking Judge0…' : 'Judge0'}
        </span>
      </div>

      {loadError && <div className="grade-error">{loadError}</div>}
      {config !== null && !config.configured && (
        <div className="grade-error">Judge0 is not available in this build.</div>
      )}
      {!languageSupported && (
        <p className="ics-note">Judge0 has no runtime for “{language}”, so tests cannot run.</p>
      )}
      {testCases !== null && testCases.length === 0 && !loadError && (
        <p className="ics-note">No visible test cases for this assignment.</p>
      )}

      <div className="student-tests-actions">
        <button
          className="btn-primary"
          onClick={() => void run()}
          disabled={!canRun}
          title={
            testCases === null
              ? 'Loading test cases'
              : testCases.length === 0
                ? 'No visible test cases'
                : 'Run every visible test against the active file'
          }
        >
          <Play size={13} /> {running ? 'Running…' : 'Run tests'}
        </button>
        {results.length > 0 && (
          <span className="student-tests-summary">
            {passed} / {results.length} passed
          </span>
        )}
      </div>

      {error && <div className="grade-error">{error}</div>}

      <div className="student-test-results">
        {(testCases ?? []).map((testCase) => {
          const result = results.find((item) => item.testCaseId === testCase.id)
          return (
            <details
              key={testCase.id}
              className={`student-test-row ${result ? (result.pass ? 'is-pass' : 'is-fail') : ''}`}
              open={result ? !result.pass : false}
            >
              <summary>
                <span>Case {testCase.ordinal + 1}</span>
                {result ? (
                  <span className={`student-test-status ${result.pass ? 'is-pass' : 'is-fail'}`}>
                    {result.pass ? 'Pass' : 'Fail'} · {result.status}
                  </span>
                ) : (
                  <span className="student-test-status">Not run</span>
                )}
              </summary>
              <div className="student-test-io">
                <div>
                  <span>stdin</span>
                  <code>{testCase.stdin?.trim() || '(empty)'}</code>
                </div>
                <div>
                  <span>expected</span>
                  <code>{testCase.expectedStdout?.trim() || '(empty)'}</code>
                </div>
                {result && (
                  <div>
                    <span>actual</span>
                    <code>{result.stdout.trim() || '(no output)'}</code>
                  </div>
                )}
                {result?.compileOutput && (
                  <div className="is-error">
                    <span>compiler</span>
                    <code>{result.compileOutput}</code>
                  </div>
                )}
                {result?.stderr && (
                  <div className="is-error">
                    <span>stderr</span>
                    <code>{result.stderr}</code>
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
