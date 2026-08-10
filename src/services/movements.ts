import { supabase } from '@/lib/supabase'
import { takeRecent } from '@/utils/calculations'
import type { FinanceAccount, Movement, SavingsCategory } from '@/types/models'

/**
 * The Recent list on the Finance screen.
 *
 * Five tables feed it, so they are fetched in parallel and flattened into one
 * shape rather than making the list component understand all five. Each source
 * is limited before merging: pulling a whole year of expenses to show five rows
 * would be slow and pointless.
 */
export async function listRecentMovements(
  userId: string,
  accounts: FinanceAccount[],
  goals: SavingsCategory[],
  count = 5,
): Promise<Movement[]> {
  const accountName = (id: string | null) => {
    if (!id) return null
    return accounts.find((a) => a.id === id)?.name ?? 'Deleted bank'
  }

  // Each query asks for a few more than we need. A single source could hold all
  // five of the newest rows, so limiting to exactly `count` per source is safe,
  // but a small margin keeps the merge honest if two share a timestamp.
  const limit = count + 3

  const [income, expenses, transfers, savings, debtPayments, debts] = await Promise.all([
    supabase
      .from('income_entries')
      .select('id, amount_centavos, source, entry_date, note, account_id, created_at')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('expense_entries')
      .select('id, amount_centavos, category, entry_date, description, account_id, created_at')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('transfers')
      .select('id, amount_centavos, entry_date, note, from_account_id, to_account_id, created_at')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('savings_transactions')
      .select('id, category_id, type, amount_centavos, note, counter_account_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('debt_payments')
      .select('id, debt_id, amount_centavos, note, account_id, entry_date, created_at')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase.from('debts').select('id, name, color, icon').eq('user_id', userId),
  ])

  for (const result of [income, expenses, transfers, savings, debtPayments, debts]) {
    if (result.error) throw result.error
  }

  const debtsById = new Map((debts.data ?? []).map((d) => [d.id, d]))
  const goalsById = new Map(goals.map((g) => [g.id, g]))

  const movements: Movement[] = []

  for (const row of income.data ?? []) {
    movements.push({
      id: `income-${row.id}`,
      kind: 'income',
      title: row.source,
      subtitle: [accountName(row.account_id), row.note].filter(Boolean).join(' · ') || null,
      amount: row.amount_centavos,
      direction: 'in',
      entryDate: row.entry_date,
      createdAt: row.created_at,
      color: 'lime',
      icon: 'banknote',
    })
  }

  for (const row of expenses.data ?? []) {
    movements.push({
      id: `expense-${row.id}`,
      kind: 'expense',
      title: row.category,
      subtitle: [accountName(row.account_id), row.description].filter(Boolean).join(' · ') || null,
      amount: row.amount_centavos,
      direction: 'out',
      entryDate: row.entry_date,
      createdAt: row.created_at,
      color: 'rose',
      icon: 'cart',
    })
  }

  for (const row of transfers.data ?? []) {
    movements.push({
      id: `transfer-${row.id}`,
      kind: 'transfer',
      title: `${accountName(row.from_account_id) ?? 'Outside'} to ${accountName(row.to_account_id) ?? 'Outside'}`,
      subtitle: row.note,
      amount: row.amount_centavos,
      // Moved, not spent. This is what keeps a transfer out of Total Balance.
      direction: 'moved',
      entryDate: row.entry_date,
      createdAt: row.created_at,
      color: 'sky',
      icon: 'repeat',
    })
  }

  for (const row of savings.data ?? []) {
    const goal = goalsById.get(row.category_id)
    const deposit = row.type === 'deposit'
    movements.push({
      id: `savings-${row.id}`,
      kind: 'savings',
      title: goal?.name ?? 'Savings',
      subtitle:
        [deposit ? 'Saved from' : 'Withdrawn to', accountName(row.counter_account_id)]
          .filter(Boolean)
          .join(' ') || null,
      amount: row.amount_centavos,
      direction: 'moved',
      // Savings transactions have no date of their own, only a timestamp.
      entryDate: row.created_at.slice(0, 10),
      createdAt: row.created_at,
      color: goal?.color ?? 'teal',
      icon: goal?.icon ?? 'piggy-bank',
    })
  }

  for (const row of debtPayments.data ?? []) {
    const debt = debtsById.get(row.debt_id)
    movements.push({
      id: `debt-${row.id}`,
      kind: 'debt',
      title: debt?.name ?? 'Debt payment',
      subtitle: [accountName(row.account_id), row.note].filter(Boolean).join(' · ') || null,
      amount: row.amount_centavos,
      // Spending. A payment leaves a bank and does not come back.
      direction: 'out',
      entryDate: row.entry_date ?? row.created_at.slice(0, 10),
      createdAt: row.created_at,
      color: debt?.color ?? 'amber',
      icon: debt?.icon ?? 'credit-card',
    })
  }

  return takeRecent(movements, count)
}
