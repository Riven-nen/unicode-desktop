import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface DemoErrorBoundaryProps {
  children: ReactNode
}

interface DemoErrorBoundaryState {
  error: Error | null
}

/**
 * The demo is a lazy Monaco chunk. If that chunk fails to load or the editor
 * throws during mount, show a visible message instead of silently leaving the
 * console on the page underneath.
 */
export default class DemoErrorBoundary extends Component<
  DemoErrorBoundaryProps,
  DemoErrorBoundaryState
> {
  state: DemoErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): DemoErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ics-demo]', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: 'rgba(0, 0, 0, 0.62)',
            backdropFilter: 'blur(6px)'
          }}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              padding: 20,
              border: '1px solid var(--border)',
              borderRadius: 13,
              background: 'var(--panel)',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Could not open the ICS demo</h2>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
              {this.state.error.message}
            </p>
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
