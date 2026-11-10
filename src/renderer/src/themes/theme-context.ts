import { createContext } from 'react'
import type { ThemeDefinition } from './themes'

export interface ThemeContextValue {
  theme: ThemeDefinition
  setTheme: (id: string) => void
  /** Monaco theme id matching the active app theme. */
  monacoTheme: string
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
