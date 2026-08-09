import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { deleteExpenseEntry, listExpensesForMonth } from '@/services/finance'
import { getCurrentPhilippineMonth } from '@/utils/timezone'
import { formatCurrency } from '@/utils/money'
import type { ExpenseEntry } from '@/types/models'
import './finance.css'

export function ExpensesPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [entries, setEntries] = useState<ExpenseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      setEntries(await listExpensesForMonth(userId, getCurrentPhilippineMonth()))
    } catch {
      setError('Could not load expenses.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const onDelete = async (id: string) => {
    await deleteExpenseEntry(id)
    show('Expense removed.', 'success')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        action={
          <button className="bm-link" onClick={() => navigate('/finance/expense/new')}>
            + Add
          </button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyState message="No expenses logged yet this month." />
      ) : (
        <ul className="bm-entry-list">
          {entries.map((e) => (
            <li key={e.id}>
              <Card>
                <div className="bm-entry-row">
                  <div>
                    <p style={{ fontWeight: 700 }}>{e.category}</p>
                    <p className="bm-entry-meta">
                      {e.entryDate} {e.description ? `· ${e.description}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="bm-entry-amount bm-text-danger">-{formatCurrency(e.amount)}</p>
                    <button className="bm-link" onClick={() => onDelete(e.id)} style={{ fontSize: 12 }}>
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
