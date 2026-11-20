import { ShieldCheck } from 'lucide-react'
import AppearancePanel from './AppearancePanel'
import TitleBarControls from './TitleBarControls'

interface AdminConsoleNoticeProps {
  onSignOut: () => void
}

/**
 * Admins use the separate web console. Keep them out of the student/professor
 * desktop surfaces so the role never silently falls back to a student view.
 */
export default function AdminConsoleNotice({
  onSignOut
}: AdminConsoleNoticeProps): React.ReactElement {
  return (
    <div className="app-container signin-app">
      <nav className="top-nav">
        <div className="nav-logo">
          <div className="logo-icon"></div>
          Unicode Lab
        </div>
        <div className="nav-right">
          <AppearancePanel />
        </div>
        <TitleBarControls />
      </nav>

      <main className="signin-main">
        <div className="signin-glow" aria-hidden="true" />
        <section className="signin-card glass-panel">
          <div className="signin-brand">
            <div className="logo-icon signin-logo" aria-hidden="true"></div>
            <h1>Use the admin console</h1>
            <p>
              Administrator accounts manage users, roles, and classes in the separate Unicode Lab
              admin website. The desktop app is for students and professors.
            </p>
          </div>
          <div className="admin-notice-actions">
            <span className="admin-notice-icon">
              <ShieldCheck size={16} />
            </span>
            <button className="btn-secondary" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
