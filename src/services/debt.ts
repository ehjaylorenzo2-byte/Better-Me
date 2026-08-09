import { supabase } from '@/lib/supabase'
import type { Debt, DebtPayment } from '@/types/models'
import type { Centavos } from '@/utils/money'

function mapDebt(row: {
  id: string
  user_id: string
  name: string
  original_amount_centavos: number
  balance_centavos: number
  paid_off: boolean
  created_at: string
}): Debt {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    originalAmount: row.original_amount_centavos,
    balance: row.balance_centavos,
    paidOff: row.paid_off,
    createdAt: row.created_at,
  }
}

function mapPayment(row: {
  id: string
  debt_id: string
  user_id: string
  amount_centavos: number
  note: string | null
  created_at: string
}): DebtPayment {
  return {
    id: row.id,
    debtId: row.debt_id,
    userId: row.user_id,
    amount: row.amount_centavos,
    note: row.note,
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

export async function createDebt(userId: string, name: string, originalAmount: Centavos): Promise<Debt> {
  if (!name.trim()) throw new Error('Debt name is required.')
  if (originalAmount < 0) throw new Error('Amount cannot be negative.')
  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: userId,
      name: name.trim(),
      original_amount_centavos: originalAmount,
      balance_centavos: originalAmount,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapDebt(data)
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

/** Atomic, validated payment via record_debt_payment RPC. Rejects overpayment server-side too. */
export async function recordDebtPayment(debtId: string, amount: Centavos, note?: string | null): Promise<Debt> {
  const { data, error } = await supabase.rpc('record_debt_payment', {
    p_debt_id: debtId,
    p_amount_centavos: amount,
    p_note: note ?? null,
  })
  if (error) throw new Error(error.message)
  return mapDebt(data)
}
