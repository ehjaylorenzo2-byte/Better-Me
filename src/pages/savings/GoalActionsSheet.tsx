import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet, Modal } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { deleteSavingsGoal, setSavingsGoalArchived, type GoalDisposition } from '@/services/savings'
import { formatCurrency } from '@/utils/money'
import type { FinanceAccount, SavingsCategory } from '@/types/models'
import './savings.css'

/**
 * Everything you can do to a savings goal, in one place.
 *
 * The delete path is the reason this exists. A goal holding money cannot be
 * deleted in one tap: you have to say where the money goes first, and the
 * choice is carried out as a real movement rather than a number quietly
 * changing. Deleting something that holds twenty thousand pesos should feel
 * like a decision, not a mis-tap.
 */
export function GoalActionsSheet({
  open,
  goal,
  otherGoals,
  accounts,
  onClose,
  onChanged,
  onDeleted,
}: {
  open: boolean
  goal: SavingsCategory
  /** Active goals the money could move into. Excludes this one. */
  otherGoals: SavingsCategory[]
  accounts: FinanceAccount[]
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const { show } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [disposition, setDisposition] = useState<GoalDisposition>('move')
  const [targetGoalId, setTargetGoalId] = useState<string>('')
  const [targetAccountId, setTargetAccountId] = useState<string>('')
  const [typed, setTyped] = useState('')

  const hasMoney = goal.balance > 0

  const onArchive = async () => {
    setBusy(true)
    try {
      await setSavingsGoalArchived(goal.id, !goal.archived)
      show(goal.archived ? 'Goal restored.' : 'Goal archived. Its money is still yours.', 'success')
      onClose()
      onChanged()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not do that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openDelete = () => {
    setDisposition(hasMoney ? 'move' : 'empty')
    setTargetGoalId(otherGoals[0]?.id ?? '')
    setTargetAccountId(accounts[0]?.id ?? '')
    setTyped('')
    setDeleteOpen(true)
  }

  const canDelete = (() => {
    if (typed.trim() !== 'DELETE') return false
    if (!hasMoney) return true
    if (disposition === 'move') return Boolean(targetGoalId)
    if (disposition === 'withdraw') return Boolean(targetAccountId)
    return false
  })()

  const onDelete = async () => {
    setBusy(true)
    try {
      const result = await deleteSavingsGoal(goal.id, hasMoney ? disposition : 'empty', {
        goalId: disposition === 'move' ? targetGoalId : undefined,
        accountId: disposition === 'withdraw' ? targetAccountId : undefined,
      })
      const where =
        result.action === 'moved'
          ? ` ${formatCurrency(result.amount)} moved to ${otherGoals.find((g) => g.id === targetGoalId)?.name}.`
          : result.action === 'withdrawn'
            ? ` ${formatCurrency(result.amount)} went back to ${accounts.find((a) => a.id === targetAccountId)?.name}.`
            : ''
      setDeleteOpen(false)
      onClose()
      show(`Goal deleted.${where}`, 'success')
      onDeleted()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not delete that goal.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={goal.name}>
        <div className="bm-goal-actions">
          <button
            className="bm-goal-action bm-press"
            onClick={() => {
              onClose()
              navigate(`/savings/${goal.id}/edit`)
            }}
            disabled={busy}
          >
            <span className="bm-goal-action-label">Edit goal</span>
            <span className="bm-goal-action-hint">
              Name, target amount, and the bank it is held in.
            </span>
          </button>

          <button className="bm-goal-action bm-press" onClick={onArchive} disabled={busy}>
            <span className="bm-goal-action-label">{goal.archived ? 'Restore goal' : 'Archive goal'}</span>
            <span className="bm-goal-action-hint">
              {goal.archived
                ? 'Put it back in your active list.'
                : 'Hides it from the list. The money and the history stay.'}
            </span>
          </button>

          <button className="bm-goal-action bm-press is-danger" onClick={openDelete} disabled={busy}>
            <span className="bm-goal-action-label">Delete goal</span>
            <span className="bm-goal-action-hint">
              {hasMoney
                ? `Holds ${formatCurrency(goal.balance)}. You will be asked where that money should go.`
                : 'This goal is empty, so nothing is lost.'}
            </span>
          </button>
        </div>
      </BottomSheet>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={`Delete ${goal.name}?`}>
        {hasMoney ? (
          <>
            <p className="bm-confirm-message">
              This goal still holds <strong>{formatCurrency(goal.balance)}</strong>. Deleting it will not
              make that money disappear, so choose where it goes.
            </p>

            <div className="bm-goal-choices" role="group" aria-label="Where the money goes">
              <button
                type="button"
                className={`bm-goal-choice ${disposition === 'move' ? 'active' : ''}`}
                onClick={() => setDisposition('move')}
                aria-pressed={disposition === 'move'}
                disabled={otherGoals.length === 0}
              >
                Move to another goal
                {otherGoals.length === 0 ? <span className="bm-goal-choice-note">No other goal yet</span> : null}
              </button>
              <button
                type="button"
                className={`bm-goal-choice ${disposition === 'withdraw' ? 'active' : ''}`}
                onClick={() => setDisposition('withdraw')}
                aria-pressed={disposition === 'withdraw'}
              >
                Withdraw to a wallet
              </button>
            </div>

            {disposition === 'move' && otherGoals.length > 0 ? (
              <label className="bm-goal-select">
                <span>Move it into</span>
                <select value={targetGoalId} onChange={(e) => setTargetGoalId(e.target.value)}>
                  {otherGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {formatCurrency(g.balance)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {disposition === 'withdraw' ? (
              <label className="bm-goal-select">
                <span>Send it back to</span>
                <select value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : (
          <p className="bm-confirm-message">
            This goal is empty, so nothing is lost. Its history goes with it, and this cannot be undone.
          </p>
        )}

        <Input
          label="Type DELETE"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder="DELETE"
        />

        <div className="bm-confirm-actions" style={{ marginTop: 12 }}>
          <button className="bm-btn bm-btn-secondary" onClick={() => setDeleteOpen(false)} disabled={busy}>
            Cancel
          </button>
          <Button variant="danger" loading={busy} disabled={!canDelete} onClick={onDelete}>
            Delete goal
          </Button>
        </div>
      </Modal>
    </>
  )
}
