import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Gauge, RotateCcw, Save, SlidersHorizontal } from 'lucide-react'
import {
  ICS_METRIC_DEFAULTS,
  fetchIcsSettings,
  reapplyIcsSettings,
  updateIcsSettings
} from '../lib/adminQueries'
import type { IcsMetricValues, IcsSettings } from '../lib/adminQueries'

type Band = 'pass' | 'review' | 'flag'
type SliderTone = 'positive' | 'negative' | 'threshold' | 'range' | 'confidence' | 'volume'

type NumericKey = keyof IcsMetricValues
type Draft = Record<NumericKey, string>

interface FieldSpec {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  tone: SliderTone
}

const FIELD_GROUPS: Array<{ title: string; fields: FieldSpec[] }> = [
  {
    title: 'Score composition',
    fields: [
      { key: 'baseScore', label: 'Base score', min: 0, max: 100, step: 0.5, tone: 'range' },
      {
        key: 'authoredWeight',
        label: 'Authored weight',
        min: 0,
        max: 100,
        step: 1,
        tone: 'positive'
      },
      { key: 'minScore', label: 'Score floor', min: 0, max: 100, step: 0.5, tone: 'range' },
      { key: 'maxScore', label: 'Score ceiling', min: 0, max: 100, step: 0.5, tone: 'range' }
    ]
  },
  {
    title: 'Negative evidence weights',
    fields: [
      { key: 'pasteWeight', label: 'Paste', min: 0, max: 2, step: 0.05, tone: 'negative' },
      {
        key: 'transcriptionWeight',
        label: 'Transcription',
        min: 0,
        max: 2,
        step: 0.05,
        tone: 'negative'
      },
      { key: 'rhythmWeight', label: 'Rhythm', min: 0, max: 2, step: 0.05, tone: 'negative' },
      { key: 'awayWeight', label: 'Away / refocus', min: 0, max: 2, step: 0.05, tone: 'negative' },
      { key: 'similarityWeight', label: 'Similarity', min: 0, max: 2, step: 0.05, tone: 'negative' }
    ]
  },
  {
    title: 'Bands and evidence floor',
    fields: [
      {
        key: 'passThreshold',
        label: 'Pass threshold',
        min: 0,
        max: 100,
        step: 0.5,
        tone: 'threshold'
      },
      {
        key: 'reviewThreshold',
        label: 'Review threshold',
        min: 0,
        max: 100,
        step: 0.5,
        tone: 'threshold'
      },
      {
        key: 'passMinChars',
        label: 'Pass minimum characters',
        min: 0,
        max: 100000,
        step: 10,
        tone: 'volume'
      },
      {
        key: 'minConfidence',
        label: 'Minimum confidence',
        min: 0,
        max: 1,
        step: 0.01,
        tone: 'confidence'
      }
    ]
  }
]

const NUMERIC_KEYS = FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.key))
const FIELD_BY_KEY = new Map(
  FIELD_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, field] as const))
)

const toDraft = (values: IcsMetricValues): Draft =>
  Object.fromEntries(NUMERIC_KEYS.map((key) => [key, String(values[key])])) as Draft

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const formatPoints = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)

const formatValue = (key: NumericKey, value: number): string => {
  switch (key) {
    case 'authoredWeight':
    case 'baseScore':
    case 'minScore':
    case 'maxScore':
    case 'passThreshold':
    case 'reviewThreshold':
      return `${formatPoints(value)} pts`
    case 'passMinChars':
      return `${Math.round(value)} chars`
    case 'minConfidence':
      return `${Math.round(value * 100)}%`
    default:
      return `${value.toFixed(2)}×`
  }
}

/**
 * The hint under each slider is intentionally value-aware. Moving a slider
 * should explain the practical consequence, not just repeat its label.
 */
