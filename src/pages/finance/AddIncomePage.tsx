import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { addIncome } from '@/services/finance'
import { ensureDefaultCategories, listCategories, type FinanceCategory } from '@/services/categories'
import { getPhilippineToday } from '@/utils/timezone'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'
import { CategoryPicker } from './CategoryPicker'
import './finance.css'

export function AddIncomePage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()

  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [date, setDate] = useState(getPhilippineToday())
  const [note, setNote] = useState('')
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
        const income = all.filter((c) => c.kind === 'income')
        setCategories(income)
        setSource((current) => current || income[0]?.name || '')
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
    if (!source) {
      setError('Choose a source.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addIncome(userId, pesoToCentavos(amount), source, date, note || null)
      show('Income added.', 'success')
      navigate('/finance/income')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save income.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div>
      <PageHeader title="Add Income" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <CurrencyInput label="Amount" value={amount} onChange={setAmount} autoFocus />
        <CategoryPicker categories={categories} value={source} onChange={setSource} label="Source" />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" fullWidth loading={saving}>
          Add Income
        </Button>
      </form>
    </div>
  )
}
