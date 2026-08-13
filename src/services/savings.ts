import { supabase } from '@/lib/supabase'
import type { SavingsCategory, SavingsTransaction } from '@/types/models'
import type { Centavos } from '@/utils/money'
import type { IsoDate } from '@/utils/timezone'

function mapCategory(row: {
  id: string
  user_id: string
  name: string
  goal_amount_centavos: number | null
  balance_centavos: number
  color?: string
  icon?: string
  account_id?: string | null
  archived?: boolean
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
    archived: row.archived ?? false,
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
  entry_date?: string
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
    entryDate: row.entry_date ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
  }
}

/**
 * Active goals by default. Archived ones are still yours and still hold money,
 * they are just out of the way, so anything that adds up your savings has to
 * ask for them explicitly rather than quietly forgetting them.
 */
export async function listSavingsCategories(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<SavingsCategory[]> {
  let query = supabase.from('savings_categories').select('*').eq('user_id', userId)
  if (!options.includeArchived) query = query.eq('archived', false)

  const { data, error } = await query.order('created_at', { ascending: true })
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
    .order('entry_date', { ascending: false })
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
  entryDate: IsoDate | null = null,
): Promise<SavingsCategory> {
  const { data, error } = await supabase.rpc('record_savings_transaction', {
    p_category_id: categoryId,
    p_type: type,
    p_amount_centavos: amount,
    p_note: note ?? null,
    p_counter_account_id: counterAccountId,
    // Null lets the database stamp today in Manila, which is the same clock
    // every other entry in the app is dated by.
    p_entry_date: entryDate,
  })
  if (error) throw new Error(error.message)
  return mapCategory(data)
}

/** What happens to the balance when a goal is deleted. */
export type GoalDisposition = 'empty' | 'move' | 'withdraw'

export interface DeleteGoalResult {
  action: 'deleted' | 'moved' | 'withdrawn'
  amount: Centavos
}

/**
 * Deletes a savings goal without ever destroying the money inside it.
 *
 * 'empty' is refused by the database unless the balance is already zero, so a
 * mis-tap cannot erase twenty thousand pesos. 'move' sends the balance to
 * another goal and 'withdraw' sends it back to a wallet, and both are written
 * to the ledger as real movements before the goal disappears.
 */
export async function deleteSavingsGoal(
  goalId: string,
  disposition: GoalDisposition = 'empty',
  target: { goalId?: string; accountId?: string } = {},
): Promise<DeleteGoalResult> {
  const { data, error } = await supabase.rpc('delete_savings_goal', {
    p_goal_id: goalId,
    p_disposition: disposition,
    p_target_goal_id: target.goalId ?? null,
    p_target_account_id: target.accountId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as DeleteGoalResult
}

/** Archiving keeps the balance and the history; it only leaves the active list. */
export async function setSavingsGoalArchived(
  goalId: string,
  archived: boolean,
): Promise<SavingsCategory> {
  const { data, error } = await supabase.rpc('set_savings_goal_archived', {
    p_goal_id: goalId,
    p_archived: archived,
  })
  if (error) throw new Error(error.message)
  return mapCategory(data)
}
