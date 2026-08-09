import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { DEFAULT_EXPENSE_CATEGORIES, addExpense } from '@/services/finance'
import { getPhilippineToday } from '@/utils/timezone'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import './finance.css'

export function AddExpensePage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0])
  const [customCategory, setCustomCategory] = useState('')
  const [date, setDate] = useState(getPhilippineToday())
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!isValidMoneyInput(amount) || pesoToCentavos(amount) <= 0) {
      setError('Enter a valid amount greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addExpense(
        userId,
        pesoToCentavos(amount),
        category === 'Other' && customCategory ? customCategory : category,
        date,
        description || null,
      )
      show('Expense added.', 'success')
      navigate('/finance/expenses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Add Expense" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <CurrencyInput label="Amount" value={amount} onChange={setAmount} />
        <div className="bm-field">
          <span className="bm-label">Category</span>
          <div className="bm-category-select">
            {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                className={`bm-category-pill ${category === c ? 'active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {category === 'Other' ? (
            <Input placeholder="Custom category" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
          ) : null}
        </div>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button type="submit" fullWidth loading={saving}>
          Add Expense
        </Button>
      </form>
    </div>
  )
}
