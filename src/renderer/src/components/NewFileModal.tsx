import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface NewFileModalProps {
  existingNames: string[]
  onClose: () => void
  onCreate: (name: string, language: string) => void
}

/** Languages Monaco tokenizes in the bundled build (main thread). */
const LANGUAGE_OPTIONS = [
  'plaintext',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'javascript',
  'typescript',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'markdown',
  'json',
  'html',
  'css',
  'scss',
  'xml',
  'yaml',
  'sql',
  'shell'
]

/** Extension → language, mirroring VS Code's file associations. */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  cxx: 'cpp',
  go: 'go',
  h: 'cpp',
  hpp: 'cpp',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  md: 'markdown',
  php: 'php',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'shell',
  sql: 'sql',
  swift: 'swift',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'plaintext',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml'
}

const INVALID_NAME_CHARS = /[/\\:*?"<>|]/

/**
 * File > New File… dialog. The language is auto-detected from the file
 * extension but can be overridden with the dropdown. Mounted only while
 * open, so the form starts fresh every time.
 */
export default function NewFileModal({
  existingNames,
  onClose,
  onCreate
}: NewFileModalProps): React.ReactElement {
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the name field as soon as the dialog mounts.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleNameChange = (value: string): void => {
    setName(value)
    setError(null)
    const extension = value.includes('.') ? value.split('.').pop()?.toLowerCase() : undefined
    if (extension && EXTENSION_TO_LANGUAGE[extension]) {
      setLanguage(EXTENSION_TO_LANGUAGE[extension])
    }
  }

  const submit = (): void => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a file name.')
      return
    }
    if (INVALID_NAME_CHARS.test(trimmed)) {
      setError('File names cannot contain / \\ : * ? " < > |')
      return
    }
    if (existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      setError('A file with this name already exists.')
      return
    }
    onCreate(trimmed, language)
  }

  return (
    <div className="auth-overlay">
      <div className="auth-modal glass-panel">
        <header className="auth-header">
          <span className="auth-title">New File</span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          Create a new file in the lab workspace. The language is detected from the extension.
        </p>
        <div className="auth-form">
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. solver.py"
            value={name}
            spellCheck={false}
            onChange={(event) => handleNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
              if (event.key === 'Escape') onClose()
            }}
          />
          <div className="newfile-language-row">
            <label htmlFor="newfile-language">Language</label>
            <select
              id="newfile-language"
              className="newfile-select"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" onClick={submit}>
            Create File
          </button>
        </div>
      </div>
    </div>
  )
}
