import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { listSavingsCategories, recordSavingsTransaction } from '@/services/savings'
import { validateSavingsDeposit, validateSavingsWithdrawal } from '@/utils/calculations'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import type { SavingsCategory } from '@/types/models'
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
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !categoryId) return
    listSavingsCategories(userId)
      .then((cats) => setCategory(cats.find((c) => c.id === categoryId) ?? null))
      .finally(() => setLoading(false))
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
      await recordSavingsTransaction(category.id, type, centavos, note || null)
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
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" fullWidth loading={saving}>
          Save Transaction
        </Button>
      </form>
    </div>
  )
}
