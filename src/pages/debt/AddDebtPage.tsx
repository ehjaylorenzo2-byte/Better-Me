import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createDebt } from '@/services/debt'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'

export function AddDebtPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!name.trim()) {
      setError('Debt name is required.')
      return
    }
    if (!isValidMoneyInput(amount)) {
      setError('Enter a valid amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createDebt(userId, name, pesoToCentavos(amount))
      show('Debt added.', 'success')
      navigate('/debt')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create debt.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Add Debt" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <Input label="Debt name" placeholder="e.g. Credit Card, Car Loan" value={name} onChange={(e) => setName(e.target.value)} />
        <CurrencyInput label="Current balance" value={amount} onChange={setAmount} />
        <Button type="submit" fullWidth loading={saving}>
          Add Debt
        </Button>
      </form>
    </div>
  )
}
