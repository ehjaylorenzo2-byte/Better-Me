import type { ReactNode } from 'react'
import './states.css'

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="bm-state" role="status" aria-live="polite">
      <span className="bm-loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bm-state bm-state-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button className="bm-btn bm-btn-secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="bm-state bm-state-empty">
      <p>{message}</p>
      {action}
    </div>
  )
}

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="bm-offline-banner" role="status">
      You're offline. Reconnect before saving changes.
    </div>
  )
}
