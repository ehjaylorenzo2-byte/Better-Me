import { NavLink } from 'react-router-dom'
import './bottom-nav.css'

/**
 * Four destinations, and only four.
 *
 * The labels are the new ones — Schedule, Fitness, Money — while the routes are
 * untouched. Renaming a URL would break every bookmark and force changes right
 * through the router for no user-visible gain, so the rename is exactly what it
 * appears to be: a rename.
 *
 * Fitness is in the bar for the first time. It used to be reachable only from a
 * shortcut on Home or by typing the address, which is why it went unused.
 *
 * Add and Settings are not here. Settings was never a destination, and the
 * floating plus in the middle pushed the real destinations off-centre. Both now
 * live in the header, where they are available on every screen rather than only
 * from the bar.
 */
const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true, Icon: HomeIcon },
  { to: '/habits', label: 'Schedule', end: false, Icon: ScheduleIcon },
  { to: '/gym', label: 'Fitness', end: false, Icon: FitnessIcon },
  { to: '/finance', label: 'Money', end: false, Icon: MoneyIcon },
]

export function BottomNav() {
  return (
    <nav className="bm-bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map(({ to, label, end, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bm-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Drawn to match the existing set: same 24px box, same 1.8 stroke, round caps. */
function FitnessIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 9v6M17.5 9v6M4 10.5v3M20 10.5v3M8 12h8" strokeLinecap="round" />
    </svg>
  )
}

function MoneyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" strokeLinecap="round" />
      <circle cx="15" cy="14" r="1.6" />
    </svg>
  )
}
