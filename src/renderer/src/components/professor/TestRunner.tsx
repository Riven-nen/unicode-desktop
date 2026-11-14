import { useState } from 'react'
import { Play } from 'lucide-react'
import { isJudge0Configured, runTestCases } from '../../lib/judge0'
import type { Judge0CaseResult } from '../../lib/judge0'
import type { TestCaseEntry } from '../../types/professor'

interface TestRunnerProps {
  source: string
  language: string | null
  testCases: TestCaseEntry[]
}

export default function TestRunner({
  source,
  language,
  testCases
}: TestRunnerProps): React.ReactElement {
  const [results, setResults] = useState<Judge0CaseResult[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passed = results.filter((result) => result.pass).length

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    setResults([])
    try {
      setResults(await runTestCases({ source, language, testCases }))
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Could not run the test cases.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="test-runner">
      <header className="panel-head">
        <h3>Test cases</h3>
        <span className="panel-meta">{testCases.length} cases</span>
      </header>

      {!isJudge0Configured && (
        <p className="ics-note">
          Judge0 is not configured. Set <code>VITE_JUDGE0_URL</code> (and optionally{' '}
          <code>VITE_JUDGE0_KEY</code>) to run tests.
        </p>
      )}

      <button
        className="btn-primary"
        onClick={() => void run()}
        disabled={running || !isJudge0Configured || testCases.length === 0}
        title={
          isJudge0Configured
            ? 'Run every test case against the selected snapshot'
            : 'Configure VITE_JUDGE0_URL to enable Judge0'
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
                  </div>
                  {(result.compileOutput || result.stderr) && (
                    <pre className="test-output">{result.compileOutput || result.stderr}</pre>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
