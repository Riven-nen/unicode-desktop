// Code fonts shipped with the app (see fonts.css for the @font-face rules).
// Each definition is selectable in the Appearance panel; the chosen font
// drives Monaco, the terminal, and every code-ish surface via the
// --code-font CSS variable.

export interface FontDefinition {
  id: string
  label: string
  description: string
  /** CSS font-family stack — used directly by Monaco and CSS. */
  family: string
  /** Whether the font ships programming ligatures (=>, !==, ->). */
  ligatures: boolean
}

export const FONTS: FontDefinition[] = [
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    description: 'Tall x-height, crisp curves — the modern default',
    family: "'JetBrains Mono', ui-monospace, Consolas, monospace",
    ligatures: true
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    description: 'The classic ligature font',
    family: "'Fira Code', ui-monospace, Consolas, monospace",
    ligatures: true
  },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    description: "Microsoft's terminal font with soft curves",
    family: "'Cascadia Code', ui-monospace, Consolas, monospace",
    ligatures: true
  },
  {
    id: 'victor-mono',
    label: 'Victor Mono',
    description: 'Slender with a cursive italic',
    family: "'Victor Mono', ui-monospace, Consolas, monospace",
    ligatures: true
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    description: 'Corporate charm, distinctive capitals',
    family: "'IBM Plex Mono', ui-monospace, Consolas, monospace",
    ligatures: false
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    description: "Adobe's quiet, spacious workhorse",
    family: "'Source Code Pro', ui-monospace, Consolas, monospace",
    ligatures: false
  }
]

export const DEFAULT_FONT_ID = 'jetbrains-mono'

export const FONT_SIZE_MIN = 11
export const FONT_SIZE_MAX = 20
export const DEFAULT_FONT_SIZE = 14
