import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'

/**
 * Custom window controls for the frameless Electron window, drawn in the
 * top bar so they match the active theme. Hidden on macOS, which keeps its
 * native traffic lights. The preload API is injected before this module
 * evaluates, so support can be decided synchronously at first render.
 */
export default function TitleBarControls(): React.ReactElement | null {
  const [visible] = useState(() => Boolean(window.api?.window) && window.api.platform !== 'darwin')
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const controls = window.api?.window
    if (!controls) return
    void controls.isMaximized().then(setMaximized)
    return controls.onMaximizeChange(setMaximized)
  }, [])

  if (!visible) return null

  return (
    <div className="window-controls">
      <button
        className="window-control"
        onClick={() => window.api.window.minimize()}
        title="Minimize"
      >
        <Minus size={13} />
      </button>
      <button
        className="window-control"
        onClick={() => window.api.window.toggleMaximize()}
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy size={11} /> : <Square size={11} />}
      </button>
      <button
        className="window-control close"
        onClick={() => window.api.window.close()}
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  )
}
