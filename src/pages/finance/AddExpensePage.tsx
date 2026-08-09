import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { addExpense } from '@/services/finance'
import { ensureDefaultCategories, listCategories, type FinanceCategory } from '@/services/categories'
import { getPhilippineToday } from '@/utils/timezone'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import { CategoryPicker } from './CategoryPicker'
import './finance.css'

export function AddExpensePage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()

  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(getPhilippineToday())
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      try {
        await ensureDefaultCategories()
        const all = await listCategories(userId)
        if (!active) return
        const expense = all.filter((c) => c.kind === 'expense')
        setCategories(expense)
        setCategory((current) => current || expense[0]?.name || '')
      } catch {
        if (active) setError('Could not load your categories.')
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
    if (!category) {
      setError('Choose a category.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addExpense(userId, pesoToCentavos(amount), category, date, description || null)
      show('Expense added.', 'success')
      navigate('/finance/expenses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <PageHeader title="Add Expense" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <CurrencyInput label="Amount" value={amount} onChange={setAmount} autoFocus />
        <CategoryPicker categories={categories} value={category} onChange={setCategory} label="Category" />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input
          label="Description (optional)"
          placeholder="What was it for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" fullWidth loading={saving}>
          Add Expense
        </Button>
      </form>
    </div>
  )
}
