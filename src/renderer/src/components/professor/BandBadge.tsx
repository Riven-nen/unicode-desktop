import type { IcsBand } from '../../types/professor'

const LABELS: Record<IcsBand, string> = {
  pass: 'Pass',
  review: 'Review',
  flag: 'Flag'
}

export default function BandBadge({ band }: { band: IcsBand | null }): React.ReactElement {
  if (!band) return <span className="band-badge band-none">No score</span>
  return <span className={`band-badge band-${band}`}>{LABELS[band]}</span>
}
