import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { SectionRow } from '@/components/ui/SectionRow'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { deleteTransfer, listTransfersForMonth } from '@/services/transfers'
import { buildAccountLookup, ensureDefaultAccounts, listAccounts } from '@/services/accounts'
import { getCurrentPhilippineMonth, relativeDayLabel } from '@/utils/timezone'
import { addCentavos, formatCurrency } from '@/utils/money'
import type { FinanceAccount, Transfer } from '@/types/models'
import { DayGroup, SectionEmpty, SectionShell } from './SectionShell'
import './finance.css'

export function TransfersPage() {
  const { userId } = useAuth()
  const { show } = useToast()

  const [entries, setEntries] = useState<Transfer[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Transfer | null>(null)

  const month = getCurrentPhilippineMonth()

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      await ensureDefaultAccounts()
      const [list, accs] = await Promise.all([
        listTransfersForMonth(userId, month),
        listAccounts(userId, { includeArchived: true }),
      ])
      setEntries(list)
      setAccounts(accs)
    } catch {
      setError('Could not load your transfers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, month])

  const total = useMemo(() => addCentavos(...entries.map((e) => e.amount)), [entries])
  const accountLookup = useMemo(() => buildAccountLookup(accounts), [accounts])

  const grouped = useMemo(() => {
    const map = new Map<string, Transfer[]>()
    for (const entry of entries) {
      const list = map.get(entry.entryDate) ?? []
      list.push(entry)
      map.set(entry.entryDate, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [entries])

  const nameFor = (id: string | null) => (id ? accountLookup.get(id)?.name ?? 'Deleted bank' : 'Outside')

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const entry = pendingDelete
    setPendingDelete(null)
    try {
      await deleteTransfer(entry.id)
      show('Transfer removed.', 'success')
      load()
    } catch {
      show('Could not remove that transfer.', 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <SectionShell
      title="Transfers"
      total={total}
      totalLabel="Moved this month"
      editHref="/finance/transfers/edit"
      addHref="/finance/transfers/new"
      addLabel="Add transfer"
    >
      <p className="bm-section-note">
        A transfer moves money between your own accounts. It is not income and not an expense, so it
        never changes your Total Balance. It only changes which bank the money is sitting in.
      </p>

      {grouped.length === 0 ? (
        <SectionEmpty
          title="No transfers this month"
          body="Log a transfer when you move money from one of your accounts to another, like cash into BPI. Recording it as an expense plus an income would inflate both of your monthly totals."
        />
      ) : (
        grouped.map(([date, list]) => (
          <DayGroup
            key={date}
            label={relativeDayLabel(date)}
            total={formatCurrency(addCentavos(...list.map((e) => e.amount)))}
          >
            {list.map((entry) => {
              const from = entry.fromAccountId ? accountLookup.get(entry.fromAccountId) : null
              return (
                <SectionRow
                  key={entry.id}
                  onClick={() => setPendingDelete(entry)}
                  icon={from?.icon ?? 'repeat'}
                  color={from?.color ?? 'sky'}
                  title={`${nameFor(entry.fromAccountId)} to ${nameFor(entry.toAccountId)}`}
                  subtitle={entry.note ?? undefined}
                  value={formatCurrency(entry.amount)}
                  valueTone="muted"
                  chevron={false}
                />
              )
            })}
          </DayGroup>
        ))
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this transfer?"
        message={
          pendingDelete
            ? `${formatCurrency(pendingDelete.amount)} from ${nameFor(pendingDelete.fromAccountId)} to ${nameFor(
                pendingDelete.toAccountId,
              )}. This cannot be undone.`
            : ''
        }
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SectionShell>
  )
}
