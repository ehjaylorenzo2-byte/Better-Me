import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { SectionRow } from '@/components/ui/SectionRow'
import { SwipeToDelete } from '@/components/ui/SwipeToDelete'
import { useToast } from '@/components/ui/Toast'
import { deleteExpenseEntry, listExpensesForMonth } from '@/services/finance'
import { buildCategoryLookup, listCategories, type FinanceCategory } from '@/services/categories'
import { buildAccountLookup, listAccounts } from '@/services/accounts'
import { getCurrentPhilippineMonth, relativeDayLabel } from '@/utils/timezone'
import { addCentavos, formatCurrency } from '@/utils/money'
import type { ExpenseEntry, FinanceAccount } from '@/types/models'
import { DayGroup, SectionEmpty, SectionShell } from './SectionShell'
import './finance.css'

export function ExpensesPage() {
  const { userId } = useAuth()
  const { show } = useToast()

  const [entries, setEntries] = useState<ExpenseEntry[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const month = getCurrentPhilippineMonth()

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [list, cats, accs] = await Promise.all([
        listExpensesForMonth(userId, month),
        listCategories(userId, { includeArchived: true }),
        listAccounts(userId, { includeArchived: true }),
      ])
      setEntries(list)
      setCategories(cats)
      setAccounts(accs)
    } catch {
      setError('Could not load expenses.')
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
    const map = new Map<string, ExpenseEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.entryDate) ?? []
      list.push(entry)
      map.set(entry.entryDate, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [entries])

  const removeEntry = async (entry: ExpenseEntry) => {
    try {
      await deleteExpenseEntry(entry.id)
      show('Expense removed.', 'success')
      load()
    } catch {
      show('Could not remove that expense.', 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <SectionShell
      title="Expenses"
      total={total}
      totalLabel="Spent this month"
      totalTone="out"
      editHref="/finance/expenses/edit"
      addHref="/finance/expense/new"
      addLabel="Add expense"
      onRefresh={load}
    >
      {grouped.length === 0 ? (
        <SectionEmpty
          title="Nothing spent yet this month"
          body="Every expense you log here feeds the budget and the where it went breakdown on the Finance screen."
        />
      ) : (
        grouped.map(([date, list]) => (
          <DayGroup
            key={date}
            label={relativeDayLabel(date)}
            total={`-${formatCurrency(addCentavos(...list.map((e) => e.amount)))}`}
          >
            {list.map((entry) => {
              const category = categoryLookup.get(entry.category.toLowerCase())
              const account = entry.accountId ? accountLookup.get(entry.accountId) : null
              const meta = [account?.name, entry.description].filter(Boolean).join(' · ')
              return (
                <SwipeToDelete
                  key={entry.id}
                  onDelete={() => removeEntry(entry)}
                  confirmTitle="Remove this expense?"
                  confirmMessage={`${entry.category}, ${formatCurrency(entry.amount)}. This cannot be undone.`}
                  deleteLabel="Remove"
                >
                  <SectionRow
                    icon={category?.icon ?? 'circle'}
                    color={category?.color}
                    title={entry.category}
                    subtitle={meta || undefined}
                    value={`-${formatCurrency(entry.amount)}`}
                    valueTone="out"
                    chevron={false}
                  />
                </SwipeToDelete>
              )
            })}
          </DayGroup>
        ))
      )}
    </SectionShell>
  )
}
