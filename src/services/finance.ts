import { supabase } from '@/lib/supabase'
import type { IncomeEntry, ExpenseEntry, Budget } from '@/types/models'
import type { Centavos } from '@/utils/money'
import type { IsoDate } from '@/utils/timezone'

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Bills',
  'Shopping',
  'Entertainment',
  'Subscriptions',
  'Other',
]

export const DEFAULT_INCOME_SOURCES = ['Salary', 'Freelance', 'Bonus', 'Other']

function mapIncome(row: {
  id: string
  user_id: string
  amount_centavos: number
  source: string
  entry_date: string
  note: string | null
  account_id?: string | null
}): IncomeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount_centavos,
    source: row.source,
    entryDate: row.entry_date,
    note: row.note,
    accountId: row.account_id ?? null,
  }
}

function mapExpense(row: {
  id: string
  user_id: string
  amount_centavos: number
  category: string
  entry_date: string
  description: string | null
  account_id?: string | null
}): ExpenseEntry {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount_centavos,
    category: row.category,
    entryDate: row.entry_date,
    description: row.description,
    accountId: row.account_id ?? null,
  }
}

export async function addIncome(
  userId: string,
  amount: Centavos,
  source: string,
  entryDate: IsoDate,
  note?: string | null,
  accountId?: string | null,
): Promise<IncomeEntry> {
  if (amount <= 0) throw new Error('Income amount must be greater than zero.')
  const { data, error } = await supabase
    .from('income_entries')
    .insert({
      user_id: userId,
      amount_centavos: amount,
      source,
      entry_date: entryDate,
      note: note ?? null,
      account_id: accountId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapIncome(data)
}

export async function addExpense(
  userId: string,
  amount: Centavos,
  category: string,
  entryDate: IsoDate,
  description?: string | null,
  accountId?: string | null,
): Promise<ExpenseEntry> {
  if (amount <= 0) throw new Error('Expense amount must be greater than zero.')
  const { data, error } = await supabase
    .from('expense_entries')
    .insert({
      user_id: userId,
      amount_centavos: amount,
      category,
      entry_date: entryDate,
      description: description ?? null,
      account_id: accountId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapExpense(data)
}

export async function listIncomeForMonth(userId: string, month: string): Promise<IncomeEntry[]> {
  const { data, error } = await supabase
    .from('income_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', `${month}-01`)
    .lte('entry_date', `${month}-31`)
    .order('entry_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapIncome)
}

export async function listExpensesForMonth(userId: string, month: string): Promise<ExpenseEntry[]> {
  const { data, error } = await supabase
    .from('expense_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', `${month}-01`)
    .lte('entry_date', `${month}-31`)
    .order('entry_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapExpense)
}

export async function getBudgetForMonth(userId: string, month: string): Promise<Budget | null> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, userId: data.user_id, month: data.month, amount: data.amount_centavos }
}

export async function setBudgetForMonth(userId: string, month: string, amount: Centavos): Promise<Budget> {
  if (amount < 0) throw new Error('Budget cannot be negative.')
  const { data, error } = await supabase
    .from('budgets')
    .upsert({ user_id: userId, month, amount_centavos: amount }, { onConflict: 'user_id,month' })
    .select('*')
    .single()
  if (error) throw error
  return { id: data.id, userId: data.user_id, month: data.month, amount: data.amount_centavos }
}

export async function deleteIncomeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('income_entries').delete().eq('id', id)
  if (error) throw error
}

export async function deleteExpenseEntry(id: string): Promise<void> {
  const { error } = await supabase.from('expense_entries').delete().eq('id', id)
  if (error) throw error
}
