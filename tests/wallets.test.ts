import { describe, expect, it } from 'vitest'
import {
  calculateMoneyOut,
  movementDirection,
  sortMovements,
  sumAccountBalances,
  takeRecent,
} from '../src/utils/calculations'

describe('sumAccountBalances', () => {
  it('adds every wallet together', () => {
    expect(
      sumAccountBalances([{ balance: 2000000 }, { balance: 600000 }, { balance: 500000 }]),
    ).toBe(3100000)
  })

  it('lets a negative wallet drag the total down instead of clamping it', () => {
    // A Cash account below zero means spending was logged that was never funded.
    // Hiding that by flooring at zero would make the total quietly wrong.
    expect(sumAccountBalances([{ balance: 500000 }, { balance: -50000 }])).toBe(450000)
  })

  it('is zero with no accounts', () => {
    expect(sumAccountBalances([])).toBe(0)
  })
})

describe('calculateMoneyOut', () => {
  it('counts debt payments as spending', () => {
    const out = calculateMoneyOut([{ amount: 26000 }, { amount: 18500 }], [{ amount: 200000 }])
    expect(out).toBe(244500)
  })

  it('works with no debt payments at all', () => {
    expect(calculateMoneyOut([{ amount: 26000 }])).toBe(26000)
  })

  it('is zero on an empty month', () => {
    expect(calculateMoneyOut([], [])).toBe(0)
  })
})

describe('movementDirection', () => {
  it('treats transfers and savings as movement, not spending', () => {
    // The whole wallet model rests on this: money moved between your own
    // accounts has not left you, so it must not change Total Balance.
    expect(movementDirection('transfer')).toBe('moved')
    expect(movementDirection('savings')).toBe('moved')
  })

  it('treats income as in, and expenses and debt payments as out', () => {
    expect(movementDirection('income')).toBe('in')
    expect(movementDirection('expense')).toBe('out')
    expect(movementDirection('debt')).toBe('out')
  })
})

describe('sortMovements', () => {
  const rows = [
    { id: 'a', entryDate: '2026-08-08', createdAt: '2026-08-08T10:00:00Z' },
    { id: 'b', entryDate: '2026-08-10', createdAt: '2026-08-10T09:00:00Z' },
    { id: 'c', entryDate: '2026-08-10', createdAt: '2026-08-10T18:00:00Z' },
    { id: 'd', entryDate: '2026-08-09', createdAt: '2026-08-09T12:00:00Z' },
  ]

  it('puts the newest day first', () => {
    expect(sortMovements(rows).map((r) => r.id)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('breaks ties within a day by when it was entered', () => {
    const sameDay = [
      { id: 'first', entryDate: '2026-08-10', createdAt: '2026-08-10T08:00:00Z' },
      { id: 'later', entryDate: '2026-08-10', createdAt: '2026-08-10T20:00:00Z' },
    ]
    expect(sortMovements(sameDay).map((r) => r.id)).toEqual(['later', 'first'])
  })

  it('does not mutate the array it was given', () => {
    const original = [...rows]
    sortMovements(rows)
    expect(rows).toEqual(original)
  })
})

describe('takeRecent', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    entryDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
    createdAt: `2026-08-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
  }))

  it('returns the five newest by default', () => {
    expect(takeRecent(many).map((r) => r.id)).toEqual(['11', '10', '9', '8', '7'])
  })

  it('returns everything when there is less than the limit', () => {
    expect(takeRecent(many.slice(0, 3))).toHaveLength(3)
  })
})

/**
 * The worked example from the spec, run through the same helpers the screen
 * uses. The per-account arithmetic itself lives in the database view, so what
 * this pins down is the part the client owns: that moving money between your
 * own accounts leaves the total alone, and that only spending reduces it.
 */
describe('the worked example', () => {
  it('holds the total steady through a transfer and a savings deposit', () => {
    const afterIncome = [{ balance: 3500000 }, { balance: 0 }, { balance: 0 }]
    expect(sumAccountBalances(afterIncome)).toBe(3500000)

    const afterTransfer = [{ balance: 2500000 }, { balance: 1000000 }, { balance: 0 }]
    expect(sumAccountBalances(afterTransfer)).toBe(3500000)

    const afterExpense = [{ balance: 2500000 }, { balance: 800000 }, { balance: 0 }]
    expect(sumAccountBalances(afterExpense)).toBe(3300000)

    const afterSaving = [{ balance: 2000000 }, { balance: 800000 }, { balance: 500000 }]
    expect(sumAccountBalances(afterSaving)).toBe(3300000)

    const afterDebtPayment = [{ balance: 2000000 }, { balance: 600000 }, { balance: 500000 }]
    expect(sumAccountBalances(afterDebtPayment)).toBe(3100000)
  })
})
