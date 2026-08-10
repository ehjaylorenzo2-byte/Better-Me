import { supabase } from '@/lib/supabase'
import type { AccountFlow, FinanceAccount } from '@/types/models'

interface Row {
  id: string
  user_id: string
  name: string
  flow: AccountFlow
  color: string
  icon: string
  is_builtin: boolean
  archived: boolean
  sort_order: number
}

function map(row: Row): FinanceAccount {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    flow: row.flow,
    color: row.color,
    icon: row.icon,
    isBuiltin: row.is_builtin,
    archived: row.archived,
    sortOrder: row.sort_order,
  }
}

export const ACCOUNT_FLOW_LABEL: Record<AccountFlow, string> = {
  outgoing: 'Outgoing',
  savings: 'Savings',
  both: 'Both',
}

export const ACCOUNT_FLOW_HINT: Record<AccountFlow, string> = {
  outgoing: 'You spend from this one.',
  savings: 'Money goes in here to sit.',
  both: 'You save into it and spend from it.',
}

/** True when expenses paid from this account should be counted against it. */
export function spendsFrom(flow: AccountFlow): boolean {
  return flow === 'outgoing' || flow === 'both'
}

/** True when money arriving in this account counts as parked savings. */
export function savesInto(flow: AccountFlow): boolean {
  return flow === 'savings' || flow === 'both'
}

/**
 * Seeds a single starter account the first time Finance opens. Safe to call on
 * every load: the server only seeds when the user has none at all, so an
 * account that was deliberately archived never comes back.
 */
export async function ensureDefaultAccounts(): Promise<void> {
  const { error } = await supabase.rpc('ensure_default_finance_accounts')
  if (error) throw error
}

export async function listAccounts(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<FinanceAccount[]> {
  let query = supabase
    .from('finance_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!options.includeArchived) query = query.eq('archived', false)

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Row[]).map(map)
}

export function buildAccountLookup(accounts: FinanceAccount[]): Map<string, FinanceAccount> {
  return new Map(accounts.map((a) => [a.id, a]))
}

export interface AccountDraft {
  name: string
  flow: AccountFlow
  color: string
  icon: string
}

function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * Postgres enforces one live name per user with a partial unique index, so a
 * clash comes back as code 23505. Translating it here means the UI can show
 * something a person understands instead of a constraint name.
 */
function describeWriteError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'You already have a bank with that name.'
  if (error.code === '23514') return 'That does not look like a valid bank.'
  return error.message
}

export async function createAccount(userId: string, draft: AccountDraft): Promise<FinanceAccount> {
  const name = normaliseName(draft.name)
  if (!name) throw new Error('Give the bank a name.')
  if (name.length > 30) throw new Error('Keep the name under 30 characters.')

  const { data, error } = await supabase
    .from('finance_accounts')
    .insert({
      user_id: userId,
      name,
      flow: draft.flow,
      color: draft.color,
      icon: draft.icon,
    })
    .select('*')
    .single()

  if (error) throw new Error(describeWriteError(error))
  return map(data as Row)
}

export async function updateAccount(id: string, draft: Partial<AccountDraft>): Promise<void> {
  const patch: Partial<{ name: string; flow: AccountFlow; color: string; icon: string }> = {}
  if (draft.name !== undefined) {
    const name = normaliseName(draft.name)
    if (!name) throw new Error('Give the bank a name.')
    if (name.length > 30) throw new Error('Keep the name under 30 characters.')
    patch.name = name
  }
  if (draft.flow !== undefined) patch.flow = draft.flow
  if (draft.color !== undefined) patch.color = draft.color
  if (draft.icon !== undefined) patch.icon = draft.icon
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('finance_accounts').update(patch).eq('id', id)
  if (error) throw new Error(describeWriteError(error))
}

/**
 * Archive rather than delete.
 *
 * Deleting works, and the database is set up to survive it: entries keep their
 * amounts and just lose the bank label. But losing the label loses the story,
 * so the UI archives by default and only offers delete as an explicit choice.
 */
export async function archiveAccount(id: string): Promise<void> {
  const { error } = await supabase.from('finance_accounts').update({ archived: true }).eq('id', id)
  if (error) throw error
}

export async function restoreAccount(id: string): Promise<void> {
  const { error } = await supabase.from('finance_accounts').update({ archived: false }).eq('id', id)
  if (error) throw new Error(describeWriteError(error))
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('finance_accounts').delete().eq('id', id)
  if (error) throw error
}
