import { supabase } from '@/lib/supabase'
import { getPhilippineMonthRange } from '@/utils/timezone'
import type { Debt, DebtPayment } from '@/types/models'
import type { Centavos } from '@/utils/money'

function mapDebt(row: {
  id: string
  user_id: string
  name: string
  original_amount_centavos: number
  balance_centavos: number
  paid_off: boolean
  color?: string
  icon?: string
  created_at: string
}): Debt {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    originalAmount: row.original_amount_centavos,
    balance: row.balance_centavos,
    paidOff: row.paid_off,
    color: row.color ?? 'rose',
    icon: row.icon ?? 'credit-card',
    createdAt: row.created_at,
  }
}

function mapPayment(row: {
  id: string
  debt_id: string
  user_id: string
  amount_centavos: number
  note: string | null
  account_id?: string | null
  entry_date?: string
  created_at: string
}): DebtPayment {
  return {
    id: row.id,
    debtId: row.debt_id,
    userId: row.user_id,
    amount: row.amount_centavos,
    note: row.note,
    accountId: row.account_id ?? null,
    // Payments recorded before wallets have no date of their own, so fall back
    // to the day they were created rather than leaving the field empty.
    entryDate: row.entry_date ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
  }
}

export async function listDebts(userId: string): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapDebt)
}

export async function createDebt(
  userId: string,
  name: string,
  originalAmount: Centavos,
  color = 'rose',
  icon = 'credit-card',
): Promise<Debt> {
  if (!name.trim()) throw new Error('Debt name is required.')
  if (originalAmount < 0) throw new Error('Amount cannot be negative.')
  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: userId,
      name: name.trim(),
      original_amount_centavos: originalAmount,
      balance_centavos: originalAmount,
      color,
      icon,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapDebt(data)
}

export async function updateDebt(
  debtId: string,
  updates: { name?: string; color?: string; icon?: string },
): Promise<void> {
  const payload: { name?: string; color?: string; icon?: string } = {}
  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error('Debt name is required.')
    payload.name = updates.name.trim()
  }
  if (updates.color !== undefined) payload.color = updates.color
  if (updates.icon !== undefined) payload.icon = updates.icon

  const { error } = await supabase.from('debts').update(payload).eq('id', debtId)
  if (error) throw error
}

/** Deletes the debt and, by cascade, its payment history. Irreversible. */
export async function deleteDebt(debtId: string): Promise<void> {
  const { error } = await supabase.from('debts').delete().eq('id', debtId)
  if (error) throw error
}

export async function listPaymentsForDebt(debtId: string): Promise<DebtPayment[]> {
  const { data, error } = await supabase
    .from('debt_payments')
    .select('*')
    .eq('debt_id', debtId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPayment)
}

/**
 * Atomic, validated payment via the record_debt_payment RPC. Rejects
 * overpayment server-side too.
 *
 * A payment is spending: it leaves accountId, counts in the month's money out
 * and in the category breakdown, and reduces what is owed. One entry, three
 * effects, which is how it was already being logged by hand.
 */
export async function recordDebtPayment(
  debtId: string,
  amount: Centavos,
  note?: string | null,
  accountId: string | null = null,
  entryDate: string | null = null,
): Promise<Debt> {
  const { data, error } = await supabase.rpc('record_debt_payment', {
    p_debt_id: debtId,
    p_amount_centavos: amount,
    p_note: note ?? null,
    p_account_id: accountId,
    p_entry_date: entryDate,
  })
  if (error) throw new Error(error.message)
  return mapDebt(data)
}

/**
 * Every debt payment in a month, across all debts.
 *
 * The Finance screen needs these to count payments as spending, which means
 * asking by date rather than by debt. Payments made before wallets have no
 * entry_date of their own; the migration defaults them to the day they were
 * created, so they still land in the right month.
 */
export async function listPaymentsForMonth(userId: string, month: string): Promise<DebtPayment[]> {
  const { start, end } = getPhilippineMonthRange(month)
  const { data, error } = await supabase
    .from('debt_payments')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', start)
    .lte('entry_date', end)
    .order('entry_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPayment)
}
