import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { OfflineBanner } from '@/components/ui/States'
import { AddTransactionSheet } from '@/components/finance/AddTransactionSheet'

/**
 * The shell owns the transaction sheet rather than the Finance screen.
 *
 * It has to open from the nav plus, which lives out here, and it has to work on
 * Savings and Debts too. Keeping it at this level means one instance and one
 * piece of state, instead of every screen wiring up its own copy.
 */
export function AppLayout() {
  const online = useOnlineStatus()
  const [addOpen, setAddOpen] = useState(false)
  const [savedAt, setSavedAt] = useState(0)

  const openAddTransaction = useCallback(() => setAddOpen(true), [])

  return (
    <div>
      <div className="app-scroll-area">
        <OfflineBanner visible={!online} />
        {/* savedAt changes after every save, which is the signal a screen uses
            to reload itself without the sheet needing to know what is below. */}
        <Outlet context={{ openAddTransaction, savedAt }} />
      </div>

      <BottomNav onAddTransaction={openAddTransaction} />

      <AddTransactionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => setSavedAt(Date.now())}
      />
    </div>
  )
}
