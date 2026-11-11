import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import type { LabFile } from '../types/tracker'

/** A runnable command surfaced by the quick-open search. */
export interface QuickOpenCommand {
  id: string
  label: string
  shortcut?: string
  icon: React.ReactNode
  run: () => void
}

interface SearchBarProps {
  files: LabFile[]
  onSelectFile: (name: string) => void
  commands: QuickOpenCommand[]
  /** Controlled from App so Ctrl+P can focus the search. */
  inputRef: React.RefObject<HTMLInputElement | null>
}

interface SearchResult {
  key: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
  /** Running index across all sections; drives keyboard navigation. */
  index: number
}

interface SearchSection {
  title: string
  items: SearchResult[]
}

/**
 * The top-bar search, wired up as a VS Code-style quick open: matching
 * files and commands in one dropdown, with arrow-key navigation. Focus it
 * with Ctrl+P, type to filter, Enter to run, Escape to dismiss.
 */
export default function SearchBar({
  files,
  onSelectFile,
  commands,
  inputRef
}: SearchBarProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter files first, then commands (both case-insensitive substring).
  const sections = useMemo<SearchSection[]>(() => {
    const q = query.trim().toLowerCase()
    const fileItems = files
      .filter((file) => file.name.toLowerCase().includes(q))
      .map((file) => ({
        key: `file:${file.name}`,
        label: file.name,
        hint: file.language,
        icon: <FileText size={13} />,
        run: () => onSelectFile(file.name)
      }))
    const commandItems = commands
      .filter((command) => command.label.toLowerCase().includes(q))
      .map((command) => ({
        key: `command:${command.id}`,
        label: command.label,
        hint: command.shortcut,
        icon: command.icon,
        run: command.run
      }))
    const groups = [
      { title: 'Files', items: fileItems },
      { title: 'Commands', items: commandItems }
    ].filter((group) => group.items.length > 0)
    // Assign each result a running index across all sections so keyboard
    // navigation (and the highlight) spans the whole list.
    const itemsBefore = (sectionIndex: number): number =>
      groups.slice(0, sectionIndex).reduce((total, group) => total + group.items.length, 0)
    return groups.map((group, sectionIndex) => ({
      title: group.title,
      items: group.items.map((item, itemIndex) => ({
        ...item,
        index: itemsBefore(sectionIndex) + itemIndex
      }))
    }))
  }, [files, commands, query, onSelectFile])

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections])
  // Keep the selection inside the (possibly shrunken) result list.
  const selection = flatItems.length === 0 ? -1 : Math.min(activeIndex, flatItems.length - 1)

  const close = (): void => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
    inputRef.current?.blur()
  }

  // Close on outside press, mirroring the menu behavior.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  })

  // Keep the highlighted row visible when navigating with the keyboard.
  useEffect(() => {
    if (selection < 0) return
    listRef.current
      ?.querySelector(`[data-index="${selection}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selection])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (flatItems.length > 0) setActiveIndex(Math.min(selection + 1, flatItems.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(Math.max(selection - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = flatItems[selection]
      if (item) {
        close()
        item.run()
      }
    } else if (event.key === 'Escape') {
      close()
    }
  }

  return (
    <div className="search-wrapper" ref={containerRef}>
      <div className="search-bar">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search files and commands…"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <div className="search-dropdown glass-panel" role="listbox" ref={listRef}>
            {sections.map((section) => (
              <Fragment key={section.title}>
                <div className="search-section-title">{section.title}</div>
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    data-index={item.index}
                    className={`search-result ${item.index === selection ? 'active' : ''}`}
                    role="option"
                    aria-selected={item.index === selection}
                    onMouseEnter={() => setActiveIndex(item.index)}
                    onClick={() => {
                      close()
                      item.run()
                    }}
                  >
                    <span className="search-result-icon">{item.icon}</span>
                    <span className="search-result-label">{item.label}</span>
                    {item.hint && <span className="search-result-hint">{item.hint}</span>}
                  </div>
                ))}
              </Fragment>
            ))}
            {flatItems.length === 0 && (
              <div className="search-empty">No matching files or commands</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
