import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { LoadingState, ErrorState } from '@/components/ui/States'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  getBudgetForMonth,
  listExpensesForMonth,
  listIncomeForMonth,
} from '@/services/finance'
import { listSavingsCategories } from '@/services/savings'
import { listDebts } from '@/services/debt'
import { getCurrentPhilippineMonth } from '@/utils/timezone'
import { formatCurrency, addCentavos } from '@/utils/money'
import { calculateBudgetRemaining, calculateTotalDebt, calculateTotalSavings } from '@/utils/calculations'
import { getFinanceMotivationMessage } from '@/utils/motivation'
import type { ExpenseEntry, IncomeEntry } from '@/types/models'
import './finance.css'

export function FinanceOverviewPage() {
  const { userId } = useAuth()
  const month = getCurrentPhilippineMonth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [income, setIncome] = useState<IncomeEntry[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [budgetAmount, setBudgetAmount] = useState<number | null>(null)
  const [totalSavings, setTotalSavings] = useState(0)
  const [totalDebt, setTotalDebt] = useState(0)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [inc, exp, budget, savingsCats, debts] = await Promise.all([
        listIncomeForMonth(userId, month),
        listExpensesForMonth(userId, month),
        getBudgetForMonth(userId, month),
        listSavingsCategories(userId),
        listDebts(userId),
      ])
      setIncome(inc)
      setExpenses(exp)
      setBudgetAmount(budget?.amount ?? null)
      setTotalSavings(calculateTotalSavings(savingsCats.map((c) => c.balance)))
      setTotalDebt(calculateTotalDebt(debts.filter((d) => !d.paidOff).map((d) => d.balance)))
    } catch {
      setError('Could not load your finances.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, month])

  const totalIncome = useMemo(() => addCentavos(...income.map((i) => i.amount)), [income])
  const totalExpenses = useMemo(() => addCentavos(...expenses.map((e) => e.amount)), [expenses])
  const balance = totalIncome - totalExpenses

  const budgetSummary = budgetAmount !== null ? calculateBudgetRemaining(budgetAmount, totalExpenses) : null

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  const motivation = budgetSummary
    ? getFinanceMotivationMessage(budgetSummary.isOverBudget, budgetSummary.overBy / Math.max(1, budgetAmount ?? 1))
    : null

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="bm-finance-page">
      <div className="bm-finance-header">
        <h1>Finance</h1>
      </div>

      <Card elevated className="bm-balance-card">
        <p className="bm-summary-label">Total Balance (this month)</p>
        <p className="bm-balance-value">{formatCurrency(balance)}</p>
        <div className="bm-balance-split">
          <span>
            Income this month
            <br />
            <strong className="bm-text-success">{formatCurrency(totalIncome)}</strong>
          </span>
          <span>
            Expenses this month
            <br />
            <strong className="bm-text-danger">{formatCurrency(totalExpenses)}</strong>
          </span>
        </div>
      </Card>

      {budgetSummary ? (
        <Card style={{ marginBottom: 14 }}>
          <div className="bm-section-title-row">
            <h3 style={{ fontSize: 14 }}>Budget</h3>
            <span>{formatCurrency(budgetSummary.budget)}</span>
          </div>
          <ProgressBar
            value={Math.min(100, (totalExpenses / Math.max(1, budgetSummary.budget)) * 100)}
            tone={budgetSummary.isOverBudget ? 'danger' : 'accent'}
          />
          <p className={`bm-budget-status ${budgetSummary.isOverBudget ? 'bm-text-danger' : 'bm-text-success'}`}>
            {budgetSummary.isOverBudget
              ? `Over Budget: ${formatCurrency(budgetSummary.overBy)}`
              : `${formatCurrency(budgetSummary.remaining)} left to spend`}
          </p>
          {motivation ? <p className="bm-motivation-line">{motivation}</p> : null}
        </Card>
      ) : (
        <Card style={{ marginBottom: 14 }}>
          <p className="bm-summary-label">No budget set for this month.</p>
          <Link to="/finance/budget" className="bm-link">
            Set a budget
          </Link>
        </Card>
      )}

      <div className="bm-finance-grid">
        <Link to="/finance/income" className="bm-finance-tile">
          Income
        </Link>
        <Link to="/finance/expenses" className="bm-finance-tile">
          Expenses
        </Link>
        <Link to="/finance/budget" className="bm-finance-tile">
          Budget
        </Link>
        <Link to="/savings" className="bm-finance-tile">
          Savings
        </Link>
        <Link to="/debt" className="bm-finance-tile">
          Debt
        </Link>
      </div>

      <Card>
        <div className="bm-section-title-row">
          <h3 style={{ fontSize: 14 }}>Categories</h3>
          <Link to="/finance/expenses" className="bm-link">
            See All
          </Link>
        </div>
        {byCategory.length === 0 ? (
          <p className="bm-summary-label">No expenses logged yet this month.</p>
        ) : (
          <div className="bm-category-grid">
            {byCategory.slice(0, 6).map(([cat, amount]) => (
              <div key={cat} className="bm-category-chip">
                <span>{cat}</span>
                <strong>{formatCurrency(amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="bm-finance-overview-footer">
        <Card>
          <p className="bm-summary-label">Total Savings</p>
          <p className="bm-summary-value">{formatCurrency(totalSavings)}</p>
        </Card>
        <Card>
          <p className="bm-summary-label">Total Debt</p>
          <p className="bm-summary-value">{formatCurrency(totalDebt)}</p>
        </Card>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
        Default categories: {DEFAULT_EXPENSE_CATEGORIES.join(', ')}. Custom categories are supported when logging expenses.
      </p>
    </div>
  )
}
