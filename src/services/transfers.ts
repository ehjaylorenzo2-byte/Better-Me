import { supabase } from '@/lib/supabase'
import type { Transfer } from '@/types/models'
import type { Centavos } from '@/utils/money'
import { getPhilippineMonthRange, type IsoDate } from '@/utils/timezone'

interface Row {
  id: string
  user_id: string
  from_account_id: string | null
  to_account_id: string | null
  amount_centavos: number
  entry_date: string
  note: string | null
}

function map(row: Row): Transfer {
  return {
    id: row.id,
    userId: row.user_id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: row.amount_centavos,
    entryDate: row.entry_date,
    note: row.note,
  }
}

export interface TransferDraft {
  fromAccountId: string | null
  toAccountId: string | null
  amount: Centavos
  entryDate: IsoDate
  note?: string | null
}

/**
 * Validated here as well as in the database.
 *
 * The check constraints are the real guarantee, but reaching them costs a round
 * trip and returns a constraint name. Checking first means the person sees a
 * sentence instead.
 */
export function validateTransfer(draft: TransferDraft): string | null {
  if (draft.amount <= 0) return 'Enter an amount greater than zero.'
  if (!draft.fromAccountId && !draft.toAccountId) return 'Pick where the money came from or where it went.'
  if (draft.fromAccountId && draft.fromAccountId === draft.toAccountId) {
    return 'Pick two different accounts. Money cannot move to where it already is.'
  }
  return null
}

export async function addTransfer(userId: string, draft: TransferDraft): Promise<Transfer> {
  const problem = validateTransfer(draft)
  if (problem) throw new Error(problem)

  const { data, error } = await supabase
    .from('transfers')
    .insert({
      user_id: userId,
      from_account_id: draft.fromAccountId,
      to_account_id: draft.toAccountId,
      amount_centavos: draft.amount,
      entry_date: draft.entryDate,
      note: draft.note ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return map(data as Row)
}

export async function listTransfersForMonth(userId: string, month: string): Promise<Transfer[]> {
  const { start, end } = getPhilippineMonthRange(month)
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', start)
    .lte('entry_date', end)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as Row[]).map(map)
}

export async function deleteTransfer(id: string): Promise<void> {
  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) throw error
}
