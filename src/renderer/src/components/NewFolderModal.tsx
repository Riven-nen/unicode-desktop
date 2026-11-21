import { useEffect, useRef, useState } from 'react'
import { FolderPlus, X } from 'lucide-react'

interface NewFolderModalProps {
  /** Folder the new project folder will be created in. */
  parentLabel: string
  onClose: () => void
  /** Resolves an inline error message, or null on success. */
  onCreate: (name: string) => Promise<string | null>
}

const INVALID_NAME_CHARS = /[/\\:*?"<>|]/

export default function NewFolderModal({
  parentLabel,
  onClose,
  onCreate
}: NewFolderModalProps): React.ReactElement {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a folder name.')
      return
    }
    if (INVALID_NAME_CHARS.test(trimmed)) {
      setError('Folder names cannot contain / \\ : * ? " < > |')
      return
    }
    setBusy(true)
    const createError = await onCreate(trimmed)
    setBusy(false)
    if (createError) setError(createError)
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal glass-panel" onClick={(event) => event.stopPropagation()}>
        <header className="auth-header">
          <span className="auth-title">
            <FolderPlus size={14} /> New Folder
          </span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        <p className="auth-sub">
          Create a project folder inside {parentLabel}. Add HTML, CSS, JavaScript, and images inside
          it.
        </p>
        <div className="auth-form">
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. portfolio"
            value={name}
            spellCheck={false}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
              if (event.key === 'Escape') onClose()
            }}
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Creating…' : 'Create Folder'}
          </button>
        </div>
      </div>
    </div>
  )
}
