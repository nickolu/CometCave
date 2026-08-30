'use client'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render errors anywhere in the Badge Run subtree.
 * Surfaces the cosmic-narrator error screen rather than a blank white crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            gap: 16,
            maxWidth: 480,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <h2
            style={{
              color: 'rgba(255,255,255,0.95)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 1,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.60)',
              fontSize: 14,
              lineHeight: 1.6,
              textAlign: 'center',
              margin: 0,
            }}
          >
            An error occurred and the run couldn't continue.
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{
              marginTop: 8,
              padding: '10px 28px',
              background: 'rgba(124,106,255,0.15)',
              border: '1px solid rgba(124,106,255,0.4)',
              borderRadius: 6,
              color: '#c4baff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            try again
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: 'rgba(255,0,0,0.08)',
                border: '1px solid rgba(255,0,0,0.2)',
                borderRadius: 4,
                color: 'rgba(255,150,150,0.8)',
                fontSize: 11,
                overflowX: 'auto',
                maxWidth: '100%',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
