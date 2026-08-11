import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { listDebts, recordDebtPayment } from '@/services/debt'
import { AccountPicker } from '@/components/finance/AccountPicker'
import { ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import { validateDebtPayment } from '@/utils/calculations'
import { formatCurrency, isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import { getPhilippineToday } from '@/utils/timezone'
import type { Debt, FinanceAccount } from '@/types/models'
import '../finance/finance.css'

export function AddDebtPaymentPage() {
  const { debtId } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [debt, setDebt] = useState<Debt | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)
  const [date, setDate] = useState(getPhilippineToday())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !debtId) return
    let active = true
    ;(async () => {
      await ensureDefaultAccounts()
      const [debts, accs] = await Promise.all([listDebts(userId), listAccounts(userId)])
      if (!active) return
      setDebt(debts.find((d) => d.id === debtId) ?? null)
      setAccounts(accs)
      setAccountId((current) => current ?? accs[0]?.id ?? null)
    })()
      .catch(() => {
        if (active) setError('Could not load this debt.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId, debtId])

  if (loading) return <LoadingState />
  if (!debt) return null

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidMoneyInput(amount)) {
      setError('Enter a valid amount.')
      return
    }
    const centavos = pesoToCentavos(amount)
    const validation = validateDebtPayment(debt.balance, centavos)
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid payment.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await recordDebtPayment(debt.id, centavos, note || null, accountId, date)
      show('Payment recorded.', 'success')
      navigate(`/debt/${debt.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={`Pay: ${debt.name}`} />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Remaining balance: {formatCurrency(debt.balance)}
        </p>
        <CurrencyInput label="Payment amount" value={amount} onChange={setAmount} />

        <AccountPicker
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          label="Paid from"
          allowNone={false}
          emptyHint="Add a bank first, under Edit on the Finance screen."
        />

        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

        <Button type="submit" fullWidth loading={saving}>
          Record Payment
        </Button>

        <p className="bm-form-footnote">
          This comes out of the bank you picked and counts as spending this month, so it also goes
          against your budget.
        </p>
      </form>
    </div>
  )
}
