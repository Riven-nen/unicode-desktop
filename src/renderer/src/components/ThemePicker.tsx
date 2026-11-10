import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { THEMES } from '../themes/themes'
import { useTheme } from '../themes/useTheme'

export default function ThemePicker(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="theme-picker" ref={containerRef}>
      <button
        className="nav-icon-btn"
        onClick={() => setOpen((value) => !value)}
        title="Change theme"
      >
        <Palette size={14} />
      </button>
      {open && (
        <div className="theme-popover glass-panel">
          {THEMES.map((candidate) => (
            <button
              key={candidate.id}
              className={`theme-option ${candidate.id === theme.id ? 'active' : ''}`}
              onClick={() => {
                setTheme(candidate.id)
                setOpen(false)
              }}
              title={candidate.description}
            >
              <span className="theme-swatch">
                <span className="swatch-dot" style={{ background: candidate.swatch.bg }} />
                <span className="swatch-dot" style={{ background: candidate.swatch.accent }} />
                <span className="swatch-dot" style={{ background: candidate.swatch.text }} />
              </span>
              <span className="theme-option-label">{candidate.label}</span>
              {candidate.id === theme.id && <Check size={12} className="theme-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
