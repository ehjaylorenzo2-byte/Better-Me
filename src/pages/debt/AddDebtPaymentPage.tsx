import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { listDebts, recordDebtPayment } from '@/services/debt'
import { validateDebtPayment } from '@/utils/calculations'
import { formatCurrency, isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import type { Debt } from '@/types/models'

export function AddDebtPaymentPage() {
  const { debtId } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [debt, setDebt] = useState<Debt | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !debtId) return
    listDebts(userId)
      .then((debts) => setDebt(debts.find((d) => d.id === debtId) ?? null))
      .finally(() => setLoading(false))
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
      await recordDebtPayment(debt.id, centavos, note || null)
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
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" fullWidth loading={saving}>
          Record Payment
        </Button>
      </form>
    </div>
  )
}
