import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCw, Trash2 } from 'lucide-react'
import { runCommandFor } from '../lib/runCommand'
import type { ToolchainStatus } from '../../../shared/toolchains'

interface TerminalPanelProps {
  workspaceRoot: string | null
  /** Temporary run created for a professor's selected submission snapshot. */
  submissionRunId?: string | null
  filePath: string | null
  language: string
  /** Local compiler/runtime status for the active file. */
  toolchain: ToolchainStatus | null
  onRecheckToolchain: () => void
}

const MAX_OUTPUT = 220_000
// PowerShell/ConPTY can emit ANSI color sequences even through a pipe.
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g')

export default function TerminalPanel({
  workspaceRoot,
  submissionRunId = null,
  filePath,
  language,
  toolchain,
  onRecheckToolchain
}: TerminalPanelProps): React.ReactElement {
  const [output, setOutput] = useState(
    submissionRunId
      ? 'Local submission terminal\nA temporary copy of the selected snapshot was created for review.\nRuns execute with your local OS permissions, not inside the Judge0 sandbox.\n\n'
      : 'Windows PowerShell (local)\nCommands run in your workspace, outside Judge0.\n\n'
  )
  const [input, setInput] = useState('')
  const [ready, setReady] = useState(false)
  const [cwd, setCwd] = useState<string | null>(workspaceRoot)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [restartKey, setRestartKey] = useState(0)
  const outputRef = useRef<HTMLPreElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const append = useCallback((text: string): void => {
    const clean = text.replace(ANSI_PATTERN, '').replace(/\r\n/g, '\n')
    setOutput((previous) => (previous + clean).slice(-MAX_OUTPUT))
  }, [])

  useEffect(() => {
    let cancelled = false
    let unsubscribeData: (() => void) | null = null
    let unsubscribeExit: (() => void) | null = null

    // Defer the actual spawn by one task. React StrictMode mounts, cleans up,
    // and mounts again in development; starting immediately would race the
    // cleanup's stop request against the second start and kill the shell.
    const timer = setTimeout(() => {
      if (cancelled) return
      const terminal = window.api?.terminal
      if (!terminal) return

      unsubscribeData = terminal.onData(({ data }) => {
        if (!cancelled) append(data)
      })
      unsubscribeExit = terminal.onExit(({ code }) => {
        if (cancelled) return
        setReady(false)
        append(`\n[shell exited${code === null ? '' : ` with code ${code}`}]\n`)
      })

      const start = submissionRunId
        ? terminal.startSubmission(submissionRunId)
        : terminal.start(workspaceRoot)
      void start
        .then((directory) => {
          if (cancelled) return
          setCwd(directory)
          setReady(true)
        })
        .catch((error) => {
          if (cancelled) return
          append(`${error instanceof Error ? error.message : 'Could not start the shell.'}\n`)
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
      unsubscribeData?.()
      unsubscribeExit?.()
      window.api?.terminal?.stop()
    }
  }, [append, restartKey, submissionRunId, workspaceRoot])

  useEffect(() => {
    const element = outputRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [input, output])

  const execute = useCallback(
    (command: string): void => {
      const trimmed = command.trim()
      if (!trimmed || !ready) return
      setOutput((previous) => `${previous}PS> ${trimmed}\n`)
      window.api?.terminal?.write(`${trimmed}\n`)
      setHistory((previous) => [...previous.slice(-49), trimmed])
      setHistoryIndex(null)
      setInput('')
    },
    [ready]
  )

  const missingToolchain = toolchain?.required === true && !toolchain.available
  const runCommand = runCommandFor(filePath, language, toolchain, window.api.platform)

  const runFile = async (): Promise<void> => {
    if (!ready || !filePath) return
    const checked = await window.api.toolchains.check(language, true)
    if (checked.required && !checked.available) {
      append(
        `\n[run blocked] ${checked.label ?? 'Runtime'} is not installed. ` +
          `Missing: ${checked.missing.join(', ')}. ${checked.hint ?? ''}\n`
      )
      return
    }
    const command = runCommandFor(filePath, language, checked, window.api.platform)
    if (!command) {
      append(`\n[run] No local run command for ${language} files.\n`)
      return
    }
    execute(command)
  }

  const handleHistory = (direction: -1 | 1): void => {
    if (history.length === 0) return
    const current = historyIndex ?? history.length
    const next = Math.min(history.length, Math.max(0, current + direction))
    setHistoryIndex(next >= history.length ? null : next)
    setInput(next >= history.length ? '' : history[next])
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-toolbar">
        <span className="terminal-cwd" title={cwd ?? undefined}>
          {cwd ?? 'Workspace'}
        </span>
        <div className="terminal-toolbar-actions">
          {toolchain?.required && (
            <>
              <span
                className={`terminal-toolchain ${toolchain.available ? 'is-ok' : 'is-missing'}`}
                title={
                  toolchain.available
                    ? `Found: ${toolchain.found.join(', ')}`
                    : `Missing: ${toolchain.missing.join(', ')}`
                }
              >
                {toolchain.label} {toolchain.available ? 'ready' : 'missing'}
              </span>
              <button
                className="icon-text-btn"
                onClick={onRecheckToolchain}
                title="Recheck the local toolchain"
              >
                <RotateCw size={11} />
              </button>
            </>
          )}
          {runCommand && (
            <button
              className="icon-text-btn"
              onClick={() => void runFile()}
              disabled={!ready || missingToolchain}
              title={
                missingToolchain
                  ? `${toolchain?.label ?? 'Runtime'} is not installed`
                  : 'Run the active file with its local runtime'
              }
            >
              <Play size={12} /> Run file
            </button>
          )}
          <button className="icon-text-btn" onClick={() => setOutput('')} title="Clear output">
            <Trash2 size={12} /> Clear
          </button>
          <button
            className="icon-text-btn"
            onClick={() => {
              setReady(false)
              setRestartKey((value) => value + 1)
            }}
            title="Restart the PowerShell session"
          >
            <RotateCw size={12} /> Restart
          </button>
        </div>
      </div>

      <div
        className="terminal-session"
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        <pre className="terminal-output" ref={outputRef} aria-live="polite">
          {output}
          {output.endsWith('\n') ? '' : '\n'}
          <span className="terminal-prompt">PS&gt; </span>
          <span className="terminal-typed">{input}</span>
          <span className="terminal-caret" aria-hidden="true" />
        </pre>

        <input
          ref={inputRef}
          className="terminal-capture"
          value={input}
          spellCheck={false}
          disabled={!ready}
          aria-label="PowerShell input"
          autoComplete="off"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              execute(input)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              handleHistory(-1)
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              handleHistory(1)
            } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
              event.preventDefault()
              setOutput('')
            }
          }}
        />
      </div>
    </div>
  )
}
