import type { Centavos } from './money'
import { addCentavos } from './money'
import type { HabitStatus } from '@/types/models'

export interface StatusCounts {
  done: number
  skipped: number
  cancelled: number
  /** scheduled items whose status is still null (no decision yet) */
  noStatus: number
}

export function emptyStatusCounts(): StatusCounts {
  return { done: 0, skipped: 0, cancelled: 0, noStatus: 0 }
}

export function tallyStatuses(statuses: Array<HabitStatus | null>): StatusCounts {
  const counts = emptyStatusCounts()
  for (const s of statuses) {
    if (s === 'done') counts.done++
    else if (s === 'skipped') counts.skipped++
    else if (s === 'cancelled') counts.cancelled++
    else counts.noStatus++
  }
  return counts
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

/** Done / (Done + Skipped + Cancelled) x 100. Finalized-only, prevents division by zero. */
export function calculateDoneRate(counts: StatusCounts): number {
  const finalized = counts.done + counts.skipped + counts.cancelled
  return safeRate(counts.done, finalized)
}

export function calculateSkippedRate(counts: StatusCounts): number {
  const finalized = counts.done + counts.skipped + counts.cancelled
  return safeRate(counts.skipped, finalized)
}

export function calculateCancelledRate(counts: StatusCounts): number {
  const finalized = counts.done + counts.skipped + counts.cancelled
  return safeRate(counts.cancelled, finalized)
}

/** Combined Skip/Cancel Rate = (Skipped + Cancelled) / (Done + Skipped + Cancelled) x 100 */
export function calculateSkippedCancelledRate(counts: StatusCounts): number {
  const finalized = counts.done + counts.skipped + counts.cancelled
  return safeRate(counts.skipped + counts.cancelled, finalized)
}

export interface DailyProgress {
  scheduled: number
  done: number
  skipped: number
  cancelled: number
  noStatus: number
  /** Done / total scheduled — "how much of today is actually finished" */
  scheduledCompletionRate: number
  /** Done / (Done+Skipped+Cancelled) — "of decisions made, how many were Done" */
  doneRateAmongFinalized: number
}

/** Computes both scheduled-completion and done-rate-among-finalized views. Never conflates the two. */
export function calculateDailyProgress(statuses: Array<HabitStatus | null>): DailyProgress {
  const counts = tallyStatuses(statuses)
  const scheduled = statuses.length
  return {
    scheduled,
    done: counts.done,
    skipped: counts.skipped,
    cancelled: counts.cancelled,
    noStatus: counts.noStatus,
    scheduledCompletionRate: safeRate(counts.done, scheduled),
    doneRateAmongFinalized: calculateDoneRate(counts),
  }
}

export interface BudgetSummary {
  budget: Centavos
  spent: Centavos
  remaining: Centavos
  isOverBudget: boolean
  overBy: Centavos
}

/** Budget Remaining = Monthly Budget - Eligible Expenses. Never silently clamps to zero. */
export function calculateBudgetRemaining(budget: Centavos, spent: Centavos): BudgetSummary {
  const remaining = budget - spent
  return {
    budget,
    spent,
    remaining,
    isOverBudget: remaining < 0,
    overBy: remaining < 0 ? Math.abs(remaining) : 0,
  }
}

export function calculateTotalSavings(categoryBalances: Centavos[]): Centavos {
  return addCentavos(...categoryBalances)
}

/** Savings Progress = Current / Goal x 100. Returns null if goal is missing/zero (prevents div-by-zero). */
export function calculateSavingsProgress(current: Centavos, goal: Centavos | null | undefined): number | null {
  if (!goal || goal <= 0) return null
  return Math.min(100, safeRate(current, goal))
}

export function calculateTotalDebt(activeDebtBalances: Centavos[]): Centavos {
  return addCentavos(...activeDebtBalances)
}

export interface DebtPaymentValidation {
  valid: boolean
  error?: string
}

export function validateDebtPayment(currentBalance: Centavos, payment: Centavos): DebtPaymentValidation {
  if (payment <= 0) return { valid: false, error: 'Enter a payment amount greater than zero.' }
  if (payment > currentBalance) {
    return {
      valid: false,
      error: `Your remaining balance is ${formatBalanceForError(currentBalance)}. Enter a payment up to this amount.`,
    }
  }
  return { valid: true }
}

function formatBalanceForError(centavos: Centavos): string {
  // Local minimal formatter to avoid circular import with money.ts formatCurrency in edge cases.
  const peso = centavos / 100
  return `₱${peso.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function calculateNewDebtBalance(currentBalance: Centavos, payment: Centavos): Centavos {
  return Math.max(0, currentBalance - payment)
}

export function isDebtPaidOff(balance: Centavos): boolean {
  return balance <= 0
}

export interface SavingsTxValidation {
  valid: boolean
  error?: string
}

export function validateSavingsWithdrawal(currentBalance: Centavos, amount: Centavos): SavingsTxValidation {
  if (amount <= 0) return { valid: false, error: 'Enter an amount greater than zero.' }
  if (amount > currentBalance) {
    return { valid: false, error: `This category only has ${formatBalanceForError(currentBalance)} saved.` }
  }
  return { valid: true }
}

export function validateSavingsDeposit(amount: Centavos): SavingsTxValidation {
  if (amount <= 0) return { valid: false, error: 'Enter an amount greater than zero.' }
  return { valid: true }
}

// ---------------------------------------------------------------------------
// Per-bank totals
// ---------------------------------------------------------------------------

export type AccountFlowKind = 'outgoing' | 'savings' | 'both'

export interface AccountTotalsInput {
  id: string
  flow: AccountFlowKind
}

export interface TaggedAmount {
  accountId: string | null
  amount: Centavos
}

export interface AccountTotals {
  id: string
  /** Money that left this account: expenses paid from it, transfers out of it. */
  out: Centavos
  /** Money that arrived: income landing in it, transfers into it. */
  in: Centavos
  /**
   * The single number the bank row shows.
   *
   * An outgoing account reports what it cost you; a savings account reports
   * what you put away. These mean opposite things, so the UI must never sum
   * this column across accounts of different flows, and neither should we.
   */
  headline: Centavos
  headlineIsSpending: boolean
}

export interface TransferLeg {
  fromAccountId: string | null
  toAccountId: string | null
  amount: Centavos
}

/**
 * Rolls month entries up per bank.
 *
 * Entries with no account are skipped rather than bucketed into an "unknown"
 * row: tagging is optional, and an untagged jeepney fare should not create a
 * phantom bank. Those amounts still count in every overall total, they just do
 * not claim to have come from anywhere in particular.
 */
export function calculateAccountTotals(
  accounts: AccountTotalsInput[],
  expenses: TaggedAmount[],
  income: TaggedAmount[],
  transfers: TransferLeg[] = [],
): AccountTotals[] {
  const out = new Map<string, Centavos>()
  const inflow = new Map<string, Centavos>()

  const bump = (map: Map<string, Centavos>, id: string | null, amount: Centavos) => {
    if (!id) return
    map.set(id, (map.get(id) ?? 0) + amount)
  }

  for (const e of expenses) bump(out, e.accountId, e.amount)
  for (const i of income) bump(inflow, i.accountId, i.amount)
  for (const t of transfers) {
    bump(out, t.fromAccountId, t.amount)
    bump(inflow, t.toAccountId, t.amount)
  }

  return accounts.map((account) => {
    const spent = out.get(account.id) ?? 0
    const received = inflow.get(account.id) ?? 0
    // "both" reports spending, because that is the question people actually
    // ask of a wallet they spend from.
    const headlineIsSpending = account.flow !== 'savings'
    return {
      id: account.id,
      out: spent,
      in: received,
      headline: headlineIsSpending ? spent : received,
      headlineIsSpending,
    }
  })
}
