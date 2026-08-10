import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CategoryIcon } from '@/components/CategoryIcon'
import { chipVars } from '@/theme/categoryStyles'
import './section-row.css'

/**
 * The one navigable shape in the app.
 *
 * Icon, name, value, chevron. Everything you can tap through to is one of
 * these, and nothing that isn't navigable has a chevron. That consistency is
 * doing most of the work in making the app readable: you stop having to learn
 * each screen's own idea of what a tappable thing looks like.
 */
export function SectionRow({
  to,
  onClick,
  icon,
  color,
  title,
  subtitle,
  value,
  valueTone = 'default',
  trailing,
  chevron = true,
  size = 'md',
}: {
  to?: string
  onClick?: () => void
  icon: string
  color?: string | null
  title: string
  subtitle?: ReactNode
  value?: ReactNode
  valueTone?: 'default' | 'in' | 'out' | 'muted'
  trailing?: ReactNode
  chevron?: boolean
  size?: 'md' | 'lg'
}) {
  const body = (
    <>
      <span className={`bm-chip ${size === 'lg' ? '' : 'bm-chip-sm'}`} style={chipVars(color)}>
        <CategoryIcon name={icon} size={size === 'lg' ? 20 : 17} />
      </span>

      <span className="bm-row-text">
        <span className="bm-row-title">{title}</span>
        {subtitle ? <span className="bm-row-subtitle">{subtitle}</span> : null}
      </span>

      {value !== undefined ? <span className={`bm-row-value num tone-${valueTone}`}>{value}</span> : null}
      {trailing}
      {chevron ? <ChevronIcon /> : null}
    </>
  )

  const className = `bm-row bm-row-${size} bm-press`

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {body}
    </button>
  )
}

function ChevronIcon() {
  return (
    <svg
      className="bm-row-chevron"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
