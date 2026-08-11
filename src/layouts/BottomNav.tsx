import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { BottomSheet } from '@/components/ui/Sheet'
import './bottom-nav.css'

/**
 * Anything under Finance, plus the two screens that are finance in all but URL.
 * Used to decide what the plus button does.
 */
function isFinanceRoute(pathname: string): boolean {
  return (
    pathname === '/finance' ||
    pathname.startsWith('/finance/') ||
    pathname === '/savings' ||
    pathname.startsWith('/savings/') ||
    pathname === '/debt' ||
    pathname.startsWith('/debt/')
  )
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/habits', label: 'Habits', icon: HabitsIcon },
  { to: '/finance', label: 'Finance', icon: FinanceIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
]

export function BottomNav({ onAddTransaction }: { onAddTransaction?: () => void }) {
  const [addOpen, setAddOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const goTo = (path: string) => {
    setAddOpen(false)
    navigate(path)
  }

  /*
    Inside Finance the plus is a money button and goes straight to the
    transaction sheet. Everywhere else it stays the general add menu, because
    from the Habits screen a keypad would be the wrong thing entirely.
  */
  const onPlus = () => {
    if (onAddTransaction && isFinanceRoute(location.pathname)) {
      onAddTransaction()
      return
    }
    setAddOpen(true)
  }

  return (
    <>
      <nav className="bm-bottom-nav" aria-label="Primary">
        <NavLink to="/" end className="bm-nav-item">
          <HomeIcon /> <span>Home</span>
        </NavLink>
        <NavLink to="/habits" className="bm-nav-item">
          <HabitsIcon /> <span>Habits</span>
        </NavLink>
        <button
          type="button"
          className="bm-nav-add"
          onClick={onPlus}
          aria-label="Add"
          aria-haspopup="dialog"
        >
          <PlusIcon />
        </button>
        <NavLink to="/finance" className="bm-nav-item">
          <FinanceIcon /> <span>Finance</span>
        </NavLink>
        <NavLink to="/profile" className="bm-nav-item">
          <ProfileIcon /> <span>Profile</span>
        </NavLink>
      </nav>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add">
        <div className="bm-add-grid">
          <button className="bm-add-option" onClick={() => goTo('/habits/new')}>
            Add Habit
          </button>
          <button className="bm-add-option" onClick={() => goTo('/calendar')}>
            Add Scheduled Task
          </button>
          <button className="bm-add-option" onClick={() => goTo('/finance/income/new')}>
            Add Income
          </button>
          <button className="bm-add-option" onClick={() => goTo('/finance/expense/new')}>
            Add Expense
          </button>
        </div>
      </BottomSheet>
    </>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HabitsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FinanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" strokeLinecap="round" />
      <circle cx="15" cy="14" r="1.6" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}
