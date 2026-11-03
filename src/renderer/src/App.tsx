import { useState } from 'react'
import Editor from '@monaco-editor/react'
import './index.css'

export default function App(): React.ReactElement {
  const files = ['welcome.md', 'index.html', 'style.css', 'app.js']
  const [activeFile, setActiveFile] = useState('welcome.md')

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-logo">
          <div className="logo-icon"></div>
          Unicode
        </div>
        <div className="nav-menu">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Run</span>
          <span>Help</span>
        </div>

        <div className="search-wrapper">
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
            <input type="text" placeholder="Search files, commands, or symbols" />
            <div className="search-controls">
              <span>-</span>
              <span>□</span>
              <span>×</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="main-layout">
        {/* Activity Bar */}
        <div className="activity-bar">
          {/* Files Icon */}
          <div className="activity-icon active">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          {/* Search Icon */}
          <div className="activity-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          {/* Git Icon */}
          <div className="activity-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M6 21V9a9 9 0 0 0 9 9" />
            </svg>
          </div>
          {/* Extensions Icon */}
          <div className="activity-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="glass-panel sidebar">
          <div className="section-title">Quick Start</div>
          <div className="file-list">
            <div className="file-item">HTML Starter</div>
            <div className="file-item">CSS Starter</div>
            <div className="file-item">JS Starter</div>
          </div>

          <div className="section-title">Files</div>
          <div className="file-list">
            {files.map((file) => (
              <div
                key={file}
                className={`file-item ${activeFile === file ? 'active' : ''}`}
                onClick={() => setActiveFile(file)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {file}
              </div>
            ))}
          </div>
        </aside>

        {/* Editor & Terminal */}
        <main className="editor-area">
          <div className="glass-panel editor-window">
            <div className="editor-tabs">
              {files.map((file) => (
                <div
                  key={file}
                  className={`editor-tab ${activeFile === file ? 'active' : ''}`}
                  onClick={() => setActiveFile(file)}
                >
                  {file}
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <Editor
                height="100%"
                language={activeFile.split('.').pop() === 'md' ? 'markdown' : 'javascript'}
                value={`# Welcome to Unicode\n\nYou are currently editing: **${activeFile}**`}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  padding: { top: 16 },
                  fontSize: 14,
                  fontFamily: "'Fira Code', monospace"
                }}
              />
            </div>
          </div>

          <div className="glass-panel terminal-window">
            <div className="terminal-header">
              <span>Terminal</span>
              <span>Type and press Enter</span>
            </div>
            <div className="terminal-content">
              $ Welcome to Unicode terminal mock
              <br />
              <br />
              <span style={{ color: '#6a8759' }}>user@unicode</span>:
              <span style={{ color: '#6897bb' }}>~</span>${' '}
              <span style={{ opacity: 0.5 }}>run command...</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
