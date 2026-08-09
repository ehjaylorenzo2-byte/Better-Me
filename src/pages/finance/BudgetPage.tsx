import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/Progress'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getBudgetForMonth, listExpensesForMonth, setBudgetForMonth } from '@/services/finance'
import { getCurrentPhilippineMonth } from '@/utils/timezone'
import { formatCurrency, isValidMoneyInput, pesoToCentavos, centavosToPeso } from '@/utils/money'
import { calculateBudgetRemaining } from '@/utils/calculations'
import './finance.css'

export function BudgetPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const month = getCurrentPhilippineMonth()
  const [amount, setAmount] = useState('')
  const [spent, setSpent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [budget, expenses] = await Promise.all([getBudgetForMonth(userId, month), listExpensesForMonth(userId, month)])
      if (budget) setAmount(String(centavosToPeso(budget.amount)))
      setSpent(expenses.reduce((sum, e) => sum + e.amount, 0))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!isValidMoneyInput(amount)) {
      setError('Enter a valid budget amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await setBudgetForMonth(userId, month, pesoToCentavos(amount))
      show('Budget saved.', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  const budgetCentavos = isValidMoneyInput(amount) ? pesoToCentavos(amount) : 0
  const summary = calculateBudgetRemaining(budgetCentavos, spent)

  return (
    <div>
      <PageHeader title="Budget" />

      <Card style={{ marginBottom: 16 }}>
        <p className="bm-summary-label">Monthly Budget</p>
        <p className="bm-summary-value" style={{ fontSize: 22 }}>
          {amount ? formatCurrency(budgetCentavos) : 'No budget set'}
        </p>
        {amount ? (
          <>
            <div style={{ margin: '10px 0' }}>
              <ProgressBar value={Math.min(100, (spent / Math.max(1, budgetCentavos)) * 100)} tone={summary.isOverBudget ? 'danger' : 'accent'} />
            </div>
            <p className={summary.isOverBudget ? 'bm-text-danger' : 'bm-text-success'} style={{ fontWeight: 700, fontSize: 14 }}>
              {summary.isOverBudget ? `Over Budget: ${formatCurrency(summary.overBy)}` : `${formatCurrency(summary.remaining)} left to spend`}
            </p>
          </>
        ) : null}
      </Card>

      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <CurrencyInput label={`Set budget for ${month}`} value={amount} onChange={setAmount} />
        <Button type="submit" fullWidth loading={saving}>
          Save Budget
        </Button>
      </form>
    </div>
  )
}
