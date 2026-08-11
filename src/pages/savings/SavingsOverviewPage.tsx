import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { listSavingsCategories } from '@/services/savings'
import { buildAccountLookup, listAccountsWithBalances } from '@/services/accounts'
import { calculateSavingsProgress, calculateTotalSavings } from '@/utils/calculations'
import { formatCurrency } from '@/utils/money'
import type { AccountWithBalance, SavingsCategory } from '@/types/models'
import '../finance/finance.css'
import './savings.css'

export function SavingsOverviewPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<SavingsCategory[]>([])
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lookup = buildAccountLookup(accounts) as Map<string, AccountWithBalance>

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [cats, accs] = await Promise.all([
        listSavingsCategories(userId),
        listAccountsWithBalances(userId, { includeArchived: true }),
      ])
      setCategories(cats)
      setAccounts(accs)
    } catch {
      setError('Could not load savings.')
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

  const total = calculateTotalSavings(categories.map((c) => c.balance))

  return (
    <div>
      <PageHeader
        title="Savings"
        action={
          <button className="bm-link" onClick={() => navigate('/finance/savings/edit')}>
            Edit
          </button>
        }
      />

      <header className="bm-total-head" style={{ marginBottom: 16 }}>
        <p className="bm-caption">Total saved</p>
        <h1 className="bm-display num">{formatCurrency(total)}</h1>
        <p className="bm-caption">Across every goal</p>
      </header>

      <Link to="/savings/new" className="bm-add-cta bm-press" style={{ marginBottom: 18 }}>
        <span className="bm-add-cta-plus" aria-hidden="true">
          +
        </span>
        Add savings goal
      </Link>

      <h2 className="bm-section-heading">My savings goals</h2>
      {categories.some((c) => !c.accountId) ? (
        <p className="bm-section-note" style={{ marginBottom: 12 }}>
          Some goals were created before banks existed and are not linked to one yet. Open a goal
          and set its bank so the money shows up in the right wallet.
        </p>
      ) : null}
      {categories.length === 0 ? (
        <EmptyState message="Start your first savings goal." />
      ) : (
        <ul className="bm-savings-list">
          {categories.map((cat) => {
            const progress = calculateSavingsProgress(cat.balance, cat.goalAmount)
            const bank = cat.accountId ? lookup.get(cat.accountId) : null
            // The bank can hold more than the goal, and that is not an error.
            // Showing both beats picking one and being quietly wrong.
            const bankHoldsMore = bank ? bank.balance !== cat.balance : false
            return (
              <li key={cat.id}>
                <Link to={`/savings/${cat.id}`}>
                  <Card className="bm-savings-item">
                    <div className="bm-entry-row">
                      <span style={{ fontFamily: 'var(--font-medium)' }}>{cat.name}</span>
                      <span className="bm-entry-amount">{formatCurrency(cat.balance)}</span>
                    </div>

                    <p className="bm-entry-meta">
                      {bank ? (
                        <>
                          Held in {bank.name}
                          {bankHoldsMore ? ` · that bank holds ${formatCurrency(bank.balance)}` : null}
                        </>
                      ) : (
                        <span className="bm-savings-nobank">Not linked to a bank yet</span>
                      )}
                    </p>

                    {cat.goalAmount ? (
                      <>
                        <ProgressBar value={progress ?? 0} />
                        <p className="bm-entry-meta" style={{ marginTop: 6 }}>
                          {formatCurrency(cat.balance)} / {formatCurrency(cat.goalAmount)} ({Math.round(progress ?? 0)}%)
                        </p>
                      </>
                    ) : (
                      <p className="bm-entry-meta">No target set</p>
                    )}
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
