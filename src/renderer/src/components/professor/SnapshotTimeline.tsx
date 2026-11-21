import { useEffect, useMemo, useRef } from 'react'
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
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const nodes = useMemo(
    () =>
      snapshots.map((snapshot, index) => ({
        snapshot,
        delta:
          index === 0 ? snapshot.charCount : snapshot.charCount - snapshots[index - 1].charCount
      })),
    [snapshots]
  )

  // Keep the selected stop visible without forcing the whole window to scroll.
  useEffect(() => {
    const container = scrollRef.current
    const selected = container?.querySelector<HTMLElement>('.snapshot-node.selected')
    if (!container || !selected) return
    const target = selected.offsetLeft + selected.offsetWidth / 2 - container.clientWidth / 2
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [selectedId])

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
          <div className="snapshot-scroll" ref={scrollRef}>
            <div className="snapshot-track">
              <span className="snapshot-track-line" aria-hidden="true" />
              {nodes.map((node) => {
                const selected = selectedId === node.snapshot.id
                const title = [
                  `${TYPE_LABEL[node.snapshot.type]} · ${formatFull(node.snapshot.createdAt)}`,
                  `${node.delta >= 0 ? '+' : ''}${node.delta} chars`,
                  node.snapshot.pasteDetectedVia
                    ? `Detected via ${node.snapshot.pasteDetectedVia} · ${node.snapshot.pasteChars} pasted`
                    : null
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <button
                    key={node.snapshot.id}
                    type="button"
                    className={`snapshot-node snapshot-${node.snapshot.type} ${
                      selected ? 'selected' : ''
                    }`}
                    title={title}
                    aria-label={`${TYPE_LABEL[node.snapshot.type]} snapshot at ${formatFull(
                      node.snapshot.createdAt
                    )}, ${node.delta >= 0 ? 'plus' : 'minus'} ${Math.abs(node.delta)} characters`}
                    aria-pressed={selected}
                    onClick={() => onSelect(node.snapshot.id)}
                  >
                    <span className="snapshot-circle" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="snapshot-foot">
            <span>{formatTime(snapshots[0].createdAt)}</span>
            <span>{formatTime(snapshots[snapshots.length - 1].createdAt)}</span>
          </div>
        </div>
      )}
    </section>
  )
}
