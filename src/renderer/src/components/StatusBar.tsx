import { SYNC_STATUS_LABELS } from '../lib/syncLabels'
import type { SyncStatus } from '../types/tracker'

interface StatusBarProps {
  fileName: string
  language: string
  cursor: { lineNumber: number; column: number } | null
  snapshotCount: number
  pasteCount: number
  syncStatus: SyncStatus
}

export default function StatusBar({
  fileName,
  language,
  cursor,
  snapshotCount,
  pasteCount,
  syncStatus
}: StatusBarProps): React.ReactElement {
  return (
    <footer className="status-bar">
      <div className="status-bar-group">
        <span className="status-item status-file">{fileName}</span>
        <span className="status-sep" />
        <span className="status-item">{language}</span>
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
