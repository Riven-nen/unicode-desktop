import { useMemo, useState } from 'react'
import type { SnapshotEntry } from '../../types/professor'

const TYPE_LABEL: Record<SnapshotEntry['type'], string> = {
  auto: 'Auto',
  paste: 'Paste',
  manual: 'Manual',
  restore: 'Restore'
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatFull = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

interface SnapshotTimelineProps {
  snapshots: SnapshotEntry[]
  selectedId: string | null
  onSelect: (snapshotId: string) => void
}

export default function SnapshotTimeline({
  snapshots,
  selectedId,
  onSelect
}: SnapshotTimelineProps): React.ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const nodes = useMemo(() => {
    if (snapshots.length === 0) return []
    const times = snapshots.map((snapshot) => Date.parse(snapshot.createdAt))
    const min = Math.min(...times)
    const span = Math.max(...times) - min || 1

    return snapshots.map((snapshot, index) => {
      const pct = snapshots.length === 1 ? 0.5 : (Date.parse(snapshot.createdAt) - min) / span
      return {
        snapshot,
        x: 40 + pct * 720,
        delta:
          index === 0 ? snapshot.charCount : snapshot.charCount - snapshots[index - 1].charCount
      }
    })
  }, [snapshots])

  const hovered = nodes.find((node) => node.snapshot.id === hoveredId)

  return (
    <section className="snapshot-panel">
      <header className="panel-head">
        <h3>Timeline</h3>
        <span className="panel-meta">{snapshots.length} snapshots</span>
      </header>

      {snapshots.length === 0 ? (
        <div className="professor-empty">No snapshots recorded.</div>
      ) : (
        <div className="snapshot-rail">
          <svg
            viewBox="0 0 800 84"
            className="snapshot-svg"
            role="img"
            aria-label="Snapshot timeline"
          >
            <line x1="40" y1="42" x2="760" y2="42" className="snapshot-line" />
            {nodes.map((node) => (
              <g
                key={node.snapshot.id}
                tabIndex={0}
                role="button"
                aria-label={`${TYPE_LABEL[node.snapshot.type]} snapshot at ${formatFull(node.snapshot.createdAt)}`}
                className={`snapshot-node snapshot-${node.snapshot.type} ${
                  selectedId === node.snapshot.id ? 'selected' : ''
                }`}
                onMouseEnter={() => setHoveredId(node.snapshot.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(node.snapshot.id)}
                onBlur={() => setHoveredId(null)}
                onClick={() => onSelect(node.snapshot.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(node.snapshot.id)
                  }
                }}
              >
                <circle
                  cx={node.x}
                  cy="42"
                  r={selectedId === node.snapshot.id ? 9 : 6}
                  className="snapshot-circle"
                />
              </g>
            ))}
          </svg>

          {hovered && (
            <div
              className="snapshot-tooltip"
              style={{ left: `${(hovered.x / 800) * 100}%` }}
              role="status"
            >
              <strong>
                {TYPE_LABEL[hovered.snapshot.type]} · {formatFull(hovered.snapshot.createdAt)}
              </strong>
              <span>
                {hovered.delta >= 0 ? '+' : ''}
                {hovered.delta} chars
              </span>
              {hovered.snapshot.pasteDetectedVia && (
                <span>
                  Detected via {hovered.snapshot.pasteDetectedVia} · {hovered.snapshot.pasteChars}{' '}
                  pasted
                </span>
              )}
            </div>
          )}

          <div className="snapshot-foot">
            <span>{formatTime(snapshots[0].createdAt)}</span>
            <span>{formatTime(snapshots[snapshots.length - 1].createdAt)}</span>
          </div>
        </div>
      )}
    </section>
  )
}
