import { supabase } from '@/lib/supabase'
import type { SavingsCategory, SavingsTransaction } from '@/types/models'
import type { Centavos } from '@/utils/money'

function mapCategory(row: {
  id: string
  user_id: string
  name: string
  goal_amount_centavos: number | null
  balance_centavos: number
  color?: string
  icon?: string
  account_id?: string | null
  created_at: string
}): SavingsCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    goalAmount: row.goal_amount_centavos,
    balance: row.balance_centavos,
    color: row.color ?? 'mint',
    icon: row.icon ?? 'piggy-bank',
    accountId: row.account_id ?? null,
    createdAt: row.created_at,
  }
}

function mapTransaction(row: {
  id: string
  category_id: string
  user_id: string
  type: 'deposit' | 'withdrawal'
  amount_centavos: number
  note: string | null
  counter_account_id?: string | null
  created_at: string
}): SavingsTransaction {
  return {
    id: row.id,
    categoryId: row.category_id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount_centavos,
    note: row.note,
    counterAccountId: row.counter_account_id ?? null,
    createdAt: row.created_at,
  }
}

export async function listSavingsCategories(userId: string): Promise<SavingsCategory[]> {
  const { data, error } = await supabase
    .from('savings_categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapCategory)
}

export async function createSavingsCategory(
  userId: string,
  name: string,
  goalAmount?: Centavos | null,
  color = 'mint',
  icon = 'piggy-bank',
  /** The bank this goal is held in. */
  accountId: string | null = null,
): Promise<SavingsCategory> {
  if (!name.trim()) throw new Error('Category name is required.')
  if (goalAmount !== undefined && goalAmount !== null && goalAmount <= 0) {
    throw new Error('Goal amount must be greater than zero.')
  }
  const { data, error } = await supabase
    .from('savings_categories')
    .insert({
      user_id: userId,
      name: name.trim(),
      goal_amount_centavos: goalAmount ?? null,
      color,
      icon,
      account_id: accountId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapCategory(data)
}

export async function updateSavingsCategory(
  categoryId: string,
  updates: {
    name?: string
    goalAmount?: Centavos | null
    color?: string
    icon?: string
    accountId?: string | null
  },
): Promise<void> {
  const payload: {
    name?: string
    goal_amount_centavos?: number | null
    color?: string
    icon?: string
    account_id?: string | null
  } = {}
  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error('Category name is required.')
    payload.name = updates.name.trim()
  }
  if (updates.goalAmount !== undefined) {
    if (updates.goalAmount !== null && updates.goalAmount <= 0) {
      throw new Error('Goal amount must be greater than zero.')
    }
    payload.goal_amount_centavos = updates.goalAmount
  }
  if (updates.color !== undefined) payload.color = updates.color
  if (updates.icon !== undefined) payload.icon = updates.icon
  if (updates.accountId !== undefined) payload.account_id = updates.accountId

  const { error } = await supabase.from('savings_categories').update(payload).eq('id', categoryId)
  if (error) throw error
}

/** Deletes the category and, by cascade, its transaction history. Irreversible. */
export async function deleteSavingsCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from('savings_categories').delete().eq('id', categoryId)
  if (error) throw error
}

export async function listTransactionsForCategory(categoryId: string): Promise<SavingsTransaction[]> {
  const { data, error } = await supabase
    .from('savings_transactions')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapTransaction)
}

/**
 * Atomic, validated deposit or withdrawal via the record_savings_transaction
 * RPC, never a naive read-modify-write.
 *
 * counterAccountId is the bank on the far side: the one funding a deposit, or
 * receiving a withdrawal. The server checks it belongs to the caller, so one
 * person cannot push money through another person's wallet.
 */
export async function recordSavingsTransaction(
  categoryId: string,
  type: 'deposit' | 'withdrawal',
  amount: Centavos,
  note?: string | null,
  counterAccountId: string | null = null,
): Promise<SavingsCategory> {
  const { data, error } = await supabase.rpc('record_savings_transaction', {
    p_category_id: categoryId,
    p_type: type,
    p_amount_centavos: amount,
    p_note: note ?? null,
    p_counter_account_id: counterAccountId,
  })
  if (error) throw new Error(error.message)
  return mapCategory(data)
}