const describeValue = (key: NumericKey, value: number, values: IcsMetricValues): string => {
  switch (key) {
    case 'baseScore':
      if (value <= 20)
        return 'A very low start. Most work needs strong authored evidence to reach Review.'
      if (value <= 40) return 'A cautious starting point below the midpoint.'
      if (value <= 55) return 'Neutral start: no evidence keeps the score near the middle.'
      if (value <= 70) return 'A forgiving start above the midpoint.'
      return 'A high start. Even weak evidence may land near Review.'
    case 'authoredWeight':
      if (value === 0) return 'Authored evidence is ignored. The score can only move down.'
      if (value < 20) return 'Authored evidence has a small positive influence.'
      if (value < 40) return 'Authored evidence has a moderate positive influence.'
      if (value < 55)
        return 'Balanced. Authored work can lift a score from the base into Review or Pass.'
      if (value < 75) return 'Strong reward for corrections, reworks, and revisits.'
      return 'Dominant. Authored evidence can overwhelm most negative signals.'
    case 'minScore':
      if (value <= 5)
        return 'Very low floor. Strong negative evidence can push a score almost to zero.'
      if (value <= 15) return 'Low floor. Flag bands can still reach very low scores.'
      if (value <= 30) return 'Moderate floor. Even weak work keeps some points.'
      return 'High floor. The final score can never fall below this value.'
    case 'maxScore':
      if (value < 80) return 'Ceiling below the pass threshold. A pass may be impossible.'
      if (value < 95) return 'Capped ceiling. Perfect evidence cannot reach 95.'
      if (value <= 95) return 'The shipped ceiling. Authored evidence can reach 95.'
      return 'Above the shipped ceiling. Allows scores up to this value.'
    case 'pasteWeight':
      if (value === 0) return 'Paste is not penalized.'
      if (value < 0.4) return 'Light paste penalty. A paste-heavy session still keeps most points.'
      if (value < 0.8) return 'Moderate paste penalty.'
      if (value <= 1) return 'Standard paste penalty.'
      if (value < 1.5) return 'Strong paste penalty. Novel paste visibly drags a score down.'
      return 'Very strong paste penalty. Novel paste can dominate the final score.'
    case 'transcriptionWeight':
      if (value === 0) return 'Line-chunk transcription is not penalized.'
      if (value < 0.4)
        return 'Light transcription penalty. A line-chunk pattern only slightly lowers the score.'
      if (value < 0.8) return 'Moderate transcription penalty.'
      if (value <= 1) return 'Standard transcription penalty.'
      if (value < 1.5) return 'Strong transcription penalty. Hand-copied chunks weigh heavily.'
      return 'Very strong transcription penalty.'
    case 'rhythmWeight':
      if (value === 0) return 'Robotic rhythm is ignored.'
      if (value < 0.3) return 'Small rhythm penalty. Rhythm alone will barely move the score.'
      if (value < 0.7) return 'Moderate rhythm penalty.'
      if (value < 1.2) return 'Strong rhythm penalty.'
      return 'Very strong rhythm penalty.'
    case 'awayWeight':
      if (value === 0) return 'Away/refocus patterns are ignored.'
      if (value < 0.4) return 'Light refocus penalty.'
      if (value < 0.8) return 'Moderate refocus penalty.'
      if (value < 1.2) return 'Strong refocus penalty.'
      return 'Very strong refocus penalty.'
    case 'similarityWeight':
      if (value === 0) return 'Cross-submission similarity is ignored.'
      if (value < 0.4) return 'Light similarity penalty.'
      if (value < 0.8) return 'Moderate similarity penalty.'
      if (value <= 1) return 'Standard similarity penalty.'
      return 'Strong similarity penalty.'
    case 'passThreshold':
      if (value < 60)
        return `Low pass bar. Scores of ${formatPoints(value)}+ can pass with enough evidence.`
      if (value < 75) return `Moderately low pass bar at ${formatPoints(value)}+.`
      if (value <= 85)
        return `The shipped pass bar. ${formatPoints(value)}+ can pass with sufficient evidence volume.`
      if (value <= 95) return `Strict pass bar at ${formatPoints(value)}+.`
      return 'Very strict pass bar. Only near-perfect scores can pass.'
    case 'reviewThreshold':
      if (values.reviewThreshold >= values.passThreshold) {
        return 'Review sits above the pass threshold. Save will be blocked until the order is fixed.'
      }
      if (value < 20) return 'Only very low scores are Flag. Most work lands in Review or Pass.'
      if (value < 40)
        return `Flag below ${formatPoints(value)}. Scores from ${formatPoints(value)} to ${formatPoints(values.passThreshold)} are Review.`
      if (value <= 50) return `The shipped review bar. Below ${formatPoints(value)} is Flag.`
      if (value <= 65) return `A high review bar. Scores below ${formatPoints(value)} are Flag.`
      return 'Very high review bar. Most non-passing work becomes Flag.'
    case 'passMinChars':
      if (value === 0) return 'No character floor. A short session can pass on a high score.'
      if (value <= 100)
        return `Very small floor. A ${Math.round(value)}-character snippet can still pass.`
      if (value <= 300)
        return `The shipped floor. Sessions under ${Math.round(value)} characters cannot pass.`
      if (value <= 600) return `Stricter volume floor at ${Math.round(value)} characters.`
      return `High volume floor. Only sessions above ${Math.round(value)} characters can pass.`
    case 'minConfidence':
      if (value === 0) return 'Confidence never blocks a band.'
      if (value <= 0.2) return 'Very permissive. Almost any evidence volume can pass.'
      if (value <= 0.35)
        return `The shipped gate. Below ${Math.round(value * 100)}% confidence, the band is held at Review.`
      if (value <= 0.6)
        return `Stricter gate. Below ${Math.round(value * 100)}% confidence, the band is held at Review.`
      return 'Very strict. Most sessions stay at Review until the evidence is dense.'
  }
}

