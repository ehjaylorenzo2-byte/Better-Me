import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/Progress'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { listSavingsCategories, listTransactionsForCategory } from '@/services/savings'
import { calculateSavingsProgress } from '@/utils/calculations'
import { formatCurrency } from '@/utils/money'
import type { SavingsCategory, SavingsTransaction } from '@/types/models'
import './savings.css'

export function SavingsCategoryPage() {
  const { categoryId } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const [category, setCategory] = useState<SavingsCategory | null>(null)
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId || !categoryId) return
    setLoading(true)
    setError(null)
    try {
      const [cats, txs] = await Promise.all([listSavingsCategories(userId), listTransactionsForCategory(categoryId)])
      setCategory(cats.find((c) => c.id === categoryId) ?? null)
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

  return (
    <div>
      <PageHeader title={category.name} />

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

      <button
        className="bm-btn bm-btn-primary bm-btn-full"
        onClick={() => navigate(`/savings/${category.id}/transaction`)}
        style={{ marginBottom: 20 }}
      >
        Add Transaction
      </button>

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
                      {new Date(tx.createdAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
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
    </div>
  )
}
