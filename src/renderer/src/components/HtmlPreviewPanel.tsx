import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { dirnameOf } from '../lib/workspace'

interface HtmlPreviewPanelProps {
  /** Absolute path of the active HTML file. */
  filePath: string
  /** Reads the live Monaco model so unsaved edits preview immediately. */
  readSource: () => string | null
  /** Bumped when assets are added so an unchanged page still reloads. */
  refreshToken: number
}

/**
 * Live HTML preview backed by the main-process loopback static server. The
 * class folder is served as-is, so relative CSS/JS/images work; the active
 * HTML file itself is overlaid with the unsaved editor content.
 */
export default function HtmlPreviewPanel({
  filePath,
  readSource,
  refreshToken
}: HtmlPreviewPanelProps): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const idRef = useRef<string | null>(null)
  const contentRef = useRef<string | null>(null)
  const epochRef = useRef(0)
  const updatingRef = useRef(false)
  const sourceRef = useRef(readSource)
  const root = dirnameOf(filePath)

  useEffect(() => {
    sourceRef.current = readSource
  })

  const stop = useCallback((): void => {
    epochRef.current += 1
    const id = idRef.current
    if (!id) return
    idRef.current = null
    contentRef.current = null
    window.api.preview.stop(id)
  }, [])

  useEffect(() => {
    if (!root) return
    let cancelled = false

    const html = sourceRef.current() ?? ''
    const epoch = epochRef.current + 1
    epochRef.current = epoch

    void window.api.preview
      .startFile({ root, filePath, html })
      .then((session) => {
        if (cancelled || epochRef.current !== epoch) {
          window.api.preview.stop(session.id)
          return
        }
        idRef.current = session.id
        contentRef.current = html
        setUrl(session.url)
        setVersion((current) => current + 1)
      })
      .catch((startError) => {
        if (!cancelled && epochRef.current === epoch) {
          setError(
            startError instanceof Error ? startError.message : 'Could not start the live preview.'
          )
          setUrl(null)
        }
      })
      .finally(() => {
        if (!cancelled && epochRef.current === epoch) setBusy(false)
      })

    return () => {
      cancelled = true
      stop()
    }
  }, [root, filePath, stop])

  // Poll the live model; on a change rewrite the overlay and reload the frame.
  useEffect(() => {
    if (!url) return
    const timer = window.setInterval(() => {
      const id = idRef.current
      if (!id || updatingRef.current) return
      const next = sourceRef.current()
      if (next === null || next === contentRef.current) return
      contentRef.current = next
      updatingRef.current = true
      void window.api.preview
        .update(id, next)
        .then(() => setVersion((current) => current + 1))
        .catch((updateError) => {
          contentRef.current = null
          setError(
            updateError instanceof Error ? updateError.message : 'Could not update the preview.'
          )
        })
        .finally(() => {
          updatingRef.current = false
        })
    }, 900)
    return () => window.clearInterval(timer)
  }, [url])

  if (!root) {
    return (
      <div className="html-preview-panel">
        <div className="html-preview-error">Save this file before previewing it.</div>
      </div>
    )
  }

  return (
    <div className="html-preview-panel">
      <header className="html-preview-head">
        <span className="html-preview-title">Live preview</span>
        <span className="html-preview-url">
          {error ??
            (url ? url.replace(/^https?:\/\//, '') : busy ? 'Starting server…' : 'Preview stopped')}
        </span>
        <button
          className="icon-text-btn"
          onClick={() => {
            setVersion((current) => current + 1)
            setRefreshing(true)
            window.setTimeout(() => setRefreshing(false), 600)
          }}
          disabled={!url || busy}
          title="Reload the preview"
        >
          <RefreshCw size={11} className={refreshing ? 'is-spinning' : undefined} /> Refresh
        </button>
        <button
          className="icon-text-btn"
          onClick={() => {
            if (url) void window.api.openExternal(url)
          }}
          disabled={!url}
          title="Open in the system browser"
        >
          <ExternalLink size={11} /> Browser
        </button>
      </header>

      {error && !url ? (
        <div className="html-preview-error">{error}</div>
      ) : url ? (
        <iframe
          key={`${url}-${version}-${refreshToken}`}
          className="html-preview-frame"
          src={`${url}?v=${version}-${refreshToken}`}
          title="HTML preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="html-preview-loading">Starting local preview…</div>
      )}
    </div>
  )
}
