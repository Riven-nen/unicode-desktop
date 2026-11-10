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
  },
  {
    id: 'dracula',
    label: 'Dracula',
    description: 'Purple horror classic',
    colors: {
      'bg-base': '#282a36',
      'bg-panel': 'rgba(40, 42, 54, 0.6)',
      'bg-header': '#21222c',
      'bg-terminal': '#191a21',
      'search-bg': '#1f2029',
      border: 'rgba(248, 248, 242, 0.08)',
      hover: 'rgba(248, 248, 242, 0.05)',
      'text-main': '#f8f8f2',
      'text-muted': '#6272a4',
      accent: '#bd93f9',
      paste: '#f1fa8c',
      restore: '#50fa7b',
      success: '#50fa7b',
      error: '#ff5555',
      'terminal-green': '#50fa7b',
      'terminal-blue': '#8be9fd'
    },
    swatch: { bg: '#282a36', accent: '#bd93f9', text: '#f8f8f2' },
    monacoBase: 'vs-dark',
    monacoTokens: {
      comment: '#6272a4',
      keyword: '#ff79c6',
      string: '#f1fa8c',
      number: '#bd93f9'
    }
  },
  {
    id: 'mocha',
    label: 'Mocha',
    description: 'Catppuccin soft pastels',
    colors: {
      'bg-base': '#1e1e2e',
      'bg-panel': 'rgba(30, 30, 46, 0.6)',
      'bg-header': '#181825',
      'bg-terminal': '#11111b',
      'search-bg': '#15151e',
      border: 'rgba(205, 214, 244, 0.1)',
      hover: 'rgba(205, 214, 244, 0.06)',
      'text-main': '#cdd6f4',
      'text-muted': '#7f849c',
      accent: '#b4befe',
      paste: '#f9e2af',
      restore: '#a6e3a1',
      success: '#a6e3a1',
      error: '#f38ba8',
      'terminal-green': '#a6e3a1',
      'terminal-blue': '#89b4fa'
    },
    swatch: { bg: '#1e1e2e', accent: '#b4befe', text: '#cdd6f4' },
    monacoBase: 'vs-dark',
    monacoTokens: {
      comment: '#6c7086',
      keyword: '#cba6f7',
      string: '#a6e3a1',
      number: '#fab387'
    }
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    description: 'Neon skyline at 2am',
    colors: {
      'bg-base': '#1a1b26',
      'bg-panel': 'rgba(26, 27, 38, 0.6)',
      'bg-header': '#16161e',
      'bg-terminal': '#101014',
      'search-bg': '#13131a',
      border: 'rgba(192, 202, 245, 0.1)',
      hover: 'rgba(192, 202, 245, 0.06)',
      'text-main': '#c0caf5',
      'text-muted': '#565f89',
      accent: '#7aa2f7',
      paste: '#e0af68',
      restore: '#9ece6a',
      success: '#9ece6a',
      error: '#f7768e',
      'terminal-green': '#9ece6a',
      'terminal-blue': '#7dcfff'
    },
    swatch: { bg: '#1a1b26', accent: '#7aa2f7', text: '#c0caf5' },
    monacoBase: 'vs-dark',
    monacoTokens: {
      comment: '#565f89',
      keyword: '#bb9af7',
      string: '#9ece6a',
      number: '#ff9e64'
    }
  },
  {
    id: 'gruvbox',
    label: 'Gruvbox',
    description: 'Retro groove, warm and earthy',
    colors: {
      'bg-base': '#282828',
      'bg-panel': 'rgba(40, 40, 40, 0.6)',
      'bg-header': '#3c3836',
      'bg-terminal': '#1d2021',
      'search-bg': '#232323',
      border: 'rgba(235, 219, 178, 0.1)',
      hover: 'rgba(235, 219, 178, 0.06)',
      'text-main': '#ebdbb2',
      'text-muted': '#928374',
      accent: '#83a598',
      paste: '#fabd2f',
      restore: '#b8bb26',
      success: '#b8bb26',
      error: '#fb4934',
      'terminal-green': '#b8bb26',
      'terminal-blue': '#83a598'
    },
    swatch: { bg: '#282828', accent: '#fabd2f', text: '#ebdbb2' },
    monacoBase: 'vs-dark',
    monacoTokens: {
      comment: '#928374',
      keyword: '#fb4934',
      string: '#b8bb26',
      number: '#d3869b'
    }
  }
]

function stripHash(color: string): string {
  return color.startsWith('#') ? color.slice(1) : color
}

function hexByte(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)))
  return clamped.toString(16).padStart(2, '0')
}

/**
 * Normalizes a palette color into the only format Monaco can parse: hex
 * (#RGB, #RGBA, #RRGGBB or #RRGGBBAA). Monaco's Color.fromHex silently
 * falls back to pure red (`Color.red`) for anything else — rgba() values
 * used to turn the editor's line highlight and scrollbar bright red.
 * Accepts CSS hex, `rgb()` and `rgba()` strings. `alphaHex` only applies to
 * colors that don't already carry their own alpha.
 */
function monacoColor(color: string, alphaHex = 'ff'): string {
  const rgba = color.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/i
  )
  if (rgba) {
    const a =
      rgba[4] === undefined
        ? 1
        : rgba[4].endsWith('%')
          ? parseFloat(rgba[4]) / 100
          : parseFloat(rgba[4])
    return (
      '#' +
      hexByte(parseFloat(rgba[1])) +
      hexByte(parseFloat(rgba[2])) +
      hexByte(parseFloat(rgba[3])) +
      hexByte(a * 255)
    )
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}${alphaHex}`
  }
  if (/^#[0-9a-f]{4}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}${color[4]}${color[4]}`
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return alphaHex === 'ff' ? color : `${color}${alphaHex}`
  }
  return color
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
        'editor.background': monacoColor(c['bg-base']),
        'editor.foreground': monacoColor(c['text-main']),
        'editorGutter.background': monacoColor(c['bg-base']),
        'editorLineNumber.foreground': monacoColor(c['text-muted']),
        'editorLineNumber.activeForeground': monacoColor(c['accent']),
        'editorCursor.foreground': monacoColor(c['accent']),
        'editor.selectionBackground': monacoColor(c['accent'], '4d'),
        'editor.lineHighlightBackground': monacoColor(c['hover']),
        'editorBracketMatch.background': monacoColor(c['accent'], '33'),
        'editorBracketMatch.border': monacoColor(c['accent']),
        'editorWidget.background': monacoColor(c['bg-header']),
        'editorWidget.border': monacoColor(c['border']),
        'editorSuggestWidget.selectedBackground': monacoColor(c['accent'], '33'),
        'diffEditor.insertedTextBackground': monacoColor(c['restore'], '26'),
        'diffEditor.removedTextBackground': monacoColor(c['error'], '26'),
        'scrollbarSlider.background': monacoColor(c['hover']),
        'scrollbarSlider.hoverBackground': monacoColor(c['border'])
      }
    })
  }
}
