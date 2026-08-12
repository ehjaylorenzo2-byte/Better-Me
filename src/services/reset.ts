import { supabase } from '@/lib/supabase'

export interface ResetSummary {
  habits: number
  workouts: number
  income: number
  expenses: number
  transfers: number
  savings: number
  debtPayments: number
}

/**
 * Clears one month of activity and puts the money back where it was.
 *
 * The database does the work in a single function so the reversal and the
 * deletion cannot come apart. Deleting a debt payment on its own would leave a
 * debt reading 15,000 when nothing was ever paid, which is worse than not
 * offering the feature at all.
 */
export async function resetThisMonth(month: string, includeBudget = false): Promise<ResetSummary> {
  const { data, error } = await supabase.rpc('reset_this_month', {
    p_month: month,
    p_include_budget: includeBudget,
  })
  if (error) throw new Error(error.message)
  return data as ResetSummary
}

/** Clears every Better Me record and leaves the login, and settings, alone. */
export async function resetEverything(): Promise<void> {
  const { error } = await supabase.rpc('reset_everything')
  if (error) throw new Error(error.message)
}

/**
 * Deletes the login itself. Every table hangs off the auth user with a cascade,
 * so the data goes with it. Not reversible and not the same as a reset.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw new Error(error.message)
  await supabase.auth.signOut()
}

/** Plain English for the confirmation screen, in the order people care about. */
export function describeResetSummary(summary: ResetSummary): string {
  const parts: Array<[number, string]> = [
    [summary.income, 'income entries'],
    [summary.expenses, 'expenses'],
    [summary.transfers, 'transfers'],
    [summary.savings, 'savings movements'],
    [summary.debtPayments, 'debt payments'],
    [summary.habits, 'habit results'],
    [summary.workouts, 'workouts'],
  ]
  const said = parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`)
  if (said.length === 0) return 'There was nothing to clear this month.'
  return `Cleared ${said.join(', ')}.`
}
