import { useMemo } from 'react'
import type { SnapshotEntry } from '../../types/professor'

interface TypingHeatmapProps {
  snapshots: SnapshotEntry[]
}

interface Point {
  time: number
  iki: number
  snapshotId: string
}

const WIDTH = 360
const HEIGHT = 158
const PAD = { left: 36, right: 12, top: 12, bottom: 24 }

const medianOf = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const formatGap = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s` : `${Math.round(ms)}ms`

export default function TypingHeatmap({ snapshots }: TypingHeatmapProps): React.ReactElement {
  const points = useMemo<Point[]>(() => {
    const ordered = [...snapshots].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    const collected: Point[] = []
    for (const snapshot of ordered) {
      const intervals = snapshot.typingIntervals ?? []
      if (intervals.length === 0) continue
      let cursor = Date.parse(snapshot.createdAt)
      for (let index = intervals.length - 1; index >= 0; index -= 1) {
        collected.push({
          time: cursor,
          iki: Math.max(20, Math.min(10_000, intervals[index])),
          snapshotId: snapshot.id
        })
        cursor -= intervals[index]
      }
    }
    return collected.sort((a, b) => a.time - b.time)
  }, [snapshots])

  const stats = useMemo(() => {
    const values = points.map((point) => point.iki)
    return {
      samples: values.length,
      median: medianOf(values),
      longest: values.length > 0 ? Math.max(...values) : 0
    }
  }, [points])

  if (points.length === 0) {
    return (
      <div className="typing-heatmap-empty">
        No typing intervals were captured for this submission. New edits will populate this
        fingerprint.
      </div>
    )
  }

  const minTime = points[0].time
  const maxTime = points[points.length - 1].time
  const timeSpan = Math.max(1, maxTime - minTime)
  const maxGap = Math.max(250, ...points.map((point) => point.iki))

  const xOf = (time: number): number =>
    PAD.left + ((time - minTime) / timeSpan) * (WIDTH - PAD.left - PAD.right)
  const yOf = (iki: number): number => {
    const ratio = Math.log(Math.max(20, iki)) / Math.log(maxGap)
    return HEIGHT - PAD.bottom - ratio * (HEIGHT - PAD.top - PAD.bottom)
  }
  const medianY = yOf(stats.median)
  const ticks = [100, 500, 1000, 5000].filter((tick) => tick <= maxGap * 1.1)

  return (
    <div className="typing-heatmap">
      <div className="typing-heatmap-stats">
        <span>
          <strong>{stats.samples}</strong> intervals
        </span>
        <span>
          median <strong>{formatGap(stats.median)}</strong>
        </span>
        <span>
          longest pause <strong>{formatGap(stats.longest)}</strong>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="typing-heatmap-svg"
        role="img"
        aria-label="Typing rhythm scatter plot"
      >
        <line
          x1={PAD.left}
          y1={HEIGHT - PAD.bottom}
          x2={WIDTH - PAD.right}
          y2={HEIGHT - PAD.bottom}
          className="typing-axis"
        />
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={HEIGHT - PAD.bottom}
          className="typing-axis"
        />

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={yOf(tick)}
              x2={WIDTH - PAD.right}
              y2={yOf(tick)}
              className="typing-grid"
            />
            <text x={PAD.left - 5} y={yOf(tick) + 3} textAnchor="end" className="typing-tick">
              {formatGap(tick)}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          y1={medianY}
          x2={WIDTH - PAD.right}
          y2={medianY}
          className="typing-median"
        />
        <text x={WIDTH - PAD.right} y={medianY - 4} textAnchor="end" className="typing-tick">
          median
        </text>

        {points.map((point, index) => (
          <circle
            key={`${point.snapshotId}-${index}`}
            cx={xOf(point.time)}
            cy={yOf(point.iki)}
            r={inkRadius(point.iki, stats.median)}
            className={`typing-point ${point.iki > stats.median * 2 ? 'is-pause' : ''}`}
          >
            <title>{formatGap(point.iki)} between edits</title>
          </circle>
        ))}

        <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" className="typing-axis-label">
          time
        </text>
        <text
          x={10}
          y={PAD.top + 8}
          transform="rotate(-90 10 42)"
          textAnchor="middle"
          className="typing-axis-label"
        >
          gap between edits
        </text>
      </svg>

      <p className="typing-heatmap-note">
        Gaps between edit bursts captured with each snapshot. Tight clusters are fast typing; high
        dots are thinking pauses.
      </p>
    </div>
  )
}

function inkRadius(iki: number, median: number): number {
  if (iki > median * 3) return 3.4
  if (iki > median * 1.8) return 2.7
  return 2
}
