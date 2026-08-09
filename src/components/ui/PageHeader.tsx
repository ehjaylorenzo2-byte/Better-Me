import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import './page-header.css'

export function PageHeader({
  title,
  onBack,
  action,
}: {
  title: string
  onBack?: () => void
  action?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="bm-page-header">
      <button
        type="button"
        className="bm-back-btn"
        aria-label="Go back"
        onClick={() => (onBack ? onBack() : navigate(-1))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1>{title}</h1>
      <div className="bm-page-header-action">{action}</div>
    </div>
  )
}
