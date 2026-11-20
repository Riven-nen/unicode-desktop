import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  stack: string | null
  copied: boolean
}

/**
 * Last-resort UI for renderer crashes. Without this, any uncaught render
 * exception unmounts the whole tree and leaves a blank window. Files live on
 * disk, so reloading the window is always safe.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, stack: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ stack: info.componentStack ?? null })
    console.error('Renderer crashed:', error, info)
  }

  private handleCopy = (): void => {
    const { error, stack } = this.state
    const details = [error?.message ?? 'Unknown error', stack].filter(Boolean).join('\n')
    void navigator.clipboard.writeText(details).then(
      () => this.setState({ copied: true }),
      () => this.setState({ copied: false })
    )
  }

  render(): ReactNode {
    const { error, stack, copied } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash-screen">
        <div className="crash-panel glass-panel">
          <span className="crash-eyebrow">Unicode Lab</span>
          <h1>Something broke while rendering</h1>
          <p>Your files on disk are untouched. Reload the window to keep working.</p>
          <pre className="crash-detail">
            {error.message}
            {stack ? `\n${stack}` : ''}
          </pre>
          <div className="crash-actions">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload window
            </button>
            <button className="btn-secondary" onClick={this.handleCopy}>
              {copied ? 'Copied details' : 'Copy details'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
