import { describe, it, expect } from 'vitest'
import {
  calculateDoneRate,
  splitSpendable,
  sumAccountBalances,
  calculateSkippedCancelledRate,
  calculateDailyProgress,
  calculateBudgetRemaining,
  calculateTotalSavings,
  calculateSavingsProgress,
  calculateTotalDebt,
  calculateNewDebtBalance,
  validateDebtPayment,
  isDebtPaidOff,
  validateSavingsWithdrawal,
  emptyStatusCounts,
} from '@/utils/calculations'

describe('habit rate calculations', () => {
  it('computes done rate among finalized items, ignoring no-status items', () => {
    // 4 done, 1 skipped, 0 cancelled, 5 no-status (per spec example section 23)
    const counts = { done: 4, skipped: 1, cancelled: 0, noStatus: 5 }
    expect(calculateDoneRate(counts)).toBeCloseTo(80) // 4/5
  })

  it('prevents division by zero when nothing is finalized', () => {
    expect(calculateDoneRate(emptyStatusCounts())).toBe(0)
    expect(calculateSkippedCancelledRate(emptyStatusCounts())).toBe(0)
  })

  it('computes combined skip/cancel rate', () => {
    const counts = { done: 2, skipped: 1, cancelled: 1, noStatus: 0 }
    expect(calculateSkippedCancelledRate(counts)).toBeCloseTo(50)
  })

  it('does not conflate scheduled completion with done-rate-among-finalized (spec #23)', () => {
    // 10 scheduled, 4 done, 1 skipped, 0 cancelled, 5 no-status
    const statuses = [
      'done',
      'done',
      'done',
      'done',
      'skipped',
      null,
      null,
      null,
      null,
      null,
    ] as Array<'done' | 'skipped' | 'cancelled' | null>
    const progress = calculateDailyProgress(statuses)
    expect(progress.scheduledCompletionRate).toBeCloseTo(40) // 4/10 -- NOT 80%
    expect(progress.doneRateAmongFinalized).toBeCloseTo(80) // 4/5
  })
})

describe('budget', () => {
  it('never silently clamps a negative remaining to zero', () => {
    const summary = calculateBudgetRemaining(2000000, 2500000) // budget 20000, spent 25000
    expect(summary.isOverBudget).toBe(true)
    expect(summary.remaining).toBe(-500000)
    expect(summary.overBy).toBe(500000)
  })

  it('reports remaining correctly when under budget', () => {
    const summary = calculateBudgetRemaining(2000000, 1500000)
    expect(summary.isOverBudget).toBe(false)
    expect(summary.remaining).toBe(500000)
  })
})

describe('savings', () => {
  it('sums independent category balances for total savings', () => {
    expect(calculateTotalSavings([2000000, 850000, 600000, 800000])).toBe(4250000)
  })

  it('computes savings goal progress safely, capped at 100', () => {
    expect(calculateSavingsProgress(2000000, 5000000)).toBeCloseTo(40)
    expect(calculateSavingsProgress(6000000, 5000000)).toBe(100)
  })

  it('returns null progress when goal is missing or zero (prevents div by zero)', () => {
    expect(calculateSavingsProgress(1000, null)).toBeNull()
    expect(calculateSavingsProgress(1000, 0)).toBeNull()
    expect(calculateSavingsProgress(1000, undefined)).toBeNull()
  })

  it('rejects a withdrawal larger than the category balance', () => {
    const result = validateSavingsWithdrawal(500000, 600000)
    expect(result.valid).toBe(false)
  })

  it('allows a withdrawal exactly equal to the balance', () => {
    const result = validateSavingsWithdrawal(500000, 500000)
    expect(result.valid).toBe(true)
  })
})

describe('debt', () => {
  it('sums only active (non-paid-off) debts for total debt', () => {
    expect(calculateTotalDebt([1700000, 2000000, 5000000])).toBe(8700000)
  })

  it('rejects a payment that exceeds the current balance', () => {
    const result = validateDebtPayment(200000, 300000)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('2,000.00')
  })

  it('rejects a zero or negative payment', () => {
    expect(validateDebtPayment(200000, 0).valid).toBe(false)
    expect(validateDebtPayment(200000, -100).valid).toBe(false)
  })

  it('computes the new balance after a valid payment, never negative', () => {
    expect(calculateNewDebtBalance(2500000, 300000)).toBe(2200000)
    expect(calculateNewDebtBalance(1000, 5000)).toBe(0) // safety clamp
  })

  it('marks a debt paid off exactly at zero balance', () => {
    expect(isDebtPaidOff(0)).toBe(true)
    expect(isDebtPaidOff(1)).toBe(false)
  })
})

/*
  Total balance answers "how much can I spend", so a savings wallet must not
  inflate it. These pin the split down because the alternative — noticing the
  headline is wrong — only happens when you have already overspent.
*/
describe('splitSpendable', () => {
  const w = (balance: number, flow: 'outgoing' | 'savings' | 'both') => ({ balance, flow })

  it('holds back savings wallets and keeps the rest spendable', () => {
    const { spendable, held } = splitSpendable([
      w(604100, 'both'),
      w(3700000, 'savings'),
      w(-18500, 'outgoing'),
    ])
    expect(spendable).toBe(585600)
    expect(held).toBe(3700000)
  })

  it('treats a both-flow wallet as spendable, not as savings', () => {
    expect(splitSpendable([w(1000, 'both')])).toEqual({ spendable: 1000, held: 0 })
  })

  it('keeps the two halves adding up to the old total', () => {
    const wallets = [w(500, 'both'), w(250, 'savings'), w(-75, 'outgoing')]
    const { spendable, held } = splitSpendable(wallets)
    expect(spendable + held).toBe(sumAccountBalances(wallets))
  })

  it('carries a negative savings wallet into held rather than silently dropping it', () => {
    expect(splitSpendable([w(-400, 'savings')])).toEqual({ spendable: 0, held: -400 })
  })

  it('returns zeroes for no wallets', () => {
    expect(splitSpendable([])).toEqual({ spendable: 0, held: 0 })
  })
})
