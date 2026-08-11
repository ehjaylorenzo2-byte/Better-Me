import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { SectionRow } from '@/components/ui/SectionRow'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { CategoryIcon } from '@/components/CategoryIcon'
import { getBudgetForMonth, listExpensesForMonth, listIncomeForMonth } from '@/services/finance'
import { ensureDefaultCategories, listCategories, buildCategoryLookup, type FinanceCategory } from '@/services/categories'
import { ensureDefaultAccounts, listAccountsWithBalances } from '@/services/accounts'
import { listRecentMovements } from '@/services/movements'
import { listSavingsCategories } from '@/services/savings'
import { listDebts, listPaymentsForMonth } from '@/services/debt'
import { chipVars, chipVarsForLabel } from '@/theme/categoryStyles'
import { getCurrentPhilippineMonth, philippineMonthLabel, relativeDayLabel } from '@/utils/timezone'
import { formatCurrency, addCentavos } from '@/utils/money'
import {
  calculateBudgetRemaining,
  calculateMoneyOut,
  calculateTotalDebt,
  calculateTotalSavings,
  sumAccountBalances,
} from '@/utils/calculations'
import { getFinanceMotivationMessage } from '@/utils/motivation'
import type {
  AccountWithBalance,
  Debt,
  DebtPayment,
  ExpenseEntry,
  IncomeEntry,
  Movement,
  SavingsCategory,
} from '@/types/models'
import './finance.css'

/** Provided by AppLayout: open the shared transaction sheet, and a stamp that
 *  changes whenever something was saved so the screen knows to reload. */
interface LayoutContext {
  openAddTransaction?: () => void
  savedAt?: number
}

