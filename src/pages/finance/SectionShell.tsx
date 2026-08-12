import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { formatCurrency, type Centavos } from '@/utils/money'
import './finance.css'

/**
 * The frame every finance section shares.
 *
 * Income, Expenses and Transfers all look and behave the same: back, title,
 * Edit, one big total, one add button, then the list. Learning one is learning
 * all three, which is the point of the restructure.
 */
export function SectionShell({
  title,
  total,
  totalLabel,
  totalTone = 'default',
  editHref,
  addHref,
  addLabel,
  onRefresh,
  children,
}: {
  title: string
  total: Centavos
  totalLabel: string
  totalTone?: 'default' | 'in' | 'out'
  editHref: string
  addHref: string
  addLabel: string
  /** Supplying this turns on pull to refresh for the section. */
  onRefresh?: () => void | Promise<void>
  children: ReactNode
}) {
  const navigate = useNavigate()

  const body = (
    <div className="bm-section-page bm-enter">
      <div className="bm-section-bar">
        <button type="button" className="bm-icon-btn" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="bm-section-bar-title">{title}</span>
        <Link to={editHref} className="bm-edit-btn bm-press">
          Edit
        </Link>
      </div>

      <header className="bm-total-head">
        <p className="bm-caption">{totalLabel}</p>
        <h1 className={`bm-display num tone-${totalTone}`}>{formatCurrency(total)}</h1>
      </header>

      <Link to={addHref} className="bm-add-cta bm-press">
        <span className="bm-add-cta-plus" aria-hidden="true">
          +
        </span>
        {addLabel}
      </Link>

      {children}
    </div>
  )

  if (!onRefresh) return body
  return <PullToRefresh onRefresh={onRefresh}>{body}</PullToRefresh>
}

/**
 * A day heading plus its entries. Grouping by day rather than showing one flat
 * list is what makes a month of spending scannable.
 */
export function DayGroup({ label, total, children }: { label: string; total?: ReactNode; children: ReactNode }) {
  return (
    <section className="bm-day-group">
      <div className="bm-day-head">
        <span className="bm-day-label">{label}</span>
        {total ? <span className="bm-day-total num">{total}</span> : null}
      </div>
      <div className="bm-row-stack">{children}</div>
    </section>
  )
}

export function SectionEmpty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="bm-section-empty">
      <p className="bm-section-empty-title">{title}</p>
      <p className="bm-section-empty-body">{body}</p>
      {action}
    </div>
  )
}
