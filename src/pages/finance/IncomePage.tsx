import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { deleteIncomeEntry, listIncomeForMonth } from '@/services/finance'
import { getCurrentPhilippineMonth } from '@/utils/timezone'
import { formatCurrency } from '@/utils/money'
import type { IncomeEntry } from '@/types/models'
import './finance.css'

export function IncomePage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [entries, setEntries] = useState<IncomeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      setEntries(await listIncomeForMonth(userId, getCurrentPhilippineMonth()))
    } catch {
      setError('Could not load income.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const onDelete = async (id: string) => {
    await deleteIncomeEntry(id)
    show('Income entry removed.', 'success')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Income"
        action={
          <button className="bm-link" onClick={() => navigate('/finance/income/new')}>
            + Add
          </button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : entries.length === 0 ? (
        <EmptyState message="No income logged yet this month." />
      ) : (
        <ul className="bm-entry-list">
          {entries.map((e) => (
            <li key={e.id}>
              <Card>
                <div className="bm-entry-row">
                  <div>
                    <p style={{ fontWeight: 700 }}>{e.source}</p>
                    <p className="bm-entry-meta">
                      {e.entryDate} {e.note ? `· ${e.note}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="bm-entry-amount bm-text-success">+{formatCurrency(e.amount)}</p>
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
