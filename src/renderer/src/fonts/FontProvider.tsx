import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_FONT_ID, DEFAULT_FONT_SIZE, FONT_SIZE_MAX, FONT_SIZE_MIN, FONTS } from './fonts'
import { preloadCodeFonts } from './fontLoading'
import { FontContext } from './font-context'

const STORAGE_KEYS = {
  font: 'unicode.font',
  size: 'unicode.fontSize',
  ligatures: 'unicode.ligatures'
} as const

function clampSize(value: number): number {
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(value)))
}

function getInitialFontId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.font)
    if (stored && FONTS.some((font) => font.id === stored)) return stored
  } catch {
    // localStorage unavailable — fall back to the default font
  }
  return DEFAULT_FONT_ID
}

function getInitialFontSize(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.size)
    if (stored !== null) {
      const parsed = parseInt(stored, 10)
      if (!Number.isNaN(parsed)) return clampSize(parsed)
    }
  } catch {
    // Persistence is best-effort
  }
  return DEFAULT_FONT_SIZE
}

function getInitialLigatures(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ligatures)
    // Default on: the default font ships ligatures.
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

/**
 * Owns the editor typography settings (font, size, ligatures) and applies
 * them as CSS custom properties on <html> so every code surface
 * (Monaco, terminal, status bar, diffs) follows instantly.
 */
export function FontProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [fontId, setFontId] = useState(getInitialFontId)
  const [fontSize, setFontSizeState] = useState(getInitialFontSize)
  const [ligatures, setLigaturesState] = useState(getInitialLigatures)

  const font = useMemo(
    () => FONTS.find((candidate) => candidate.id === fontId) ?? FONTS[0],
    [fontId]
  )

  // Ligatures are a no-op (and misleading) for fonts without any.
  const effectiveLigatures = ligatures && font.ligatures

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--code-font', font.family)
    root.style.setProperty('--code-font-size', `${fontSize}px`)
  }, [font, fontSize])

  // Fetch every bundled code font up front (they would otherwise download
  // lazily on first use, racing Monaco's font measurement; see fontLoading.ts).
  useEffect(() => {
    preloadCodeFonts()
  }, [])

  const setFont = useCallback((id: string): void => {
    setFontId(id)
    try {
      localStorage.setItem(STORAGE_KEYS.font, id)
    } catch {
      // Persistence is best-effort
    }
  }, [])

  const setFontSize = useCallback((size: number): void => {
    const clamped = clampSize(size)
    setFontSizeState(clamped)
    try {
      localStorage.setItem(STORAGE_KEYS.size, String(clamped))
    } catch {
      // Persistence is best-effort
    }
  }, [])

  const setLigatures = useCallback((enabled: boolean): void => {
    setLigaturesState(enabled)
    try {
      localStorage.setItem(STORAGE_KEYS.ligatures, String(enabled))
    } catch {
      // Persistence is best-effort
    }
  }, [])

  const value = useMemo(
    () => ({
      font,
      setFont,
      fontSize,
      setFontSize,
      ligatures: effectiveLigatures,
      setLigatures
    }),
    [font, setFont, fontSize, setFontSize, effectiveLigatures, setLigatures]
  )

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>
}
