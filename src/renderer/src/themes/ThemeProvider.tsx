import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { THEMES } from './themes'
import { ThemeContext } from './theme-context'

const STORAGE_KEY = 'unicode.theme'

function getInitialThemeId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && THEMES.some((theme) => theme.id === stored)) return stored
  } catch {
    // localStorage unavailable — fall back to the default theme
  }
  return THEMES[0].id
}

/**
 * Applies theme colors to CSS custom properties on <html>. This is the only
 * place colors are injected; every component consumes them via var(--...),
 * so switching themes instantly restyles the whole UI.
 */
export function ThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [themeId, setThemeId] = useState(getInitialThemeId)

  const theme = useMemo(
    () => THEMES.find((candidate) => candidate.id === themeId) ?? THEMES[0],
    [themeId]
  )

  useEffect(() => {
    const root = document.documentElement
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(`--${key}`, value)
    }
    root.dataset.theme = theme.id
  }, [theme])

  const setTheme = useMemo(
    () =>
      (id: string): void => {
        setThemeId(id)
        try {
          localStorage.setItem(STORAGE_KEY, id)
        } catch {
          // Persistence is best-effort
        }
      },
    []
  )

  const value = useMemo(
    () => ({ theme, setTheme, monacoTheme: `unicode-${theme.id}` }),
    [theme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
