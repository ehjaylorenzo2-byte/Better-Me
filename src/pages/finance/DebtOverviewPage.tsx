import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { listDebts } from '@/services/debt'
import { calculateTotalDebt } from '@/utils/calculations'
import { formatCurrency } from '@/utils/money'
import type { Debt } from '@/types/models'
import '../finance/finance.css'
import './debt.css'

export function DebtOverviewPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      setDebts(await listDebts(userId))
    } catch {
      setError('Could not load debts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const total = calculateTotalDebt(debts.filter((d) => !d.paidOff).map((d) => d.balance))

  return (
    <div>
      <PageHeader
        title="Debts"
        action={
          <button className="bm-link" onClick={() => navigate('/finance/debts/edit')}>
            Edit
          </button>
        }
      />

      <header className="bm-total-head" style={{ marginBottom: 16 }}>
        <p className="bm-caption">Total debt</p>
        <h1 className="bm-display num tone-out">{formatCurrency(total)}</h1>
        <p className="bm-caption">What you still owe</p>
      </header>

      <Link to="/debt/new" className="bm-add-cta bm-press" style={{ marginBottom: 18 }}>
        <span className="bm-add-cta-plus" aria-hidden="true">
          +
        </span>
        Add debt
      </Link>

      {debts.length === 0 ? (
        <EmptyState message="Nothing owed. Keep it that way." />
      ) : (
        <ul className="bm-debt-list">
          {debts.map((debt) => (
            <li key={debt.id}>
              <Link to={`/debt/${debt.id}`}>
                <Card className="bm-debt-item">
                  <div className="bm-entry-row">
                    <span style={{ fontWeight: 700 }}>{debt.name}</span>
                    {debt.paidOff ? <span className="bm-badge bm-badge-done">PAID OFF</span> : null}
                  </div>
                  <p className="bm-debt-balance">{formatCurrency(debt.balance)}</p>
                  <p className="bm-entry-meta">Remaining</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
