import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { listDebts, listPaymentsForDebt, deleteDebt } from '@/services/debt'
import { addCentavos, formatCurrency } from '@/utils/money'
import type { Debt, DebtPayment } from '@/types/models'
import './debt.css'

export function DebtDetailsPage() {
  const { debtId } = useParams()
  const { userId } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const [debt, setDebt] = useState<Debt | null>(null)
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  /*
    The delete keeps the spending. Payments already made are converted into
    ordinary expenses under the debt's name, so wallet balances and the
    month's Money out do not move — the money really did leave, and removing
    the debt must not hand it back. The confirmation says exactly that.
  */
  const onDelete = async () => {
    if (!debtId || deleting) return
    setDeleting(true)
    try {
      await deleteDebt(debtId)
      show(`${debt?.name ?? 'Debt'} deleted.`, 'success')
      navigate('/debt')
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not delete this debt.', 'error')
      setDeleting(false)
    }
  }

  if (loading) return <LoadingState />
  if (error || !debt) return <ErrorState message={error ?? 'Debt not found.'} onRetry={load} />

  const paidSoFar = addCentavos(...payments.map((p) => p.amount))

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

      {/*
        Sits at the bottom, past the history, so it is never the thing your
        thumb lands on when you meant to record a payment.
      */}
      <button
        className="bm-btn bm-btn-danger bm-btn-full bm-debt-delete"
        onClick={() => setConfirmDelete(true)}
        disabled={deleting}
      >
        {deleting ? 'Deleting...' : 'Delete this debt'}
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${debt.name}?`}
        message={
          payments.length === 0
            ? 'This removes the debt completely. There are no payments recorded against it.'
            : `The debt goes for good. The ${formatCurrency(
                paidSoFar,
              )} you already paid stays recorded as spending under "${
                debt.name
              }", so your wallet balances do not change. This cannot be undone.`
        }
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
