import { useEffect, useMemo, useState } from 'react'
import { Gauge, RotateCcw, Save, SlidersHorizontal } from 'lucide-react'
import {
  ICS_METRIC_DEFAULTS,
  fetchIcsSettings,
  reapplyIcsSettings,
  updateIcsSettings
} from '../lib/adminQueries'
import type { IcsMetricValues, IcsSettings } from '../lib/adminQueries'

type Band = 'pass' | 'review' | 'flag'

type NumericKey = keyof IcsMetricValues
type Draft = Record<NumericKey, string>

interface FieldSpec {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  hint: string
}

const FIELD_GROUPS: Array<{ title: string; fields: FieldSpec[] }> = [
  {
    title: 'Score composition',
    fields: [
      {
        key: 'baseScore',
        label: 'Base score',
        min: 0,
        max: 100,
        step: 0.5,
        hint: 'Starting point before evidence is applied.'
      },
      {
        key: 'authoredWeight',
        label: 'Authored weight',
        min: 0,
        max: 100,
        step: 1,
        hint: 'Points awarded at full authored evidence.'
      },
      {
        key: 'minScore',
        label: 'Score floor',
        min: 0,
        max: 100,
        step: 0.5,
        hint: 'Lowest score the metric can output.'
      },
      {
        key: 'maxScore',
        label: 'Score ceiling',
        min: 0,
        max: 100,
        step: 0.5,
        hint: 'Highest score the metric can output.'
      }
    ]
  },
  {
    title: 'Negative evidence weights',
    fields: [
      {
        key: 'pasteWeight',
        label: 'Paste',
        min: 0,
        max: 2,
        step: 0.05,
        hint: 'Novel paste pressure.'
      },
      {
        key: 'transcriptionWeight',
        label: 'Transcription',
        min: 0,
        max: 2,
        step: 0.05,
        hint: 'Line-chunk transcription shape.'
      },
      {
        key: 'rhythmWeight',
        label: 'Rhythm',
        min: 0,
        max: 2,
        step: 0.05,
        hint: 'Robotic or impossibly fast rhythm.'
      },
      {
        key: 'awayWeight',
        label: 'Away / refocus',
        min: 0,
        max: 2,
        step: 0.05,
        hint: 'Refocus followed by a line chunk.'
      },
      {
        key: 'similarityWeight',
        label: 'Similarity',
        min: 0,
        max: 2,
        step: 0.05,
        hint: 'Cross-submission similarity.'
      }
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
        hint: 'Score needed for a Pass band.'
      },
      {
        key: 'reviewThreshold',
        label: 'Review threshold',
        min: 0,
        max: 100,
        step: 0.5,
        hint: 'Below this score the band is Flag.'
      },
      {
        key: 'passMinChars',
        label: 'Pass minimum characters',
        min: 0,
        max: 100000,
        step: 10,
        hint: 'A short session cannot pass even with a high score.'
      },
      {
        key: 'minConfidence',
        label: 'Minimum confidence',
        min: 0,
        max: 1,
        step: 0.01,
        hint: 'Below this, the band is held at Review.'
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

  const parseDraft = (): IcsMetricValues | null => {
    const values = {} as IcsMetricValues
    for (const key of NUMERIC_KEYS) {
      const parsed = Number(draft[key])
      if (!Number.isFinite(parsed)) {
        setError(`Enter a number for ${FIELD_BY_KEY.get(key)?.label ?? key}.`)
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
                {group.fields.map((field) => (
                  <label className="ics-settings-field" key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={draft[field.key]}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    />
                    <span className="ics-field-hint">{field.hint}</span>
                  </label>
                ))}
              </section>
            ))}
          </div>

          <div className="ics-preview">
            {PREVIEW_SCENARIOS.map((scenario) => {
              const result = preview(previewValues, scenario)
              return (
                <article className="ics-preview-card" key={scenario.label}>
                  <span className="eyebrow">{scenario.label}</span>
                  <strong>{result.score.toFixed(1)}</strong>
                  <span className={`badge ics-band-${result.band}`}>{result.band}</span>
                </article>
              )
            })}
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
