import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { describeResetSummary, resetEverything, resetThisMonth } from '@/services/reset'
import {
  getCurrentPhilippineMonth,
  philippineMonthLabel,
  shiftMonth,
} from '@/utils/timezone'
import './profile.css'

/**
 * Two different things that both sound like "start over", kept clearly apart.
 *
 * Reset This Month puts the money back before it deletes anything, so a debt
 * you paid down this month goes back up by exactly what you paid. Reset
 * Everything wipes the records and keeps your login. Deleting the account
 * itself lives on the Security screen, on purpose.
 */
export function DataSettingsPage() {
  const { show } = useToast()

  const thisMonth = getCurrentPhilippineMonth()
  const [month, setMonth] = useState(thisMonth)
  const [includeBudget, setIncludeBudget] = useState(false)

  const [monthOpen, setMonthOpen] = useState(false)
  const [everythingOpen, setEverythingOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const choices = [thisMonth, shiftMonth(thisMonth, -1), shiftMonth(thisMonth, -2)]

  const onResetMonth = async () => {
    setBusy(true)
    try {
      const summary = await resetThisMonth(month, includeBudget)
      setMonthOpen(false)
      show(describeResetSummary(summary), 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not clear that month.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onResetEverything = async () => {
    setBusy(true)
    try {
      await resetEverything()
      setEverythingOpen(false)
      setTyped('')
      show('Everything is cleared. Your login and settings are still here.', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not clear your data.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bm-enter">
      <PageHeader title="Data" />

      <Card style={{ marginBottom: 16 }}>
        <h2 className="bm-section-title">Clear a month</h2>
        <p className="bm-settings-note">
          Removes that month's income, expenses, transfers, savings movements, debt payments, To Do
          results and workouts. Your balances are corrected at the same time, so a debt you paid down
          that month goes back up by what you paid, and a savings goal goes back down.
        </p>

        <div className="bm-month-choices" role="group" aria-label="Month to clear">
          {choices.map((value) => (
            <button
              key={value}
              type="button"
              className={`bm-month-choice ${month === value ? 'active' : ''}`}
              onClick={() => setMonth(value)}
              aria-pressed={month === value}
            >
              {philippineMonthLabel(value)}
            </button>
          ))}
        </div>

        <label className="bm-check-row">
          <input
            type="checkbox"
            checked={includeBudget}
            onChange={(e) => setIncludeBudget(e.target.checked)}
          />
          <span>Also clear the budget you set for that month</span>
        </label>

        <button
          className="bm-btn bm-btn-secondary bm-btn-full bm-press"
          onClick={() => setMonthOpen(true)}
          style={{ marginTop: 12 }}
        >
          Clear {philippineMonthLabel(month)}
        </button>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h2 className="bm-section-title">Start over</h2>
        <p className="bm-settings-note">
          Clears every To Do, workout, entry, wallet, savings goal and debt you have ever added. Your
          login, your name, your photo, your theme and your notification switches stay. This cannot be
          undone.
        </p>
        <button
          className="bm-btn bm-btn-danger bm-btn-full bm-press"
          onClick={() => {
            setTyped('')
            setEverythingOpen(true)
          }}
          style={{ marginTop: 12 }}
        >
          Reset Everything
        </button>
      </Card>

      <p className="bm-settings-footnote">
        Looking to close the account for good? That is under Security / Account, kept separate so it
        is never a mis-tap away.
      </p>

      <Modal open={monthOpen} onClose={() => setMonthOpen(false)} title={`Clear ${philippineMonthLabel(month)}?`}>
        <p className="bm-confirm-message">
          Everything logged in {philippineMonthLabel(month)} goes, and your balances are put back to
          where they were before that month. Other months are untouched.
        </p>
        <div className="bm-confirm-actions">
          <button className="bm-btn bm-btn-secondary" onClick={() => setMonthOpen(false)} disabled={busy}>
            Cancel
          </button>
          <Button variant="danger" loading={busy} onClick={onResetMonth}>
            Clear the month
          </Button>
        </div>
      </Modal>

      <Modal
        open={everythingOpen}
        onClose={() => setEverythingOpen(false)}
        title="Reset everything?"
      >
        <p className="bm-confirm-message">
          This clears all of your Better Me data and cannot be undone. Type <strong>RESET</strong> to
          confirm.
        </p>
        <Input
          label="Type RESET"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder="RESET"
        />
        <div className="bm-confirm-actions" style={{ marginTop: 12 }}>
          <button
            className="bm-btn bm-btn-secondary"
            onClick={() => setEverythingOpen(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <Button variant="danger" loading={busy} disabled={typed.trim() !== 'RESET'} onClick={onResetEverything}>
            Reset Everything
          </Button>
        </div>
      </Modal>
    </div>
  )
}
