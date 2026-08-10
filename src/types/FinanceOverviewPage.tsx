import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { SectionRow } from '@/components/ui/SectionRow'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { CategoryIcon } from '@/components/CategoryIcon'
import { getBudgetForMonth, listExpensesForMonth, listIncomeForMonth } from '@/services/finance'
import { ensureDefaultCategories, listCategories, buildCategoryLookup, type FinanceCategory } from '@/services/categories'
import { ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import { listTransfersForMonth } from '@/services/transfers'
import { listSavingsCategories } from '@/services/savings'
import { listDebts } from '@/services/debt'
import { chipVars, chipVarsForLabel } from '@/theme/categoryStyles'
import { getCurrentPhilippineMonth, philippineMonthLabel } from '@/utils/timezone'
import { formatCurrency, addCentavos } from '@/utils/money'
import {
  calculateAccountTotals,
  calculateBudgetRemaining,
  calculateTotalDebt,
  calculateTotalSavings,
} from '@/utils/calculations'
import { getFinanceMotivationMessage } from '@/utils/motivation'
import type { ExpenseEntry, FinanceAccount, IncomeEntry, Transfer } from '@/types/models'
import './finance.css'

export function FinanceOverviewPage() {
  const { userId } = useAuth()
  const month = getCurrentPhilippineMonth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [income, setIncome] = useState<IncomeEntry[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [budgetAmount, setBudgetAmount] = useState<number | null>(null)
  const [totalSavings, setTotalSavings] = useState(0)
  const [totalDebt, setTotalDebt] = useState(0)
  const [categories, setCategories] = useState<FinanceCategory[]>([])

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      await Promise.all([ensureDefaultCategories(), ensureDefaultAccounts()])
      const [inc, exp, tx, accs, budget, savingsCats, debts, cats] = await Promise.all([
        listIncomeForMonth(userId, month),
        listExpensesForMonth(userId, month),
        listTransfersForMonth(userId, month),
        listAccounts(userId),
        getBudgetForMonth(userId, month),
        listSavingsCategories(userId),
        listDebts(userId),
        listCategories(userId, { includeArchived: true }),
      ])
      setIncome(inc)
      setExpenses(exp)
      setTransfers(tx)
      setAccounts(accs)
      setCategories(cats)
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
  const totalTransfers = useMemo(() => addCentavos(...transfers.map((t) => t.amount)), [transfers])

  // Transfers are deliberately absent from this sum. Money moving from BPI to
  // GCash never left you, so counting it would make the balance a fiction.
  const balance = totalIncome - totalExpenses

  const budgetSummary = budgetAmount !== null ? calculateBudgetRemaining(budgetAmount, totalExpenses) : null

  const lookup = useMemo(() => buildCategoryLookup(categories), [categories])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  const bankTotals = useMemo(
    () =>
      calculateAccountTotals(
        accounts.map((a) => ({ id: a.id, flow: a.flow })),
        expenses.map((e) => ({ accountId: e.accountId, amount: e.amount })),
        income.map((i) => ({ accountId: i.accountId, amount: i.amount })),
        transfers.map((t) => ({
          fromAccountId: t.fromAccountId,
          toAccountId: t.toAccountId,
          amount: t.amount,
        })),
      ),
    [accounts, expenses, income, transfers],
  )

  const activeBanks = useMemo(() => {
    const byId = new Map(bankTotals.map((t) => [t.id, t]))
    return accounts
      .map((account) => ({ account, totals: byId.get(account.id)! }))
      .filter((row) => row.totals && (row.totals.out > 0 || row.totals.in > 0))
      .sort((a, b) => b.totals.headline - a.totals.headline)
  }, [accounts, bankTotals])

  // The scale for the bank bars. Spending and saving mean opposite things, so
  // they are never summed, but they can share a bar length so the block reads
  // as one picture.
  const bankPeak = Math.max(1, ...activeBanks.map((row) => row.totals.headline))

  const motivation = budgetSummary
    ? getFinanceMotivationMessage(budgetSummary.isOverBudget, budgetSummary.overBy / Math.max(1, budgetAmount ?? 1))
    : null

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="bm-finance-page bm-enter">
      {/* The one display-size thing on this screen. */}
      <header className="bm-finance-head">
        <p className="bm-finance-eyebrow">Total balance</p>
        <h1 className="bm-display num">{formatCurrency(balance)}</h1>
        <p className="bm-finance-sub">{philippineMonthLabel(month)}</p>
      </header>

      <div className="bm-inout">
        <div className="bm-inout-cell">
          <span className="bm-inout-dot in" aria-hidden="true" />
          <div>
            <p className="bm-caption">Money in</p>
            <p className="bm-inout-value num">{formatCurrency(totalIncome)}</p>
          </div>
        </div>
        <div className="bm-inout-divider" aria-hidden="true" />
        <div className="bm-inout-cell">
          <span className="bm-inout-dot out" aria-hidden="true" />
          <div>
            <p className="bm-caption">Money out</p>
            <p className="bm-inout-value num">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
      </div>

      {/* ---- Budget ---------------------------------------------------- */}
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
              style={{ width: `${Math.min(100, (totalExpenses / Math.max(1, budgetSummary.budget)) * 100)}%` }}
            />
          </div>

          <p className={`bm-budget-status ${budgetSummary.isOverBudget ? 'over' : ''}`}>
            {budgetSummary.isOverBudget
              ? `Over by ${formatCurrency(budgetSummary.overBy)}`
              : `${formatCurrency(budgetSummary.remaining)} left to spend`}
          </p>
          {motivation ? <p className="bm-motivation-line">{motivation}</p> : null}
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

      {/* ---- The five sections ----------------------------------------- */}
      <section>
        <h2 className="bm-section-heading">Track</h2>
        <div className="bm-row-stack">
          <SectionRow
            to="/finance/income"
            icon="banknote"
            color="lime"
            title="Income"
            subtitle={`${income.length} ${income.length === 1 ? 'entry' : 'entries'} this month`}
            value={formatCurrency(totalIncome)}
            valueTone="in"
            size="lg"
          />
          <SectionRow
            to="/finance/expenses"
            icon="cart"
            color="rose"
            title="Expenses"
            subtitle={`${expenses.length} ${expenses.length === 1 ? 'entry' : 'entries'} this month`}
            value={formatCurrency(totalExpenses)}
            valueTone="out"
            size="lg"
          />
          <SectionRow
            to="/savings"
            icon="piggy-bank"
            color="teal"
            title="Savings"
            subtitle="What you have put away"
            value={formatCurrency(totalSavings)}
            size="lg"
          />
          <SectionRow
            to="/finance/transfers"
            icon="repeat"
            color="sky"
            title="Transfers"
            subtitle="Between your own banks"
            value={formatCurrency(totalTransfers)}
            valueTone="muted"
            size="lg"
          />
          <SectionRow
            to="/debt"
            icon="credit-card"
            color="amber"
            title="Debts"
            subtitle="What you still owe"
            value={formatCurrency(totalDebt)}
            size="lg"
          />
        </div>
      </section>

      {/* ---- Where it went --------------------------------------------- */}
      <Card>
        <div className="bm-card-head">
          <h2 className="bm-card-title">Where it went</h2>
          <Link to="/finance/expenses/edit" className="bm-link">
            Manage
          </Link>
        </div>

        {byCategory.length === 0 ? (
          <p className="bm-empty-line">No expenses logged yet this month.</p>
        ) : (
          <div className="bm-breakdown">
            {byCategory.slice(0, 7).map(([name, amount], index) => {
              const match = lookup.get(name.toLowerCase())
              const vars = match ? chipVars(match.color) : chipVarsForLabel(name)
              const share = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
              return (
                <div key={name} className="bm-breakdown-row" style={vars}>
                  <span className="bm-chip bm-chip-sm">
                    <CategoryIcon name={match?.icon ?? 'circle'} size={17} />
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

      {/* ---- By bank ---------------------------------------------------- */}
      <Card>
        <div className="bm-card-head">
          <h2 className="bm-card-title">By bank</h2>
          <Link to="/finance/expenses/edit" className="bm-link">
            Banks
          </Link>
        </div>

        {activeBanks.length === 0 ? (
          <p className="bm-empty-line">
            Tag an income or expense with a bank and it will show up here, so you can see what each
            account actually costs you.
          </p>
        ) : (
          <div className="bm-bank-list">
            {activeBanks.map(({ account, totals }) => {
              return (
                <div key={account.id} className="bm-bank-row" style={chipVars(account.color)}>
                  <span className="bm-chip bm-chip-sm">
                    <CategoryIcon name={account.icon} size={17} />
                  </span>
                  <div className="bm-bank-text">
                    <div className="bm-bank-top">
                      <span className="bm-bank-name">{account.name}</span>
                      <span className={`bm-bank-amount num ${totals.headlineIsSpending ? 'out' : 'in'}`}>
                        {formatCurrency(totals.headline)}
                      </span>
                    </div>
                    <p className="bm-bank-meta">
                      {totals.headlineIsSpending ? 'spent from this' : 'saved into this'}
                      {totals.headlineIsSpending && totals.in > 0
                        ? ` · ${formatCurrency(totals.in)} in`
                        : null}
                      {!totals.headlineIsSpending && totals.out > 0
                        ? ` · ${formatCurrency(totals.out)} out`
                        : null}
                    </p>
                    <div className="bm-bank-track">
                      <div
                        className="bm-chip-bar"
                        style={{ width: `${Math.max(4, (totals.headline / bankPeak) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ---- Savings and debt summary ----------------------------------- */}
      <div className="bm-summary-pair">
        <Link to="/savings" className="bm-summary-tile bm-press">
          <p className="bm-caption">Total savings</p>
          <p className="bm-summary-tile-value num">{formatCurrency(totalSavings)}</p>
        </Link>
        <Link to="/debt" className="bm-summary-tile bm-press">
          <p className="bm-caption">Total debt</p>
          <p className="bm-summary-tile-value num out">{formatCurrency(totalDebt)}</p>
        </Link>
      </div>
    </div>
  )
}
