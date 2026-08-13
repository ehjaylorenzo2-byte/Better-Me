import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ColorIconPicker } from '@/components/ColorIconPicker'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AccountPicker } from '@/components/finance/AccountPicker'
import { listSavingsCategories, updateSavingsCategory } from '@/services/savings'
import { ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import { isOffline, OFFLINE_MESSAGE } from '@/hooks/useSubmitGuard'
import { centavosToPeso, formatCurrency, isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import type { FinanceAccount, SavingsCategory } from '@/types/models'
import './savings.css'

/**
 * Edit an existing savings goal.
 *
 * The wallet is the reason this screen exists. A goal that is not held in one
 * of your banks cannot take part in your balances at all, so a goal created
 * before wallets existed, or created without one, is stranded until you can
 * change it. Until now there was no screen that could.
 *
 * Deliberately not editable here: the balance. Money only ever moves through
 * Add Money and Withdraw Money so the ledger stays true, and typing a new
 * balance into a form would be exactly the silent adjustment the rest of the
 * app is built to prevent.
 */
export function EditSavingsGoalPage() {
  const { categoryId } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()

  const [goal, setGoal] = useState<SavingsCategory | null>(null)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [color, setColor] = useState('mint')
  const [icon, setIcon] = useState('piggy-bank')
  const [accountId, setAccountId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!userId || !categoryId) return
    setLoading(true)
    setLoadError(null)
    try {
      await ensureDefaultAccounts()
      const [goals, accs] = await Promise.all([
        listSavingsCategories(userId, { includeArchived: true }),
        listAccounts(userId),
      ])
      const found = goals.find((g) => g.id === categoryId) ?? null
      setGoal(found)
      setAccounts(accs)
      if (found) {
        setName(found.name)
        setTarget(found.goalAmount ? String(centavosToPeso(found.goalAmount)) : '')
        setColor(found.color)
        setIcon(found.icon)
        setAccountId(found.accountId)
      }
    } catch {
      setLoadError('Could not load this goal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, categoryId])

  if (loading) return <LoadingState />
  if (loadError || !goal) return <ErrorState message={loadError ?? 'Goal not found.'} onRetry={load} />

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || saving) return

    if (!name.trim()) {
      setError('Give the goal a name.')
      return
    }
    if (target && (!isValidMoneyInput(target) || pesoToCentavos(target) <= 0)) {
      setError('The target has to be more than zero, or leave it blank for no target.')
      return
    }
    if (!accountId) {
      setError('Pick the bank this goal is held in.')
      return
    }
    if (isOffline()) {
      setError(OFFLINE_MESSAGE)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateSavingsCategory(goal.id, {
        name,
        goalAmount: target ? pesoToCentavos(target) : null,
        color,
        icon,
        accountId,
      })
      show('Goal updated.', 'success')
      navigate(`/savings/${goal.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setSaving(false)
    }
  }

  const movedBank = accountId !== goal.accountId && goal.balance > 0

  return (
    <div className="bm-enter">
      <PageHeader title="Edit goal" />

      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}

        <Input
          label="Goal name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Emergency Fund"
        />

        <CurrencyInput label="Target amount (optional)" value={target} onChange={setTarget} />
        <p className="bm-settings-note">
          Leave the target blank if you just want to save without a finish line. The progress bar
          disappears and nothing else changes.
        </p>

        <div>
          <AccountPicker
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            label="Held in"
            allowNone={false}
            showOptional={false}
          />
          <p className="bm-settings-note" style={{ marginTop: 8 }}>
            {goal.accountId
              ? 'The bank this goal lives in. Your money is really in that bank; the goal is a label on part of it.'
              : 'This goal has no bank yet, so its money is invisible to your wallet balances. Pick one to fix that.'}
          </p>
          {movedBank ? (
            <p className="bm-goal-warn">
              Moving {formatCurrency(goal.balance)} from one bank to another. Your total stays the
              same, but the two wallet balances will change to match.
            </p>
          ) : null}
        </div>

        <ColorIconPicker
          color={color}
          icon={icon}
          onColorChange={setColor}
          onIconChange={setIcon}
          previewName={name || goal.name}
          previewSubtitle={formatCurrency(goal.balance)}
        />

        <Button type="submit" fullWidth loading={saving}>
          Save changes
        </Button>

        <button
          type="button"
          className="bm-btn bm-btn-secondary bm-btn-full"
          onClick={() => navigate(`/savings/${goal.id}`)}
          disabled={saving}
        >
          Cancel
        </button>
      </form>

      <p className="bm-settings-footnote" style={{ marginTop: 20 }}>
        The balance is not edited here on purpose. Money moves through Add Money and Withdraw Money
        so every change leaves a record you can look back at.
      </p>
    </div>
  )
}
