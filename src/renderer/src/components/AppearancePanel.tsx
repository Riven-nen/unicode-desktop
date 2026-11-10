import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Palette, Plus } from 'lucide-react'
import { THEMES } from '../themes/themes'
import { useTheme } from '../themes/useTheme'
import { FONTS, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../fonts/fonts'
import { useFont } from '../fonts/useFont'

/**
 * The appearance studio: one popover for every visual setting — theme,
 * editor font (with live previews rendered in each font), font size and
 * ligatures. All choices persist and apply instantly.
 */
export default function AppearancePanel(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { font, setFont, fontSize, setFontSize, ligatures, setLigatures } = useFont()
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
    <div className="appearance-picker" ref={containerRef}>
      <button
        className="nav-icon-btn"
        onClick={() => setOpen((value) => !value)}
        title="Appearance"
      >
        <Palette size={14} />
      </button>
      {open && (
        <div className="appearance-popover glass-panel">
          <div className="appearance-section">
            <div className="appearance-label">Theme</div>
            <div className="theme-grid">
              {THEMES.map((candidate) => (
                <button
                  key={candidate.id}
                  className={`theme-card ${candidate.id === theme.id ? 'active' : ''}`}
                  onClick={() => setTheme(candidate.id)}
                  title={candidate.description}
                >
                  <span className="theme-card-swatch">
                    <span className="swatch-dot" style={{ background: candidate.swatch.bg }} />
                    <span className="swatch-dot" style={{ background: candidate.swatch.accent }} />
                    <span className="swatch-dot" style={{ background: candidate.swatch.text }} />
                  </span>
                  <span className="theme-card-label">{candidate.label}</span>
                  {candidate.id === theme.id && <Check size={11} className="theme-check" />}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-section">
            <div className="appearance-label">Editor font</div>
            <div className="font-list">
              {FONTS.map((candidate) => (
                <button
                  key={candidate.id}
                  className={`font-option ${candidate.id === font.id ? 'active' : ''}`}
                  onClick={() => setFont(candidate.id)}
                  title={candidate.description}
                >
                  <span className="font-name">{candidate.label}</span>
                  <span className="font-preview" style={{ fontFamily: candidate.family }}>
                    {'=> !== -> () {}'}
                  </span>
                  {candidate.id === font.id && <Check size={12} className="theme-check" />}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-section appearance-row">
            <div>
              <div className="appearance-label">Font size</div>
              <div className="appearance-hint">Editor, diff and terminal scale together</div>
            </div>
            <div className="size-stepper">
              <button
                className="stepper-btn"
                onClick={() => setFontSize(fontSize - 1)}
                disabled={fontSize <= FONT_SIZE_MIN}
                title="Smaller"
              >
                <Minus size={11} />
              </button>
              <span className="size-value">{fontSize}</span>
              <button
                className="stepper-btn"
                onClick={() => setFontSize(fontSize + 1)}
                disabled={fontSize >= FONT_SIZE_MAX}
                title="Larger"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          <div className="appearance-section appearance-row">
            <div>
              <div className="appearance-label">Ligatures</div>
              <div className="appearance-hint">
                {font.ligatures ? 'Join symbols like => and !==' : `${font.label} has no ligatures`}
              </div>
            </div>
            <button
              className={`toggle-switch ${ligatures ? 'on' : ''} ${font.ligatures ? '' : 'disabled'}`}
              onClick={() => setLigatures(!ligatures)}
              disabled={!font.ligatures}
              role="switch"
              aria-checked={ligatures && font.ligatures}
              title={font.ligatures ? 'Toggle ligatures' : 'Not available for this font'}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
