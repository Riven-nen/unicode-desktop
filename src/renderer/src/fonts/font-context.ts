import { createContext } from 'react'
import type { FontDefinition } from './fonts'

export interface FontContextValue {
  font: FontDefinition
  setFont: (id: string) => void
  /** Editor font size in px. */
  fontSize: number
  setFontSize: (size: number) => void
  /** Programming ligatures (=>, !==, ->), only for fonts that ship them. */
  ligatures: boolean
  setLigatures: (enabled: boolean) => void
}

export const FontContext = createContext<FontContextValue | null>(null)
