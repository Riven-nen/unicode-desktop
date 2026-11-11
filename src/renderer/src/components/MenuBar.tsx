import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { EditorCommands, EditorViewOptions } from './EditorPane'

type MenuId = 'file' | 'edit' | 'view' | 'help'

interface MenuItemEntry {
  kind: 'item'
  label: string
  shortcut?: string
  /** Editor command, resolved against the live editor at click time. */
  command?: keyof EditorCommands
  /** Direct callback (menu actions that live in App state). */
  action?: () => void
  /** Toggle items render a check mark in the leading column. */
  checked?: boolean
}

type MenuEntry = MenuItemEntry | { kind: 'separator' }

interface MenuBarProps {
  /**
   * Live editor command surface. Read inside click handlers only (never at
   * render time) so the menu always drives the mounted editor and no
   * stale state can desync it.
   */
  commandsRef: { current: EditorCommands | null }
  onNewFile: () => void
  onSaveSnapshot: () => void
  onSyncNow: () => void
  onExportFile: () => void
  viewOptions: EditorViewOptions
  onToggleViewOption: (key: keyof EditorViewOptions) => void
  timelineVisible: boolean
  onToggleTimeline: () => void
  onShowShortcuts: () => void
  onShowAbout: () => void
  onReportIssue: () => void
}

/**
 * The File / Edit / View / Help menu bar. VS Code conventions: click to
 * open, click the root again to close, hovering a sibling root while a
 * menu is open switches to it, and outside clicks or Escape close the
 * dropdown. (Run stays inert until the Judge0 execution backend exists.)
 */
export default function MenuBar({
  commandsRef,
  onNewFile,
  onSaveSnapshot,
  onSyncNow,
  onExportFile,
  viewOptions,
  onToggleViewOption,
  timelineVisible,
  onToggleTimeline,
  onShowShortcuts,
  onShowAbout,
  onReportIssue
}: MenuBarProps): React.ReactElement {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside press / Escape, mirroring the appearance popover.
  useEffect(() => {
    if (!openMenu) return
    const handlePointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

  const fileEntries: MenuEntry[] = [
    { kind: 'item', label: 'New File…', shortcut: 'Ctrl+N', action: onNewFile },
    { kind: 'item', label: 'Save Snapshot', shortcut: 'Ctrl+S', action: onSaveSnapshot },
    { kind: 'item', label: 'Sync Now', action: onSyncNow },
    { kind: 'separator' },
    { kind: 'item', label: 'Export File…', action: onExportFile }
  ]

  const editEntries: MenuEntry[] = [
    { kind: 'item', label: 'Undo', shortcut: 'Ctrl+Z', command: 'undo' },
    { kind: 'item', label: 'Redo', shortcut: 'Ctrl+Shift+Z', command: 'redo' },
    { kind: 'separator' },
    { kind: 'item', label: 'Cut', shortcut: 'Ctrl+X', command: 'cut' },
    { kind: 'item', label: 'Copy', shortcut: 'Ctrl+C', command: 'copy' },
    { kind: 'item', label: 'Paste', shortcut: 'Ctrl+V', command: 'paste' },
    { kind: 'separator' },
    { kind: 'item', label: 'Find…', shortcut: 'Ctrl+F', command: 'find' },
    { kind: 'item', label: 'Replace…', shortcut: 'Ctrl+H', command: 'replace' },
    { kind: 'separator' },
    { kind: 'item', label: 'Toggle Line Comment', shortcut: 'Ctrl+/', command: 'toggleComment' },
    { kind: 'item', label: 'Select All', shortcut: 'Ctrl+A', command: 'selectAll' }
  ]

  const viewEntries: MenuEntry[] = [
    {
      kind: 'item',
      label: 'Command Palette…',
      shortcut: 'Ctrl+Shift+P',
      command: 'commandPalette'
    },
    { kind: 'separator' },
    {
      kind: 'item',
      label: 'Minimap',
      checked: viewOptions.minimap,
      action: () => onToggleViewOption('minimap')
    },
    {
      kind: 'item',
      label: 'Word Wrap',
      checked: viewOptions.wordWrap,
      action: () => onToggleViewOption('wordWrap')
    },
    {
      kind: 'item',
      label: 'Line Numbers',
      checked: viewOptions.lineNumbers,
      action: () => onToggleViewOption('lineNumbers')
    },
    { kind: 'item', label: 'Time Travel Panel', checked: timelineVisible, action: onToggleTimeline }
  ]

  const helpEntries: MenuEntry[] = [
    { kind: 'item', label: 'Keyboard Shortcuts…', action: onShowShortcuts },
    { kind: 'item', label: 'About Unicode Lab', action: onShowAbout },
    { kind: 'separator' },
    { kind: 'item', label: 'Report an Issue…', action: onReportIssue }
  ]

  const renderMenu = (id: MenuId, label: string, entries: MenuEntry[]): React.ReactElement => (
    <span
      className={`nav-menu-item ${openMenu === id ? 'open' : ''}`}
      role="button"
      aria-haspopup="menu"
      aria-expanded={openMenu === id}
      tabIndex={0}
      onClick={() => setOpenMenu(openMenu === id ? null : id)}
      onMouseEnter={() => {
        if (openMenu && openMenu !== id) setOpenMenu(id)
      }}
    >
      {label}
      {openMenu === id && (
        <div className="menu-dropdown glass-panel" role="menu">
          {entries.map((entry, index) =>
            entry.kind === 'separator' ? (
              <div key={`separator-${index}`} className="menu-separator" role="separator" />
            ) : (
              <button
                key={entry.label}
                className="menu-entry"
                role="menuitemcheckbox"
                aria-checked={entry.checked}
                onClick={() => {
                  setOpenMenu(null)
                  if (entry.command) commandsRef.current?.[entry.command]()
                  entry.action?.()
                }}
              >
                <span className="menu-entry-check">
                  {entry.checked ? <Check size={12} /> : null}
                </span>
                <span className="menu-entry-label">{entry.label}</span>
                {entry.shortcut && <span className="menu-shortcut">{entry.shortcut}</span>}
              </button>
            )
          )}
        </div>
      )}
    </span>
  )

  return (
    <div className="nav-menu" ref={containerRef}>
      {renderMenu('file', 'File', fileEntries)}
      {renderMenu('edit', 'Edit', editEntries)}
      {renderMenu('view', 'View', viewEntries)}
      {/* Run stays inert until the Judge0 execution backend is wired in. */}
      <span>Run</span>
      {renderMenu('help', 'Help', helpEntries)}
    </div>
  )
}
