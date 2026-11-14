import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ProfessorModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}

export default function ProfessorModal({
  title,
  onClose,
  children,
  wide = false
}: ProfessorModalProps): React.ReactElement {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="auth-overlay">
      <div
        className={`auth-modal glass-panel professor-modal ${wide ? 'professor-modal-wide' : ''}`}
      >
        <header className="auth-header">
          <span className="auth-title">{title}</span>
          <button className="diff-close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
