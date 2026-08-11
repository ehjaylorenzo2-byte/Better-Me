import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { listSavingsCategories, recordSavingsTransaction } from '@/services/savings'
import { AccountPicker } from '@/components/finance/AccountPicker'
import { ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import type { FinanceAccount } from '@/types/models'
import { validateSavingsDeposit, validateSavingsWithdrawal } from '@/utils/calculations'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import type { SavingsCategory } from '@/types/models'
import '../finance/finance.css'
import './savings.css'

export function AddSavingsTransactionPage() {
  const { categoryId } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [category, setCategory] = useState<SavingsCategory | null>(null)
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [counterAccountId, setCounterAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !categoryId) return
    let active = true
    ;(async () => {
      await ensureDefaultAccounts()
      const [cats, accs] = await Promise.all([listSavingsCategories(userId), listAccounts(userId)])
      if (!active) return
      const found = cats.find((c) => c.id === categoryId) ?? null
      setCategory(found)
      setAccounts(accs)
      // Default the far side to a bank that is not the goal's own, so a deposit
      // reads as money coming from somewhere rather than shuffling in place.
      setCounterAccountId(
        (current) => current ?? accs.find((a) => a.id !== found?.accountId)?.id ?? accs[0]?.id ?? null,
      )
    })()
      .catch(() => {
        if (active) setError('Could not load this goal.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId, categoryId])

  if (loading) return <LoadingState />
  if (!category) return null

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidMoneyInput(amount)) {
      setError('Enter a valid amount.')
      return
    }
    const centavos = pesoToCentavos(amount)
    const validation = type === 'deposit' ? validateSavingsDeposit(centavos) : validateSavingsWithdrawal(category.balance, centavos)
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await recordSavingsTransaction(category.id, type, centavos, note || null, counterAccountId)
      show(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} recorded.`, 'success')
      navigate(`/savings/${category.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record transaction.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={`${category.name}: Add Transaction`} />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <div className="bm-type-toggle">
          <button type="button" className={type === 'deposit' ? 'active' : ''} onClick={() => setType('deposit')}>
            Deposit
          </button>
          <button type="button" className={type === 'withdrawal' ? 'active' : ''} onClick={() => setType('withdrawal')}>
            Withdrawal
          </button>
        </div>
        <CurrencyInput label="Amount" value={amount} onChange={setAmount} />

        <AccountPicker
          accounts={accounts}
          value={counterAccountId}
          onChange={setCounterAccountId}
          label={type === 'deposit' ? 'Paid from' : 'Goes to'}
          allowNone={false}
          excludeId={category.accountId}
          emptyHint="Add a bank first, under Edit on the Finance screen."
        />

        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" fullWidth loading={saving}>
          Save Transaction
        </Button>

        <p className="bm-form-footnote">
          This moves money between your own accounts, so your Total Balance does not change.
        </p>
      </form>
    </div>
  )
}
