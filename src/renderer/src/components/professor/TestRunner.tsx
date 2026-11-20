import { useEffect, useState } from 'react'
import { Play, Settings2 } from 'lucide-react'
import Judge0SettingsModal from './Judge0SettingsModal'
import {
  friendlyJudge0Error,
  getJudge0Config,
  languageIdFor,
  runTestCases,
  testJudge0
} from '../../lib/judge0'
import { recordCodeRuns } from '../../lib/codeRuns'
import type { Judge0CaseResult } from '../../lib/judge0'
import type { Judge0PublicConfig, Judge0Status } from '../../../../shared/judge0'
import type { TestCaseEntry } from '../../types/professor'

interface TestRunnerProps {
  source: string
  language: string | null
  testCases: TestCaseEntry[]
  userId: string
  submissionId: string
  assignmentId: string
  snapshotId: string | null
  fileName: string | null
  onRecorded?: () => void
}

export default function TestRunner({
  source,
  language,
  testCases,
  userId,
  submissionId,
  assignmentId,
  snapshotId,
  fileName,
  onRecorded
}: TestRunnerProps): React.ReactElement {
  const [config, setConfig] = useState<Judge0PublicConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [status, setStatus] = useState<Judge0Status | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [results, setResults] = useState<Judge0CaseResult[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getJudge0Config()
      .then((next) => {
        if (!cancelled) setConfig(next)
      })
      .catch((configErrorValue) => {
        if (!cancelled) setConfigError(friendlyJudge0Error(configErrorValue))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!config?.configured) return
    let cancelled = false
    void testJudge0()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch((statusError) => {
        if (!cancelled) {
          setStatus({
            ok: false,
            configured: true,
            message: friendlyJudge0Error(statusError)
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [config])

  const configured = config?.configured ?? false
  const languageSupported = languageIdFor(language) !== null
  const passed = results.filter((result) => result.pass).length

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    setResults([])
    try {
      const next = await runTestCases({ source, language, testCases })
      setResults(next)

      // Persist the outcomes so the integrity pipeline can use real compile
      // results for K, and so professors can audit what was executed.
      void recordCodeRuns(
        next.map((result) => {
          const testCase = testCases.find((item) => item.id === result.testCaseId)
          return {
            userId,
            assignmentId,
            submissionId,
            snapshotId,
            testCaseId: result.testCaseId,
            fileName,
            language,
            source,
            stdin: testCase?.stdin ?? '',
            expectedStdout: testCase?.expectedStdout ?? null,
            stdout: result.stdout,
            stderr: result.stderr,
            compileOutput: result.compileOutput,
            statusId: result.statusId,
            statusDescription: result.status,
            passed: result.pass,
            time: result.time,
            memory: result.memory
          }
        })
      )
        .catch((recordError) => {
          console.warn('[tests] could not store run results:', recordError)
        })
        .then(() => {
          onRecorded?.()
        })
    } catch (runError) {
      setError(friendlyJudge0Error(runError))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="test-runner">
      <header className="panel-head">
        <h3>Test cases</h3>
        <div className="comment-head-actions">
          <span className="panel-meta">{testCases.length} cases</span>
          <button
            className="icon-text-btn"
            onClick={() => setSettingsOpen(true)}
            title="Judge0 settings"
          >
            <Settings2 size={12} /> Judge0
          </button>
        </div>
      </header>

      {configError && <div className="grade-error">{configError}</div>}
      {config === null && !configError && <p className="ics-note">Checking Judge0…</p>}

      {config !== null && !configured && (
        <div className="judge0-setup">
          <p>
            Judge0 is not available in this build. Check the Judge0 configuration before running
            tests.
          </p>
        </div>
      )}

      {configured && (
        <p className="judge0-endpoint">
          <span className={status?.ok === false ? 'judge0-dot judge0-dot-off' : 'judge0-dot'} />
          {status ? status.message : 'Judge0'}
        </p>
      )}

      {configured && !languageSupported && (
        <p className="ics-note">
          Judge0 has no language id for “{language ?? 'unknown'}”; this assignment cannot be run.
        </p>
      )}

      <button
        className="btn-primary"
        onClick={() => void run()}
        disabled={running || !configured || !languageSupported || testCases.length === 0}
        title={
          configured
            ? languageSupported
              ? 'Run every test case against the selected snapshot'
              : 'This assignment language is not supported by Judge0'
            : 'Judge0 is not available in this build'
        }
      >
        <Play size={13} /> {running ? 'Running…' : 'Run test cases'}
      </button>

      {error && <div className="grade-error">{error}</div>}

      {results.length > 0 && (
        <>
          <div className="test-summary">
            {passed} / {results.length} passed
          </div>
          <div className="test-results">
            {testCases.map((testCase) => {
              const result = results.find((item) => item.testCaseId === testCase.id)
              if (!result) return null
              return (
                <div
                  key={testCase.id}
                  className={`test-row ${result.pass ? 'test-pass' : 'test-fail'}`}
                >
                  <div className="test-row-head">
                    <span>Case {testCase.ordinal + 1}</span>
                    {testCase.isHidden && <span className="mini-badge">hidden</span>}
                    <span className="test-status">
                      {result.pass ? 'Pass' : 'Fail'} · {result.status}
                    </span>
                    {result.time && <span className="test-meta">{result.time}s</span>}
                    {result.memory !== null && (
                      <span className="test-meta">{Math.round(result.memory / 1024)} MB</span>
                    )}
                  </div>
                  {(result.compileOutput || result.stderr) && (
                    <pre className="test-output">{result.compileOutput || result.stderr}</pre>
                  )}
                  {!result.pass && result.stdout && (
                    <pre className="test-output">{result.stdout}</pre>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {settingsOpen && (
        <Judge0SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={(next) => setConfig(next)}
        />
      )}
    </section>
  )
}
