import {
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Clock,
  History,
  RotateCcw
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatClockTime } from '../lib/time'
import { SYNC_STATUS_HINTS, SYNC_STATUS_LABELS } from '../lib/syncLabels'
import type { CodeSnapshot, SyncStatus } from '../types/tracker'

interface TimelineRailProps {
  fileName: string
  snapshots: CodeSnapshot[]
  pasteCount: number
  syncStatus: SyncStatus
  queuedCount: number
  expanded: boolean
  onToggle: () => void
  onOpenDiff: (snapshot: CodeSnapshot) => void
  onSnapshotNow: () => void
  onSyncClick: () => void
}

const SNAPSHOT_ICONS: Record<CodeSnapshot['snapshot_type'], LucideIcon> = {
  auto: Clock,
  paste: ClipboardPaste,
  manual: Camera,
  restore: RotateCcw
}

export default function TimelineRail({
  fileName,
  snapshots,
  pasteCount,
  syncStatus,
  queuedCount,
  expanded,
  onToggle,
  onOpenDiff,
  onSnapshotNow,
  onSyncClick
}: TimelineRailProps): React.ReactElement {
  return (
    <section className={`timeline-rail ${expanded ? '' : 'collapsed'}`}>
      <header className="timeline-header">
        <History size={14} className="timeline-icon" />
        <span className="timeline-title">Time Travel</span>
        <span className="timeline-file">{fileName}</span>
        <span className="timeline-meta">
          {snapshots.length} snapshots · {pasteCount} pastes
        </span>
        <button
          className="timeline-action"
          onClick={onSnapshotNow}
          title="Capture a snapshot of the current file now"
        >
          <Camera size={12} /> Snapshot
        </button>
        <button
          className={`sync-badge status-${syncStatus}`}
          onClick={onSyncClick}
          title={SYNC_STATUS_HINTS[syncStatus]}
        >
          {SYNC_STATUS_LABELS[syncStatus]}
          {syncStatus === 'queued' && queuedCount > 0 ? ` · ${queuedCount}` : ''}
        </button>
        <button
          className="timeline-collapse"
          onClick={onToggle}
          title={expanded ? 'Collapse timeline' : 'Expand timeline'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </header>
      {expanded && (
        <div className="timeline-body">
          {snapshots.length === 0 ? (
            <div className="timeline-empty">
              Start typing — snapshots of your work will appear here
            </div>
          ) : (
            snapshots.map((snapshot, index) => {
              const older = snapshots[index + 1]
              const delta = older ? snapshot.char_count - older.char_count : snapshot.char_count
              const Icon = SNAPSHOT_ICONS[snapshot.snapshot_type]
              return (
                <button
                  key={snapshot.id}
                  className={`snapshot-chip type-${snapshot.snapshot_type}`}
                  onClick={() => onOpenDiff(snapshot)}
                  title={`${snapshot.snapshot_type} · v${snapshot.version} · ${snapshot.char_count} chars`}
                >
                  <span className="chip-top">
                    <Icon size={12} className="chip-icon" />
                    <span className="chip-time">{formatClockTime(snapshot.created_at)}</span>
                  </span>
                  <span className="chip-delta">{delta >= 0 ? `+${delta}` : delta} chars</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
