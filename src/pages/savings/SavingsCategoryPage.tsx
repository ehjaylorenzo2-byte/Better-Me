import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/Progress'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { listSavingsCategories, listTransactionsForCategory } from '@/services/savings'
import { listAccounts } from '@/services/accounts'
import { GoalActionsSheet } from './GoalActionsSheet'
import { calculateSavingsProgress } from '@/utils/calculations'
import { formatCurrency } from '@/utils/money'
import { formatIsoDateLong } from '@/utils/timezone'
import type { FinanceAccount, SavingsCategory, SavingsTransaction } from '@/types/models'
import './savings.css'

export function SavingsCategoryPage() {
  const { categoryId } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const [category, setCategory] = useState<SavingsCategory | null>(null)
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([])
  const [otherGoals, setOtherGoals] = useState<SavingsCategory[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [actionsOpen, setActionsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId || !categoryId) return
    setLoading(true)
    setError(null)
    try {
      const [cats, txs, accs] = await Promise.all([
        listSavingsCategories(userId, { includeArchived: true }),
        listTransactionsForCategory(categoryId),
        listAccounts(userId),
      ])
      setCategory(cats.find((c) => c.id === categoryId) ?? null)
      // Only somewhere active is a sensible place to move money into.
      setOtherGoals(cats.filter((c) => c.id !== categoryId && !c.archived))
      setAccounts(accs)
      setTransactions(txs)
    } catch {
      setError('Could not load this category.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, categoryId])

  if (loading) return <LoadingState />
  if (error || !category) return <ErrorState message={error ?? 'Category not found.'} onRetry={load} />

  const progress = calculateSavingsProgress(category.balance, category.goalAmount)
  // Reaching the target is worth saying out loud, and is never a reason to
  // delete anything on the person's behalf.
  const reached = Boolean(category.goalAmount && category.balance >= category.goalAmount)

  return (
    <div>
      <PageHeader
        title={category.name}
        action={
          <button className="bm-link" onClick={() => setActionsOpen(true)}>
            Manage
          </button>
        }
      />

      {!category.accountId ? (
        <div className="bm-goal-warn" style={{ marginBottom: 12 }}>
          This goal is not held in a bank yet, so its money does not show up in any wallet balance.{' '}
          <button className="bm-link" onClick={() => navigate(`/savings/${category.id}/edit`)}>
            Pick a bank
          </button>
        </div>
      ) : null}

      {category.archived ? (
        <p className="bm-section-note" style={{ marginBottom: 12 }}>
          This goal is archived. Its money is still yours and still counted. Restore it from Manage to
          put it back in your list.
        </p>
      ) : null}

      <Card elevated style={{ marginBottom: 16, textAlign: 'center' }}>
        <p className="bm-summary-label">Balance</p>
        <p className="bm-balance-value" style={{ fontSize: 28 }}>
          {formatCurrency(category.balance)}
        </p>
        {category.goalAmount ? (
          <>
            <ProgressBar value={progress ?? 0} />
            <p className="bm-summary-label" style={{ marginTop: 8 }}>
              Goal: {formatCurrency(category.goalAmount)} ({Math.round(progress ?? 0)}%)
            </p>
          </>
        ) : null}
      </Card>

      {reached ? (
        <div className="bm-goal-reached">
          <p className="bm-goal-reached-title">Goal reached 🎉</p>
          <p className="bm-goal-reached-body">
            {formatCurrency(category.balance)} of {formatCurrency(category.goalAmount ?? 0)}. Keep saving
            into it, take the money out, or archive it to keep the record without it filling your list.
          </p>
        </div>
      ) : null}

      <button
        className="bm-btn bm-btn-primary bm-btn-full"
        onClick={() => navigate(`/savings/${category.id}/transaction`)}
        style={{ marginBottom: 12 }}
      >
        {reached ? 'Keep saving' : 'Add Transaction'}
      </button>

      {reached ? (
        <button
          className="bm-btn bm-btn-secondary bm-btn-full"
          onClick={() => navigate(`/savings/${category.id}/transaction`)}
          style={{ marginBottom: 20 }}
        >
          Withdraw money
        </button>
      ) : (
        <div style={{ marginBottom: 8 }} />
      )}

      <h2 className="bm-section-title">History</h2>
      {transactions.length === 0 ? (
        <EmptyState message="No transactions yet." />
      ) : (
        <ul className="bm-tx-list">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <Card>
                <div className="bm-tx-row">
                  <div>
                    <p style={{ fontWeight: 700, textTransform: 'capitalize' }}>{tx.type}</p>
                    <p className="bm-entry-meta">
                      {formatIsoDateLong(tx.entryDate)}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </p>
                  </div>
                  <span className={`bm-entry-amount bm-tx-type-${tx.type}`}>
                    {tx.type === 'deposit' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <GoalActionsSheet
        open={actionsOpen}
        goal={category}
        otherGoals={otherGoals}
        accounts={accounts}
        onClose={() => setActionsOpen(false)}
        onChanged={load}
        onDeleted={() => navigate('/savings')}
      />
    </div>
  )
}
