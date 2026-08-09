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
