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
  /** Python syntax diagnostics, or null for non-Python / not analyzed yet. */
  pythonErrors?: number | null
  /** Local compiler/runtime check for the active language. */
  toolchain?: ToolchainStatus | null
}

export default function StatusBar({
  fileName,
  language,
  cursor,
  snapshotCount,
  pasteCount,
  syncStatus,
  pythonErrors = null,
  toolchain = null
}: StatusBarProps): React.ReactElement {
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
        {pythonErrors !== null && (
          <>
            <span className="status-sep" />
            <span
              className={`status-item status-python ${pythonErrors > 0 ? 'is-error' : 'is-ok'}`}
            >
              {pythonErrors > 0
                ? `${pythonErrors} syntax ${pythonErrors === 1 ? 'error' : 'errors'}`
                : 'Python OK'}
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
