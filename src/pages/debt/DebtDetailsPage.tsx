import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { listDebts, listPaymentsForDebt } from '@/services/debt'
import { formatCurrency } from '@/utils/money'
import type { Debt, DebtPayment } from '@/types/models'
import './debt.css'

export function DebtDetailsPage() {
  const { debtId } = useParams()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const [debt, setDebt] = useState<Debt | null>(null)
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId || !debtId) return
    setLoading(true)
    setError(null)
    try {
      const [debts, pays] = await Promise.all([listDebts(userId), listPaymentsForDebt(debtId)])
      setDebt(debts.find((d) => d.id === debtId) ?? null)
      setPayments(pays)
    } catch {
      setError('Could not load this debt.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, debtId])

  if (loading) return <LoadingState />
  if (error || !debt) return <ErrorState message={error ?? 'Debt not found.'} onRetry={load} />

  return (
    <div>
      <PageHeader title={debt.name} />

      <Card elevated style={{ marginBottom: 16, textAlign: 'center' }}>
        <p className="bm-summary-label">Remaining Balance</p>
        <p className="bm-balance-value" style={{ fontSize: 28 }}>
          {formatCurrency(debt.balance)}
        </p>
        <p className="bm-summary-label">of {formatCurrency(debt.originalAmount)} original</p>
        {debt.paidOff ? <span className="bm-badge bm-badge-done" style={{ marginTop: 8 }}>PAID OFF</span> : null}
      </Card>

      {!debt.paidOff ? (
        <button
          className="bm-btn bm-btn-primary bm-btn-full"
          onClick={() => navigate(`/debt/${debt.id}/payment`)}
          style={{ marginBottom: 20 }}
        >
          Pay Down
        </button>
      ) : null}

      <h2 className="bm-section-title">Payment History</h2>
      {payments.length === 0 ? (
        <EmptyState message="No payments recorded yet." />
      ) : (
        <ul className="bm-tx-list">
          {payments.map((p) => (
            <li key={p.id}>
              <Card>
                <div className="bm-tx-row">
                  <div>
                    <p style={{ fontWeight: 700 }}>Payment</p>
                    <p className="bm-entry-meta">
                      {new Date(p.createdAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <span className="bm-entry-amount bm-text-success">-{formatCurrency(p.amount)}</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
