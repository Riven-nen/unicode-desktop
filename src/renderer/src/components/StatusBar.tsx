import { SYNC_STATUS_LABELS } from '../lib/syncLabels'
import type { SyncStatus } from '../types/tracker'
import type { ToolchainStatus } from '../../../shared/toolchains'

interface StatusBarProps {
  fileName: string
  language: string
  cursor: { lineNumber: number; column: number } | null
  snapshotCount: number
  pasteCount: number
  syncStatus: SyncStatus
  /** Local diagnostics count, or null for languages without a local check. */
  analysisErrors?: number | null
  /** Local compiler/runtime check for the active language. */
  toolchain?: ToolchainStatus | null
}

const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++'
}

export default function StatusBar({
  fileName,
  language,
  cursor,
  snapshotCount,
  pasteCount,
  syncStatus,
  analysisErrors = null,
  toolchain = null
}: StatusBarProps): React.ReactElement {
  const analysisLabel = LANGUAGE_LABELS[language] ?? language
  // Java/C/C++ fall back to parser-only checks when the compiler is missing;
  // say so instead of implying a full compile succeeded.
  const parserOnly =
    toolchain?.required === true &&
    !toolchain.available &&
    (language === 'java' || language === 'c' || language === 'cpp')
  return (
    <footer className="status-bar">
      <div className="status-bar-group">
        <span className="status-item status-file">{fileName}</span>
        <span className="status-sep" />
        <span className="status-item">{language}</span>
        {toolchain?.required && (
          <>
            <span className="status-sep" />
            <span
              className={`status-item status-toolchain ${
                toolchain.available ? 'is-ok' : 'is-missing'
              }`}
              title={
                toolchain.available
                  ? `Found: ${toolchain.found.join(', ')}`
                  : `Missing: ${toolchain.missing.join(', ')}`
              }
            >
              {toolchain.label} {toolchain.available ? 'ready' : 'missing'}
            </span>
          </>
        )}
        {analysisErrors !== null && (
          <>
            <span className="status-sep" />
            <span
              className={`status-item status-analysis ${analysisErrors > 0 ? 'is-error' : 'is-ok'}`}
            >
              {analysisErrors > 0
                ? `${analysisErrors} ${analysisLabel}${parserOnly ? ' syntax' : ''} ${
                    analysisErrors === 1 ? 'error' : 'errors'
                  }`
                : `${analysisLabel}${parserOnly ? ' syntax' : ''} OK`}
            </span>
          </>
        )}
        {cursor && (
          <>
            <span className="status-sep" />
            <span className="status-item">
              Ln {cursor.lineNumber}, Col {cursor.column}
            </span>
          </>
        )}
      </div>
      <div className="status-bar-group">
        <span className="status-item">
          {snapshotCount} snapshot{snapshotCount === 1 ? '' : 's'}
        </span>
        <span className="status-item status-paste">
          {pasteCount} paste{pasteCount === 1 ? '' : 's'}
        </span>
        <span className="status-sep" />
        <span className={`status-item status-sync-${syncStatus}`}>
          {SYNC_STATUS_LABELS[syncStatus]}
        </span>
      </div>
    </footer>
  )
}
