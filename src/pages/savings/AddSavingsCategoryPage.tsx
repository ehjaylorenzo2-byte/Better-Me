import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createSavingsCategory } from '@/services/savings'
import { isValidMoneyInput, pesoToCentavos } from '@/utils/money'

export function AddSavingsCategoryPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!name.trim()) {
      setError('Category name is required.')
      return
    }
    if (goal && (!isValidMoneyInput(goal) || pesoToCentavos(goal) <= 0)) {
      setError('Goal amount must be greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createSavingsCategory(userId, name, goal ? pesoToCentavos(goal) : null)
      show('Savings category created.', 'success')
      navigate('/savings')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Add Savings Category" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <Input label="Category name" placeholder="e.g. Emergency Fund, Travel" value={name} onChange={(e) => setName(e.target.value)} />
        <CurrencyInput label="Goal amount (optional)" value={goal} onChange={setGoal} />
        <Button type="submit" fullWidth loading={saving}>
          Create Category
        </Button>
      </form>
    </div>
  )
}
