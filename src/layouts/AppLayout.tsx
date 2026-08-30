import { useCallback, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { OfflineBanner } from '@/components/ui/States'
import { AddTransactionSheet } from '@/components/finance/AddTransactionSheet'
import { BottomSheet } from '@/components/ui/Sheet'

/**
 * The shell owns the transaction sheet rather than the Finance screen.
 *
 * It has to open from the add button, which lives out here, and it has to work
 * on Savings and Debts too. Keeping it at this level means one instance and one
 * piece of state, instead of every screen wiring up its own copy.
 *
 * The shell also owns Add and Settings, which used to sit in the bottom bar.
 * Settings was never a destination and the plus pushed the four real
 * destinations off-centre; both are now header actions, available from every
 * screen rather than only from the bar.
 */
/**
 * Anything under Money, plus the two screens that are money in all but URL.
 * Used to decide what the add button does.
 */
function isMoneyRoute(pathname: string): boolean {
  return (
    pathname === '/finance' ||
    pathname.startsWith('/finance/') ||
    pathname === '/savings' ||
    pathname.startsWith('/savings/') ||
    pathname === '/debt' ||
    pathname.startsWith('/debt/')
  )
}

export function AppLayout() {
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const location = useLocation()
  const [addOpen, setAddOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [savedAt, setSavedAt] = useState(0)

  const openAddTransaction = useCallback(() => setAddOpen(true), [])

  const goTo = (path: string) => {
    setAddMenuOpen(false)
    navigate(path)
  }

  /*
    Inside Money the plus is a money button and goes straight to the amount
    keypad. Everywhere else it stays the general add menu, because from the
    Schedule screen a keypad would be the wrong thing entirely. This behaviour
    predates the redesign and moving the button must not quietly drop it.
  */
  const onAdd = () => {
    if (isMoneyRoute(location.pathname)) {
      openAddTransaction()
      return
    }
    setAddMenuOpen(true)
  }

  return (
    <div>
      <div className="bm-shell-actions">
        <button
          type="button"
          className="bm-shell-btn"
          onClick={() => navigate('/profile')}
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path
              d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.11-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 8.6a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.56V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.56 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="app-scroll-area">
        <OfflineBanner visible={!online} />
        {/* savedAt changes after every save, which is the signal a screen uses
            to reload itself without the sheet needing to know what is below. */}
        <Outlet context={{ openAddTransaction, savedAt }} />
      </div>

      <BottomNav />

      {/*
        The plus sits bottom right, above the nav, because that is the corner a
        thumb reaches without regripping the phone. It was briefly in the header
        beside Settings, which is the hardest corner to reach one-handed on a
        large screen.
      */}
      <button
        type="button"
        className="bm-fab"
        onClick={onAdd}
        aria-label="Add"
        aria-haspopup="dialog"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      <BottomSheet open={addMenuOpen} onClose={() => setAddMenuOpen(false)} title="Add">
        <div className="bm-add-grid">
          <button className="bm-add-option" onClick={() => goTo('/habits/new')}>
            Add To Do
          </button>
          <button className="bm-add-option" onClick={() => goTo('/finance/transfers/new')}>
            Transfer
          </button>
          <button
            className="bm-add-option"
            onClick={() => {
              setAddMenuOpen(false)
              openAddTransaction()
            }}
          >
            Add Expense
          </button>
          <button className="bm-add-option" onClick={() => goTo('/gym')}>
            Start Workout
          </button>
        </div>
      </BottomSheet>

      <AddTransactionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => setSavedAt(Date.now())}
      />
    </div>
  )
}
