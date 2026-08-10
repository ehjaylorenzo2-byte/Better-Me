import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AccountPicker } from '@/components/finance/AccountPicker'
import { addTransfer, validateTransfer } from '@/services/transfers'
import { ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import { getPhilippineToday } from '@/utils/timezone'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import type { FinanceAccount } from '@/types/models'
import './finance.css'

export function AddTransferPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()

  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [date, setDate] = useState(getPhilippineToday())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      try {
        await ensureDefaultAccounts()
        const list = await listAccounts(userId)
        if (!active) return
        setAccounts(list)
        setFromId((current) => current ?? list[0]?.id ?? null)
      } catch {
        if (active) setError('Could not load your banks.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [userId])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    if (!isValidMoneyInput(amount) || pesoToCentavos(amount) <= 0) {
      setError('Enter a valid amount greater than zero.')
      return
    }

    const draft = {
      fromAccountId: fromId,
      toAccountId: toId,
      amount: pesoToCentavos(amount),
      entryDate: date,
      note: note || null,
    }

    const problem = validateTransfer(draft)
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await addTransfer(userId, draft)
      show('Transfer saved.', 'success')
      navigate('/finance/transfers')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the transfer.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="bm-enter">
      <PageHeader title="Add Transfer" />

      {accounts.length < 2 ? (
        <p className="bm-section-note">
          A transfer needs somewhere to come from and somewhere to go. Add your banks under Edit on the
          Transfers screen first, then come back.
        </p>
      ) : null}

      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}

        <CurrencyInput label="Amount" value={amount} onChange={setAmount} autoFocus />

        <AccountPicker
          accounts={accounts}
          value={fromId}
          onChange={setFromId}
          label="From"
          allowNone
          showOptional={false}
          excludeId={toId}
          emptyHint="Add a bank under Edit on the Transfers screen."
        />

        <AccountPicker
          accounts={accounts}
          value={toId}
          onChange={setToId}
          label="To"
          allowNone
          showOptional={false}
          excludeId={fromId}
          emptyHint="Add a bank under Edit on the Transfers screen."
        />

        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <Input
          label="Note (optional)"
          placeholder="e.g. moving rent money"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={60}
        />

        <Button type="submit" fullWidth loading={saving}>
          Save Transfer
        </Button>

        <p className="bm-form-footnote">
          This will not change your Total Balance. The money has not left you, it has only moved.
        </p>
      </form>
    </div>
  )
}
