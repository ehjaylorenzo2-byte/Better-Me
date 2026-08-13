import { describe, expect, it } from 'vitest'
import { calculateBudgetSpend, calculateBudgetRemaining, calculateMoneyOut } from '../src/utils/calculations'

const peso = (n: number) => n * 100

/**
 * One budget rule, three screens.
 *
 * Finance counted debt payments against the budget, Budget and Home did not.
 * The same month read "₱1,000 left" on one screen and "₱5,000 left" on another,
 * which is worse than either answer being wrong on its own, because it makes
 * the whole number untrustworthy.
 *
 * The brief's worked example is the first test below.
 */
describe('what counts against a monthly budget', () => {
  const expenses = [{ amount: peso(15_000) }]
  const debtPayments = [{ amount: peso(4_000) }]

  it('counts expenses and debt payments, the case the three screens disagreed on', () => {
    expect(calculateBudgetSpend(expenses, debtPayments)).toBe(peso(19_000))

    const summary = calculateBudgetRemaining(peso(20_000), calculateBudgetSpend(expenses, debtPayments))
    expect(summary.remaining).toBe(peso(1_000))
    expect(summary.isOverBudget).toBe(false)
  })

  it('agrees with Money out, so the two figures can never drift apart again', () => {
    expect(calculateBudgetSpend(expenses, debtPayments)).toBe(calculateMoneyOut(expenses, debtPayments))
  })

  it('does not count money moved into savings', () => {
    // Savings has no representation here at all, by design: it is still your
    // money. The brief's example is 40,000 in, 3,000 food, 2,000 transport,
    // 10,000 to savings, and lifestyle spending of 5,000 rather than 15,000.
    const monthExpenses = [{ amount: peso(3_000) }, { amount: peso(2_000) }]
    expect(calculateBudgetSpend(monthExpenses)).toBe(peso(5_000))
  })

  it('treats no debt payments the same as an empty list', () => {
    expect(calculateBudgetSpend(expenses)).toBe(calculateBudgetSpend(expenses, []))
  })

  it('reports going over rather than clamping at zero', () => {
    const summary = calculateBudgetRemaining(peso(10_000), calculateBudgetSpend(expenses, debtPayments))
    expect(summary.isOverBudget).toBe(true)
    expect(summary.overBy).toBe(peso(9_000))
    expect(summary.remaining).toBe(peso(-9_000))
  })

  it('stays exact in centavos, with no floating point drift', () => {
    const odd = [{ amount: 1_999 }, { amount: 2_001 }, { amount: 3_333 }]
    expect(calculateBudgetSpend(odd)).toBe(7_333)
    expect(Number.isInteger(calculateBudgetSpend(odd))).toBe(true)
  })

  it('handles an empty month', () => {
    expect(calculateBudgetSpend([], [])).toBe(0)
    expect(calculateBudgetRemaining(peso(20_000), 0).remaining).toBe(peso(20_000))
  })
})
