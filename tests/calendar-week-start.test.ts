import { describe, expect, it } from 'vitest'
import { leadingCellsForMonth, orderWeekdays, isoDateWeekday } from '../src/utils/timezone'

const INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

/**
 * The calendar grid, with either first day of the week.
 *
 * The interesting case is a month that begins on a Sunday while the week starts
 * on Monday: it needs six leading cells, and the obvious subtraction gives
 * minus one, which collapses the first row instead of filling it.
 */
describe('leadingCellsForMonth', () => {
  it('needs no leading cells when the month starts on the chosen first day', () => {
    // 2026-02-01 is a Sunday.
    expect(isoDateWeekday('2026-02-01')).toBe(0)
    expect(leadingCellsForMonth('2026-02', 0)).toBe(0)
  })

  it('wraps to six rather than minus one when a Sunday month starts a Monday week', () => {
    expect(leadingCellsForMonth('2026-02', 1)).toBe(6)
  })

  it('shifts every month by exactly one between the two settings', () => {
    for (let month = 1; month <= 12; month++) {
      const key = `2026-${String(month).padStart(2, '0')}`
      const sunday = leadingCellsForMonth(key, 0)
      const monday = leadingCellsForMonth(key, 1)
      expect(monday).toBe((sunday + 6) % 7)
    }
  })

  it('never returns a value outside a week', () => {
    for (let year = 2024; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`
        for (const start of [0, 1] as const) {
          const cells = leadingCellsForMonth(key, start)
          expect(cells).toBeGreaterThanOrEqual(0)
          expect(cells).toBeLessThanOrEqual(6)
        }
      }
    }
  })

  it('puts the 1st under its own weekday heading', () => {
    // The column index of the 1st is the leading-cell count, and the heading
    // at that index must be the real weekday initial of the 1st.
    for (const start of [0, 1] as const) {
      const headings = orderWeekdays(INITIALS, start)
      for (let month = 1; month <= 12; month++) {
        const key = `2026-${String(month).padStart(2, '0')}`
        const column = leadingCellsForMonth(key, start)
        expect(headings[column]).toBe(INITIALS[isoDateWeekday(`${key}-01`)])
      }
    }
  })
})

describe('orderWeekdays', () => {
  it('leaves Sunday first alone', () => {
    expect(orderWeekdays(INITIALS, 0)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
  })

  it('moves Sunday to the end for a Monday start', () => {
    expect(orderWeekdays(INITIALS, 1)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('always returns seven days and loses none of them', () => {
    for (const start of [0, 1] as const) {
      const out = orderWeekdays(INITIALS, start)
      expect(out).toHaveLength(7)
      expect([...out].sort()).toEqual([...INITIALS].sort())
    }
  })
})