export function FinanceOverviewPage() {
  const { userId } = useAuth()
  const outlet = useOutletContext<LayoutContext | null>()
  const month = getCurrentPhilippineMonth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [income, setIncome] = useState<IncomeEntry[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([])
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [budgetAmount, setBudgetAmount] = useState<number | null>(null)
  const [goals, setGoals] = useState<SavingsCategory[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      await Promise.all([ensureDefaultCategories(), ensureDefaultAccounts()])
      const [inc, exp, pays, accs, budget, savingsList, debtList, cats] = await Promise.all([
        listIncomeForMonth(userId, month),
        listExpensesForMonth(userId, month),
        listPaymentsForMonth(userId, month),
        listAccountsWithBalances(userId),
        getBudgetForMonth(userId, month),
        listSavingsCategories(userId),
        listDebts(userId),
        listCategories(userId, { includeArchived: true }),
      ])

      setIncome(inc)
      setExpenses(exp)
      setDebtPayments(pays)
      setAccounts(accs)
      setBudgetAmount(budget?.amount ?? null)
      setGoals(savingsList)
      setDebts(debtList)
      setCategories(cats)

      // Needs the accounts and goals to turn ids into names, so it runs after.
      setMovements(await listRecentMovements(userId, accs, savingsList, 5))
    } catch {
      setError('Could not load your finances.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, month, outlet?.savedAt])

  const totalBalance = useMemo(() => sumAccountBalances(accounts), [accounts])
  const moneyIn = useMemo(() => addCentavos(...income.map((i) => i.amount)), [income])
  const moneyOut = useMemo(() => calculateMoneyOut(expenses, debtPayments), [expenses, debtPayments])
  const totalSavings = useMemo(() => calculateTotalSavings(goals.map((g) => g.balance)), [goals])
  const totalDebt = useMemo(
    () => calculateTotalDebt(debts.filter((d) => !d.paidOff).map((d) => d.balance)),
    [debts],
  )

  const budgetSummary = budgetAmount !== null ? calculateBudgetRemaining(budgetAmount, moneyOut) : null
  const lookup = useMemo(() => buildCategoryLookup(categories), [categories])

  // Debt payments are spending, so they belong in the breakdown under the name
  // of the debt rather than being invisible.
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    for (const p of debtPayments) {
      const name = debts.find((d) => d.id === p.debtId)?.name ?? 'Debt payment'
      map.set(name, (map.get(name) ?? 0) + p.amount)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses, debtPayments, debts])

  const debtNames = useMemo(() => new Set(debts.map((d) => d.name)), [debts])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="bm-finance-page bm-enter">
      <header className="bm-finance-head">
        <p className="bm-finance-eyebrow">Total balance</p>
        <h1 className="bm-display num">{formatCurrency(totalBalance)}</h1>
        <p className="bm-finance-sub">
          {philippineMonthLabel(month)} · across {accounts.length} {accounts.length === 1 ? 'wallet' : 'wallets'}
        </p>
      </header>

      {/* ---- The four figures, in one block ----------------------------- */}
      <div className="bm-figures">
        <Link to="/finance/income" className="bm-figure bm-press">
          <span className="bm-figure-label">Money in</span>
          <span className="bm-figure-value num in">{formatCurrency(moneyIn)}</span>
        </Link>
        <Link to="/finance/expenses" className="bm-figure bm-press">
          <span className="bm-figure-label">Money out</span>
          <span className="bm-figure-value num out">{formatCurrency(moneyOut)}</span>
        </Link>
        <Link to="/savings" className="bm-figure bm-press">
          <span className="bm-figure-label">Total savings</span>
          <span className="bm-figure-value num">{formatCurrency(totalSavings)}</span>
        </Link>
        <Link to="/debt" className="bm-figure bm-press">
          <span className="bm-figure-label">Total debt</span>
          <span className="bm-figure-value num out">{formatCurrency(totalDebt)}</span>
        </Link>
      </div>

      {/* ---- Budget ------------------------------------------------------ */}
      {budgetSummary ? (
        <Card className="bm-budget-card">
          <div className="bm-budget-top">
            <div>
              <p className="bm-caption">Budget</p>
              <p className="bm-budget-value num">{formatCurrency(budgetSummary.budget)}</p>
            </div>
            <Link to="/finance/budget" className="bm-link">
              Change
            </Link>
          </div>
          <div className="bm-budget-track">
            <div
              className={`bm-budget-fill ${budgetSummary.isOverBudget ? 'over' : ''}`}
              style={{ width: `${Math.min(100, (moneyOut / Math.max(1, budgetSummary.budget)) * 100)}%` }}
            />
          </div>
          <p className={`bm-budget-status ${budgetSummary.isOverBudget ? 'over' : ''}`}>
            {budgetSummary.isOverBudget
              ? `Over by ${formatCurrency(budgetSummary.overBy)}`
              : `${formatCurrency(budgetSummary.remaining)} left to spend`}
          </p>
          {debtPayments.length > 0 ? (
            <p className="bm-motivation-line">
              Includes {formatCurrency(addCentavos(...debtPayments.map((p) => p.amount)))} of debt payments.
            </p>
          ) : (
            <p className="bm-motivation-line">
              {getFinanceMotivationMessage(
                budgetSummary.isOverBudget,
                budgetSummary.overBy / Math.max(1, budgetAmount ?? 1),
              )}
            </p>
          )}
        </Card>
      ) : (
        <Link to="/finance/budget" className="bm-budget-empty bm-press">
          <div>
            <p className="bm-budget-empty-title">Set a budget</p>
            <p className="bm-caption">Give this month a ceiling and the app will keep score.</p>
          </div>
          <span className="bm-budget-empty-plus" aria-hidden="true">
            +
          </span>
        </Link>
      )}

      {/* ---- Wallets ----------------------------------------------------- */}
      <Card>
        <div className="bm-card-head">
          <h2 className="bm-card-title">Wallets</h2>
          <Link to="/finance/expenses/edit" className="bm-link">
            Manage
          </Link>
        </div>

        {accounts.length === 0 ? (
          <p className="bm-empty-line">No banks yet. Add one under Manage.</p>
        ) : (
          <div className="bm-wallets">
            {accounts.map((account) => (
              <div key={account.id} className="bm-wallet" style={chipVars(account.color)}>
                <span className="bm-chip bm-chip-sm">
                  <CategoryIcon name={account.icon} size={17} />
                </span>
                <span className="bm-wallet-name">{account.name}</span>
                <span className={`bm-wallet-balance num ${account.balance < 0 ? 'negative' : ''}`}>
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))}
          </div>
        )}

        {accounts.some((a) => a.balance < 0) ? (
          <p className="bm-wallet-warning">
            A wallet is below zero. That usually means spending was logged without money going in
            first, so check for a missing income or transfer.
          </p>
        ) : null}
      </Card>

      {/* ---- Track ------------------------------------------------------- */}
      <section>
        <h2 className="bm-section-heading">Track</h2>
        <div className="bm-row-stack">
          <SectionRow
            to="/savings"
            icon="piggy-bank"
            color="teal"
            title="Savings"
            subtitle={`${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`}
            value={formatCurrency(totalSavings)}
            size="lg"
          />
          <SectionRow
            to="/finance/expenses"
            icon="cart"
            color="rose"
            title="Expenses"
            subtitle={`${expenses.length + debtPayments.length} this month`}
            value={formatCurrency(moneyOut)}
            valueTone="out"
            size="lg"
          />
          <SectionRow
            to="/debt"
            icon="credit-card"
            color="amber"
            title="Debts"
            subtitle={debts.filter((d) => !d.paidOff).length === 0 ? 'Nothing owed' : 'What you still owe'}
            value={formatCurrency(totalDebt)}
            valueTone={totalDebt > 0 ? 'out' : 'muted'}
            size="lg"
          />
        </div>
      </section>

      {/* ---- Recent ------------------------------------------------------ */}
      <Card>
        <div className="bm-card-head">
          <h2 className="bm-card-title">Recent</h2>
          {outlet?.openAddTransaction ? (
            <button type="button" className="bm-link" onClick={outlet.openAddTransaction}>
              + Add
            </button>
          ) : null}
        </div>

        {movements.length === 0 ? (
          <p className="bm-empty-line">Nothing logged yet. Tap the plus to add your first entry.</p>
        ) : (
          <div className="bm-recent">
            {movements.map((m) => (
              <div key={m.id} className="bm-recent-row" style={chipVars(m.color)}>
                <span className="bm-chip bm-chip-sm">
                  <CategoryIcon name={m.icon} size={17} />
                </span>
                <span className="bm-recent-text">
                  <span className="bm-recent-title">{m.title}</span>
                  <span className="bm-recent-sub">
                    {[relativeDayLabel(m.entryDate), m.subtitle].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={`bm-recent-amount num ${m.direction}`}>
                  {m.direction === 'in' ? '+' : m.direction === 'out' ? '-' : ''}
                  {formatCurrency(m.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---- Where it went ----------------------------------------------- */}
      <Card>
        <div className="bm-card-head">
          <h2 className="bm-card-title">Where it went</h2>
          <Link to="/finance/expenses/edit" className="bm-link">
            Manage
          </Link>
        </div>

        {byCategory.length === 0 ? (
          <p className="bm-empty-line">No spending logged yet this month.</p>
        ) : (
          <div className="bm-breakdown">
            {byCategory.slice(0, 7).map(([name, amount], index) => {
              const match = lookup.get(name.toLowerCase())
              const isDebt = debtNames.has(name)
              const vars = match ? chipVars(match.color) : isDebt ? chipVars('amber') : chipVarsForLabel(name)
              const share = moneyOut > 0 ? (amount / moneyOut) * 100 : 0
              return (
                <div key={name} className="bm-breakdown-row" style={vars}>
                  <span className="bm-chip bm-chip-sm">
                    <CategoryIcon name={match?.icon ?? (isDebt ? 'credit-card' : 'circle')} size={17} />
                  </span>
                  <div className="bm-breakdown-text">
                    <div className="bm-breakdown-name">
                      <span>{name}</span>
                      <span className="num">
                        {formatCurrency(amount)}
                        <span className="bm-breakdown-share">{Math.round(share)}%</span>
                      </span>
                    </div>
                    <div className="bm-breakdown-track">
                      <div
                        className="bm-breakdown-fill bm-chip-bar"
                        style={{ width: `${share}%`, animationDelay: `${index * 70}ms` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
