// Single source of truth for every UI color. ThemeContext applies each
// theme's colors to CSS custom properties on <html> at runtime, so all
// components pick them up through `var(--...)`. defineMonacoThemes()
// mirrors the same values into Monaco so the editor and diff views always
// match the active theme.

export interface ThemeDefinition {
  id: string
  label: string
  description: string
  /** CSS custom property name -> value, applied to documentElement. */
  colors: Record<string, string>
  /** Three preview dots for the theme picker. */
  swatch: { bg: string; accent: string; text: string }
  monacoBase: 'vs' | 'vs-dark'
  monacoTokens: { comment: string; keyword: string; string: string; number: string }
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'Default studio look',
    colors: {
      'bg-base': '#1e1f22',
      'bg-panel': 'rgba(43, 45, 48, 0.6)',
      'bg-header': '#2b2d30',
      'bg-terminal': '#18191b',
      'search-bg': '#191a1c',
      border: 'rgba(255, 255, 255, 0.08)',
      hover: 'rgba(255, 255, 255, 0.05)',
      'text-main': '#dfe1e5',
      'text-muted': '#8b8d91',
      accent: '#4c84ff',
      paste: '#e5b567',
      restore: '#6a8759',
      success: '#6a8759',
      error: '#e5484d',
      'terminal-green': '#6a8759',
      'terminal-blue': '#6897bb'
    },
    swatch: { bg: '#1e1f22', accent: '#4c84ff', text: '#dfe1e5' },
    monacoBase: 'vs-dark',
    monacoTokens: {
      comment: '#8b8d91',
      keyword: '#4c84ff',
      string: '#ce9178',
      number: '#b5cea8'
    }
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Bright classroom look',
    colors: {
      'bg-base': '#f4f5f7',
      'bg-panel': 'rgba(255, 255, 255, 0.72)',
      'bg-header': '#ffffff',
      'bg-terminal': '#fbfcfd',
      'search-bg': '#eceef2',
      border: 'rgba(16, 20, 28, 0.1)',
      hover: 'rgba(16, 20, 28, 0.05)',
      'text-main': '#25272c',
      'text-muted': '#6d7078',
      accent: '#2f6bff',
      paste: '#a06b00',
      restore: '#3f7d3f',
      success: '#3f7d3f',
      error: '#d13438',
      'terminal-green': '#3f7d3f',
      'terminal-blue': '#2b6cb0'
    },
    swatch: { bg: '#f4f5f7', accent: '#2f6bff', text: '#25272c' },
    monacoBase: 'vs',
    monacoTokens: {
      comment: '#6d7078',
      keyword: '#2f6bff',
      string: '#a31515',
      number: '#098658'
    }
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Cool arctic palette',
    colors: {
      'bg-base': '#2e3440',
      'bg-panel': 'rgba(46, 52, 64, 0.6)',
      'bg-header': '#3b4252',
      'bg-terminal': '#272c36',
      'search-bg': '#242933',
      border: 'rgba(216, 222, 232, 0.1)',
      hover: 'rgba(216, 222, 232, 0.06)',
      'text-main': '#d8dee9',
      'text-muted': '#7b88a1',
      accent: '#88c0d0',
      paste: '#ebcb8b',
      restore: '#a3be8c',
      success: '#a3be8c',
      error: '#bf616a',
      'terminal-green': '#a3be8c',
      'terminal-blue': '#81a1c1'
    },
    swatch: { bg: '#2e3440', accent: '#88c0d0', text: '#d8dee9' },
    monacoBase: 'vs-dark',
    monacoTokens: {
      comment: '#7b88a1',
      keyword: '#88c0d0',
      string: '#a3be8c',
      number: '#d08770'
    }
  },
  {
    id: 'synthwave',
    label: 'Synthwave',
    description: 'Neon purple night drive',
    colors: {
      'bg-base': '#141021',
      'bg-panel': 'rgba(34, 26, 51, 0.55)',
      'bg-header': '#221a33',
      'bg-terminal': '#0f0c1a',
      'search-bg': '#1b1529',
      border: 'rgba(199, 160, 255, 0.12)',
      hover: 'rgba(199, 160, 255, 0.06)',
      'text-main': '#efe6ff',
      'text-muted': '#9d8fc0',
      accent: '#c084fc',
      paste: '#ffd166',
      restore: '#62d2a2',
      success: '#62d2a2',
      error: '#ff5d7e',
      'terminal-green': '#62d2a2',
      'terminal-blue': '#7cc7ff'
    },
    swatch: { bg: '#141021', accent: '#c084fc', text: '#efe6ff' },
    monacoBase: 'vs-dark',
    monacoTokens: {
      comment: '#9d8fc0',
      keyword: '#ff7edb',
      string: '#5eeadf',
      number: '#ffd166'
    }
  }
]

function stripHash(color: string): string {
  return color.startsWith('#') ? color.slice(1) : color
}

/** '#rrggbb' + alpha pair -> '#rrggbbaa' (Monaco supports 8-digit hex). */
function withAlpha(color: string, alpha: string): string {
  return `${color}${alpha}`
}

/**
 * Registers one Monaco theme per app theme. Idempotent, so it is safe to
 * call from every Editor/DiffEditor `beforeMount`.
 */
export function defineMonacoThemes(monaco: typeof import('monaco-editor')): void {
  for (const theme of THEMES) {
    const c = theme.colors
    monaco.editor.defineTheme(`unicode-${theme.id}`, {
      base: theme.monacoBase,
      inherit: true,
      rules: [
        {
          token: 'comment',
          foreground: stripHash(theme.monacoTokens.comment),
          fontStyle: 'italic'
        },
        { token: 'keyword', foreground: stripHash(theme.monacoTokens.keyword) },
        { token: 'string', foreground: stripHash(theme.monacoTokens.string) },
        { token: 'number', foreground: stripHash(theme.monacoTokens.number) }
      ],
      colors: {
        'editor.background': c['bg-base'],
        'editor.foreground': c['text-main'],
        'editorGutter.background': c['bg-base'],
        'editorLineNumber.foreground': c['text-muted'],
        'editorLineNumber.activeForeground': c['accent'],
        'editorCursor.foreground': c['accent'],
        'editor.selectionBackground': withAlpha(c['accent'], '4d'),
        'editor.lineHighlightBackground': c['hover'],
        'editorBracketMatch.background': withAlpha(c['accent'], '33'),
        'editorBracketMatch.border': c['accent'],
        'editorWidget.background': c['bg-header'],
        'editorWidget.border': c['border'],
        'editorSuggestWidget.selectedBackground': withAlpha(c['accent'], '33'),
        'diffEditor.insertedTextBackground': withAlpha(c['restore'], '26'),
        'diffEditor.removedTextBackground': withAlpha(c['error'], '26'),
        'scrollbarSlider.background': c['hover'],
        'scrollbarSlider.hoverBackground': c['border']
      }
    })
  }
}