interface PreviewScenario {
  label: string
  authored: number
  paste: number
  transcription: number
  rhythm: number
  away: number
  similarity: number
  inserted: number
  confidence: number
}

const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    label: 'Authored work',
    authored: 0.9,
    paste: 0.05,
    transcription: 0.05,
    rhythm: 0,
    away: 0,
    similarity: 0,
    inserted: 1200,
    confidence: 1
  },
  {
    label: 'Mixed evidence',
    authored: 0.45,
    paste: 0.25,
    transcription: 0.2,
    rhythm: 0,
    away: 0.2,
    similarity: 0,
    inserted: 900,
    confidence: 0.8
  },
  {
    label: 'Paste-heavy',
    authored: 0.05,
    paste: 0.95,
    transcription: 0.1,
    rhythm: 0,
    away: 0.1,
    similarity: 0,
    inserted: 1200,
    confidence: 0.9
  }
]

function preview(
  values: IcsMetricValues,
  scenario: PreviewScenario
): { score: number; band: Band } {
  const eMinus = clamp(
    values.pasteWeight * scenario.paste +
      values.transcriptionWeight * scenario.transcription +
      values.rhythmWeight * scenario.rhythm +
      values.awayWeight * scenario.away +
      values.similarityWeight * scenario.similarity,
    0,
    1
  )
  const score =
    Math.round(
      clamp(
        values.baseScore + values.authoredWeight * (scenario.authored - eMinus),
        values.minScore,
        values.maxScore
      ) * 10
    ) / 10

  const transcriptionRule =
    scenario.transcription >= 0.7 && scenario.authored <= 0.15 && scenario.inserted >= 120
  const flag =
    (scenario.paste >= 0.99 && scenario.authored <= 0.01) ||
    (transcriptionRule && scenario.away >= 0.5) ||
    (scenario.similarity >= 0.9 && scenario.paste >= 0.5)
  const reviewFloor = (scenario.paste >= 0.8 && scenario.authored <= 0.2) || transcriptionRule

  let band: Band
  if (flag) band = 'flag'
  else if (reviewFloor) band = 'review'
  else if (scenario.confidence < values.minConfidence) band = 'review'
  else if (score >= values.passThreshold && scenario.inserted < values.passMinChars) band = 'review'
  else if (score >= values.passThreshold) band = 'pass'
  else if (score >= values.reviewThreshold) band = 'review'
  else band = 'flag'

  return { score, band }
}

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export default function IcsSettingsPanel(): React.ReactElement {
  const [settings, setSettings] = useState<IcsSettings | null>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft(ICS_METRIC_DEFAULTS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reapplying, setReapplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchIcsSettings()
      .then((next) => {
        if (cancelled) return
        setSettings(next)
        setDraft(toDraft(next))
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load ICS settings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const previewValues = useMemo(() => {
    const values = { ...ICS_METRIC_DEFAULTS }
    for (const key of NUMERIC_KEYS) {
      const parsed = Number(draft[key])
      if (Number.isFinite(parsed)) values[key] = parsed
    }
    return values
  }, [draft])

  const dirty = useMemo(() => {
    if (!settings) return false
    return NUMERIC_KEYS.some((key) => Number(draft[key]) !== settings[key])
  }, [draft, settings])

  const bandGraphic = useMemo(() => {
    const min = previewValues.minScore
    const max = previewValues.maxScore
    const range = Math.max(max - min, 1)
    const review = clamp(previewValues.reviewThreshold, Math.min(min, max), Math.max(min, max))
    const pass = clamp(previewValues.passThreshold, Math.min(min, max), Math.max(min, max))
    const low = Math.min(review, pass)
    const high = Math.max(review, pass)

    return {
      min,
      max,
      range,
      flag: clamp(((low - min) / range) * 100, 0, 100),
      review: clamp(((high - low) / range) * 100, 0, 100),
      pass: clamp(((max - high) / range) * 100, 0, 100),
      orderError: previewValues.reviewThreshold >= previewValues.passThreshold,
      rangeError: previewValues.minScore >= previewValues.maxScore
    }
  }, [previewValues])

  const markers = useMemo(
    () =>
      PREVIEW_SCENARIOS.map((scenario) => ({
        scenario,
        result: preview(previewValues, scenario)
      })),
    [previewValues]
  )

  const parseDraft = (): IcsMetricValues | null => {
    const values = {} as IcsMetricValues
    for (const key of NUMERIC_KEYS) {
      const parsed = Number(draft[key])
      if (!Number.isFinite(parsed)) {
        setError(`Choose a value for ${FIELD_BY_KEY.get(key)?.label ?? key}.`)
        return null
      }
      values[key] = parsed
    }
    if (values.minScore >= values.maxScore) {
      setError('The score floor must be below the ceiling.')
      return null
    }
    if (values.reviewThreshold >= values.passThreshold) {
      setError('The pass threshold must be above the review threshold.')
      return null
    }
    if (values.baseScore < 0 || values.baseScore > 100) {
      setError('The base score must be between 0 and 100.')
      return null
    }
    for (const key of [
      'authoredWeight',
      'pasteWeight',
      'transcriptionWeight',
      'rhythmWeight',
      'awayWeight',
      'similarityWeight'
    ] as const) {
      const field = FIELD_BY_KEY.get(key)
      if (field && (values[key] < field.min || values[key] > field.max)) {
        setError(`${field.label} must be between ${field.min} and ${field.max}.`)
        return null
      }
    }
    if (values.passMinChars < 0 || values.passMinChars > 100000) {
      setError('The pass minimum must be between 0 and 100000 characters.')
      return null
    }
    if (values.minConfidence < 0 || values.minConfidence > 1) {
      setError('The minimum confidence must be between 0 and 1.')
      return null
    }
    return values
  }

  const save = async (): Promise<void> => {
    const values = parseDraft()
    if (!values) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const next = await updateIcsSettings(values)
      setSettings(next)
      setDraft(toDraft(next))
      setNotice(
        `Saved version ${next.version}. Existing scores update when you re-apply or a professor recomputes.`
      )
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save ICS settings.')
    } finally {
      setSaving(false)
    }
  }

  const reapply = async (): Promise<void> => {
    if (
      !window.confirm(
        'Re-score every stored v3 submission with the current settings? Legacy v2 rows are left unchanged.'
      )
    ) {
      return
    }
    setReapplying(true)
    setError(null)
    setNotice(null)
    try {
      const count = await reapplyIcsSettings()
      setNotice(`Re-scored ${count} v3 submission${count === 1 ? '' : 's'}.`)
    } catch (reapplyError) {
      setError(
        reapplyError instanceof Error ? reapplyError.message : 'Could not re-apply ICS settings.'
      )
    } finally {
      setReapplying(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <div className="ics-settings-title">
          <h2>
            <Gauge size={14} /> ICS metric
          </h2>
          <span className="muted">Global v3 scoring · version {settings?.version ?? '—'}</span>
        </div>
        <div className="panel-tools">
          <button
            className="btn ghost"
            onClick={() => {
              setDraft(toDraft(ICS_METRIC_DEFAULTS))
              setNotice('Defaults loaded. Save to apply them.')
              setError(null)
            }}
            disabled={saving}
          >
            <RotateCcw size={13} /> Defaults
          </button>
          <button
            className="btn primary"
            onClick={() => void save()}
            disabled={saving || loading || (!dirty && Boolean(settings))}
            title={!dirty && settings ? 'No changes to save.' : undefined}
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="empty">Loading ICS settings…</div>
      ) : (
        <div className="ics-settings-body">
          {error && <div className="notice error">{error}</div>}
          {notice && <div className="notice ok">{notice}</div>}

          <div className="ics-settings-grid">
            {FIELD_GROUPS.map((group) => (
              <section className="ics-settings-group" key={group.title}>
                <h3>
                  <SlidersHorizontal size={12} /> {group.title}
                </h3>
                {group.fields.map((field) => {
                  const numeric = Number(draft[field.key])
                  const value = Number.isFinite(numeric)
                    ? clamp(numeric, field.min, field.max)
                    : field.min
                  const fill = ((value - field.min) / Math.max(field.max - field.min, 1)) * 100
                  const description = describeValue(field.key, value, previewValues)

                  return (
                    <div className="ics-slider-field" key={field.key}>
                      <div className="ics-slider-head">
                        <label htmlFor={`ics-field-${field.key}`}>{field.label}</label>
                        <span className="ics-slider-value">{formatValue(field.key, value)}</span>
                      </div>
                      <input
                        id={`ics-field-${field.key}`}
                        className={`ics-slider is-${field.tone}`}
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={value}
                        aria-label={field.label}
                        aria-valuetext={formatValue(field.key, value)}
                        style={{ '--fill': `${fill}%` } as CSSProperties}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [field.key]: event.target.value
                          }))
                        }
                      />
                      <p className="ics-slider-hint">{description}</p>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>

          <div className="ics-band-graphic">
            <div className="ics-band-graphic-head">
              <span className="eyebrow">Band map</span>
              <span className="muted">
                Flag below {formatPoints(previewValues.reviewThreshold)} · Pass at{' '}
                {formatPoints(previewValues.passThreshold)}+
              </span>
            </div>
            <div className="ics-band-strip">
              <span className="ics-band-zone is-flag" style={{ width: `${bandGraphic.flag}%` }}>
                Flag
              </span>
              <span className="ics-band-zone is-review" style={{ width: `${bandGraphic.review}%` }}>
                Review
              </span>
              <span className="ics-band-zone is-pass" style={{ width: `${bandGraphic.pass}%` }}>
                Pass
              </span>
              {markers.map(({ scenario, result }) => (
                <span
                  key={scenario.label}
                  className={`ics-band-marker is-${result.band}`}
                  style={{
                    left: `${clamp(
                      ((result.score - bandGraphic.min) / bandGraphic.range) * 100,
                      0,
                      100
                    )}%`
                  }}
                  title={`${scenario.label}: ${result.score.toFixed(1)} (${result.band})`}
                />
              ))}
            </div>
            <div className="ics-band-scale">
              <span>{formatPoints(bandGraphic.min)}</span>
              <span>{formatPoints(bandGraphic.max)}</span>
            </div>
            {bandGraphic.orderError && (
              <p className="ics-band-warning">
                Review must be below Pass. Fix the two thresholds before saving.
              </p>
            )}
            {bandGraphic.rangeError && (
              <p className="ics-band-warning">
                Score floor must be below the ceiling. Fix the range before saving.
              </p>
            )}
          </div>

          <div className="ics-preview">
            {markers.map(({ scenario, result }) => (
              <article className="ics-preview-card" key={scenario.label}>
                <span className="eyebrow">{scenario.label}</span>
                <strong>{result.score.toFixed(1)}</strong>
                <span className={`badge ics-band-${result.band}`}>{result.band}</span>
              </article>
            ))}
          </div>

          <div className="ics-settings-footer">
            <span className="muted">
              {settings
                ? `Updated ${formatDateTime(settings.updatedAt)}${
                    settings.updatedByEmail ? ` by ${settings.updatedByEmail}` : ''
                  }.`
                : 'Settings load from the admin-only row.'}
            </span>
            <button
              className="btn"
              onClick={() => void reapply()}
              disabled={reapplying || loading || dirty}
              title={dirty ? 'Save the settings before re-applying them.' : undefined}
            >
              {reapplying ? 'Re-applying…' : 'Apply to existing v3 scores'}
            </button>
          </div>

          <p className="footer-note">
            Saving changes does not rewrite history by itself. Re-applying recomputes the band from
            the stored v3 evidence ledger, so it works after snapshot retention. Legacy v2 rows keep
            their original formula.
          </p>
        </div>
      )}
    </section>
  )
}
