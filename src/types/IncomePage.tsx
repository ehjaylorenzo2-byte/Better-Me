import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { SectionRow } from '@/components/ui/SectionRow'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { deleteIncomeEntry, listIncomeForMonth } from '@/services/finance'
import { buildCategoryLookup, listCategories, type FinanceCategory } from '@/services/categories'
import { buildAccountLookup, listAccounts } from '@/services/accounts'
import { getCurrentPhilippineMonth, relativeDayLabel } from '@/utils/timezone'
import { addCentavos, formatCurrency } from '@/utils/money'
import type { FinanceAccount, IncomeEntry } from '@/types/models'
import { DayGroup, SectionEmpty, SectionShell } from './SectionShell'
import './finance.css'

export function IncomePage() {
  const { userId } = useAuth()
  const { show } = useToast()

  const [entries, setEntries] = useState<IncomeEntry[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<IncomeEntry | null>(null)

  const month = getCurrentPhilippineMonth()

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [list, cats, accs] = await Promise.all([
        listIncomeForMonth(userId, month),
        listCategories(userId, { includeArchived: true }),
        listAccounts(userId, { includeArchived: true }),
      ])
      setEntries(list)
      setCategories(cats)
      setAccounts(accs)
    } catch {
      setError('Could not load your income.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, month])

  const total = useMemo(() => addCentavos(...entries.map((e) => e.amount)), [entries])
  const categoryLookup = useMemo(() => buildCategoryLookup(categories), [categories])
  const accountLookup = useMemo(() => buildAccountLookup(accounts), [accounts])

  const grouped = useMemo(() => {
    const map = new Map<string, IncomeEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.entryDate) ?? []
      list.push(entry)
      map.set(entry.entryDate, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [entries])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const entry = pendingDelete
    setPendingDelete(null)
    try {
      await deleteIncomeEntry(entry.id)
      show('Income removed.', 'success')
      load()
    } catch {
      show('Could not remove that entry.', 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <SectionShell
      title="Income"
      total={total}
      totalLabel="Earned this month"
      totalTone="in"
      editHref="/finance/income/edit"
      addHref="/finance/income/new"
      addLabel="Add income"
    >
      {grouped.length === 0 ? (
        <SectionEmpty
          title="No income logged this month"
          body="Log what comes in and Total Balance starts telling you something true instead of just counting what you spent."
        />
      ) : (
        grouped.map(([date, list]) => (
          <DayGroup
            key={date}
            label={relativeDayLabel(date)}
            total={`+${formatCurrency(addCentavos(...list.map((e) => e.amount)))}`}
          >
            {list.map((entry) => {
              const category = categoryLookup.get(entry.source.toLowerCase())
              const account = entry.accountId ? accountLookup.get(entry.accountId) : null
              const meta = [account?.name, entry.note].filter(Boolean).join(' · ')
              return (
                <SectionRow
                  key={entry.id}
                  onClick={() => setPendingDelete(entry)}
                  icon={category?.icon ?? 'banknote'}
                  color={category?.color ?? 'lime'}
                  title={entry.source}
                  subtitle={meta || undefined}
                  value={`+${formatCurrency(entry.amount)}`}
                  valueTone="in"
                  chevron={false}
                />
              )
            })}
          </DayGroup>
        ))
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this income?"
        message={
          pendingDelete
            ? `${pendingDelete.source}, ${formatCurrency(pendingDelete.amount)}. This cannot be undone.`
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
