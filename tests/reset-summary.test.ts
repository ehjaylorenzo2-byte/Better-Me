import { describe, expect, it } from 'vitest'
import { describeResetSummary, type ResetSummary } from '../src/services/reset'

function summary(over: Partial<ResetSummary> = {}): ResetSummary {
  return {
    habits: 0,
    workouts: 0,
    income: 0,
    expenses: 0,
    transfers: 0,
    savings: 0,
    debtPayments: 0,
    ...over,
  }
}

/**
 * The sentence shown after a month is cleared. It has to be true: never claim
 * something was removed when nothing was, and never quietly omit a category
 * that did have rows in it.
 */
describe('describeResetSummary', () => {
  it('says so plainly when the month was already empty', () => {
    expect(describeResetSummary(summary())).toBe('There was nothing to clear this month.')
  })

  it('names only the things that actually had rows', () => {
    const said = describeResetSummary(summary({ expenses: 3, habits: 2 }))
    expect(said).toContain('3 expenses')
    expect(said).toContain('2 habit results')
    expect(said).not.toContain('transfers')
    expect(said).not.toContain('workouts')
  })

  it('leads with money, because that is what people check first', () => {
    const said = describeResetSummary(summary({ habits: 1, income: 1 }))
    expect(said.indexOf('income')).toBeLessThan(said.indexOf('habit'))
  })

  it('mentions every category when everything had rows', () => {
    const said = describeResetSummary(
      summary({ habits: 1, workouts: 1, income: 1, expenses: 1, transfers: 1, savings: 1, debtPayments: 1 }),
    )
    for (const word of ['income', 'expenses', 'transfers', 'savings', 'debt payments', 'habit', 'workouts']) {
      expect(said).toContain(word)
    }
  })

  it('uses no em dashes and no jargon', () => {
    const said = describeResetSummary(summary({ savings: 2, debtPayments: 1 }))
    expect(said).not.toContain('—')
    expect(said).not.toMatch(/rpc|occurrence|mutation|cron|row/i)
  })
})
