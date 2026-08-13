import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { CurrencyInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { CategoryIcon } from '@/components/CategoryIcon'
import { getCategoryColor } from '@/theme/categoryStyles'
import {
  getEffectiveBudget,
  listExpensesForMonth,
  setBudgetForMonth,
  setDefaultBudget,
  type EffectiveBudget,
} from '@/services/finance'
import { listPaymentsForMonth } from '@/services/debt'
import {
  ensureDefaultCategories,
  listCategories,
  listCategoryBudgets,
  setCategoryBudget,
  type FinanceCategory,
} from '@/services/categories'
import { getCurrentPhilippineMonth } from '@/utils/timezone'
import { formatCurrency, isValidMoneyInput, pesoToCentavos, centavosToPeso } from '@/utils/money'
import { calculateBudgetRemaining, calculateBudgetSpend } from '@/utils/calculations'
import './finance.css'
import './categories.css'

export function BudgetPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const month = getCurrentPhilippineMonth()

  const [overall, setOverall] = useState('')
  const [spentByCategory, setSpentByCategory] = useState<Map<string, number>>(new Map())
  const [totalSpent, setTotalSpent] = useState(0)
  // Whether the figure shown is this month's own budget or the usual default.
  const [budgetSource, setBudgetSource] = useState<EffectiveBudget['source'] | null>(null)
  const [makeDefault, setMakeDefault] = useState(false)
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [limits, setLimits] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      await ensureDefaultCategories()
      const [budget, expenses, payments, cats, catBudgets] = await Promise.all([
        getEffectiveBudget(userId, month),
        listExpensesForMonth(userId, month),
        listPaymentsForMonth(userId, month),
        listCategories(userId),
        listCategoryBudgets(userId, month),
      ])

      if (budget) setOverall(String(centavosToPeso(budget.amount)))
      setBudgetSource(budget?.source ?? null)

      // Per-category spend stays expenses only, because debt payments do not
      // belong to a spending category. The overall total counts them, matching
      // Finance and Home.
      const spend = new Map<string, number>()
      for (const e of expenses) {
        spend.set(e.category, (spend.get(e.category) ?? 0) + e.amount)
      }
      setSpentByCategory(spend)
      setTotalSpent(calculateBudgetSpend(expenses, payments))

      setCategories(cats.filter((c) => c.kind === 'expense'))
      setLimits(new Map(catBudgets.map((b) => [b.categoryId, String(centavosToPeso(b.amount))])))
    } catch {
      setError('Could not load your budget.')
    } finally {
      setLoading(false)
    }
  }, [userId, month])

  useEffect(() => {
    void load()
  }, [load])

  const overallCentavos = isValidMoneyInput(overall) ? pesoToCentavos(overall) : 0
  const summary = useMemo(
    () => calculateBudgetRemaining(overallCentavos, totalSpent),
    [overallCentavos, totalSpent],
  )

  const saveAll = async () => {
    if (!userId) return
    setSaving(true)
    try {
      if (overall && isValidMoneyInput(overall)) {
        await setBudgetForMonth(userId, month, pesoToCentavos(overall))
        // Saving it as the usual figure too means next month starts with a
        // budget instead of blank. This month keeps its own row either way, so
        // changing December later still cannot touch November.
        if (makeDefault) await setDefaultBudget(userId, pesoToCentavos(overall))
      }
      await Promise.all(
        categories.map((c) => {
          const raw = limits.get(c.id) ?? ''
          const value = raw && isValidMoneyInput(raw) ? pesoToCentavos(raw) : 0
          return setCategoryBudget(userId, c.id, month, value)
        }),
      )
      show('Budget saved.', 'success')
      await load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save the budget.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="bm-finance-page">
      <PageHeader title="Budget" />

      <Card elevated>
        <p className="bm-summary-label">
          Monthly budget for {month}
          {budgetSource === 'default' ? ' · using your usual amount' : null}
        </p>
        <p className="bm-balance-value" style={{ fontSize: 28 }}>
          {overall ? formatCurrency(overallCentavos) : 'Not set'}
        </p>
        {overall ? (
          <>
            <div className="bm-budget-bar">
              <div
                className="bm-budget-fill"
                style={{
                  width: `${Math.min(100, (totalSpent / Math.max(1, overallCentavos)) * 100)}%`,
                  background: summary.isOverBudget ? 'var(--danger)' : 'var(--gradient-accent)',
                }}
              />
            </div>
            <p
              className={summary.isOverBudget ? 'bm-text-danger' : 'bm-text-success'}
              style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}
            >
              {summary.isOverBudget
                ? `Over budget by ${formatCurrency(summary.overBy)}`
                : `${formatCurrency(summary.remaining)} left to spend`}
            </p>
            <p className="bm-cat-footnote" style={{ textAlign: 'left', padding: 0, marginTop: 4 }}>
              Counts expenses and debt payments. Money you moved into savings is not spending, so it
              is not counted here.
            </p>
          </>
        ) : null}
        <div style={{ marginTop: 14 }}>
          <CurrencyInput label="Overall monthly limit" value={overall} onChange={setOverall} />
          <label className="bm-check-row">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
            />
            <span>Use this as my usual monthly budget from now on</span>
          </label>
          <p className="bm-cat-footnote" style={{ textAlign: 'left', padding: 0 }}>
            Months you have not set on their own follow your usual amount. Changing one month never
            changes a month that has already passed.
          </p>
        </div>
      </Card>

      <div>
        <h2 className="bm-section-title" style={{ marginTop: 4 }}>
          Limits per category
        </h2>
        <p className="bm-cat-footnote" style={{ textAlign: 'left', padding: 0, marginBottom: 12 }}>
          Optional. Leave a category blank for no limit of its own.
        </p>

        <div className="bm-budget-list">
          {categories.map((category) => {
            const swatch = getCategoryColor(category.color)
            const spent = spentByCategory.get(category.name) ?? 0
            const raw = limits.get(category.id) ?? ''
            const limit = raw && isValidMoneyInput(raw) ? pesoToCentavos(raw) : 0
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
            const over = limit > 0 && spent > limit

            return (
              <Card key={category.id} className="bm-budget-row">
                <div className="bm-budget-row-head">
                  <span className="bm-tx-chip" style={{ background: swatch.tint, color: swatch.accent }}>
                    <CategoryIcon name={category.icon} size={18} />
                  </span>
                  <div className="bm-budget-row-text">
                    <p className="bm-cat-name">{category.name}</p>
                    <p className="bm-entry-meta">
                      {formatCurrency(spent)} spent
                      {limit > 0 ? ` of ${formatCurrency(limit)}` : ''}
                    </p>
                  </div>
                  <div className="bm-budget-input">
                    <CurrencyInput
                      value={raw}
                      onChange={(v) => setLimits((prev) => new Map(prev).set(category.id, v))}
                      aria-label={`Monthly limit for ${category.name}`}
                    />
                  </div>
                </div>
                {limit > 0 ? (
                  <div className="bm-budget-bar bm-budget-bar-sm">
                    <div
                      className="bm-budget-fill"
                      style={{ width: `${pct}%`, background: over ? 'var(--danger)' : swatch.accent }}
                    />
                  </div>
                ) : null}
                {over ? (
                  <p className="bm-text-danger" style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                    Over by {formatCurrency(spent - limit)}. Ease up here.
                  </p>
                ) : null}
              </Card>
            )
          })}
        </div>
      </div>

      <Button fullWidth loading={saving} onClick={saveAll}>
        Save Budget
      </Button>
    </div>
  )
}
