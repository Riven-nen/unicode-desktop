import { useEffect } from 'react'
import { X } from 'lucide-react'
import { version } from '../../../../package.json'

interface HelpModalProps {
  mode: 'shortcuts' | 'about' | null
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'Ctrl+N', label: 'New file' },
  { keys: 'Ctrl+S', label: 'Save snapshot' },
  { keys: 'Ctrl+Shift+P', label: 'Command palette' },
  { keys: 'Ctrl+P', label: 'Quick open (files and commands)' },
  { keys: 'Ctrl+Z', label: 'Undo' },
  { keys: 'Ctrl+Shift+Z', label: 'Redo' },
  { keys: 'Ctrl+X', label: 'Cut' },
  { keys: 'Ctrl+C', label: 'Copy' },
  { keys: 'Ctrl+V', label: 'Paste' },
  { keys: 'Ctrl+F', label: 'Find' },
  { keys: 'Ctrl+H', label: 'Replace' },
  { keys: 'Ctrl+/', label: 'Toggle line comment' },
  { keys: 'Ctrl+A', label: 'Select all' },
  { keys: 'Alt+Z', label: 'Toggle word wrap' }
]

/**
 * Help > Keyboard Shortcuts… / About Unicode Lab dialog. Mounted only
 * while a mode is active, so it starts fresh every time.
 */
export default function HelpModal({ mode, onClose }: HelpModalProps): React.ReactElement | null {
  // Escape closes, matching the menu/dialog behavior elsewhere.
  useEffect(() => {
    if (!mode) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mode, onClose])

  if (!mode) return null

  return (
    <div className="auth-overlay">
      <div className="auth-modal glass-panel help-modal">
        <header className="auth-header">
          <span className="auth-title">
            {mode === 'shortcuts' ? 'Keyboard Shortcuts' : 'About Unicode Lab'}
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>

        {mode === 'shortcuts' ? (
          <div className="shortcut-list">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.label} className="shortcut-row">
                <span className="shortcut-label">{shortcut.label}</span>
                <span className="shortcut-keys">
                  {shortcut.keys.split('+').map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="about-body">
            <div className="about-logo">
              <div className="logo-icon"></div>
              <span className="about-name">Unicode Lab</span>
            </div>
            <p className="auth-sub">Version {version}</p>
            <p className="auth-sub">
              A code lab for programming coursework with time-travel snapshots, paste analytics, and
              academic-integrity review built in.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
