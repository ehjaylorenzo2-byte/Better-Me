import { describe, expect, it } from 'vitest'
import { getMotivationMessage } from '../src/utils/motivation'
import { getPhilippineMonthRange } from '../src/utils/timezone'
import type { DailyProgress } from '../src/utils/calculations'

function progress(done: number, skipped: number, cancelled: number, noStatus = 0): DailyProgress {
  const finalized = done + skipped + cancelled
  const scheduled = finalized + noStatus
  return {
    scheduled,
    done,
    skipped,
    cancelled,
    noStatus,
    scheduledCompletionRate: scheduled === 0 ? 0 : (done / scheduled) * 100,
    doneRateAmongFinalized: finalized === 0 ? 0 : (done / finalized) * 100,
  }
}

/**
 * Month ranges.
 *
 * Four queries used to build the end of the month as `${month}-31`. February
 * has never had a 31st, so those queries were asking Postgres for an impossible
 * date every time the calendar rolled into a short month.
 */
describe('getPhilippineMonthRange', () => {
  it('ends February on the 28th in a normal year', () => {
    expect(getPhilippineMonthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('ends February on the 29th in a leap year', () => {
    expect(getPhilippineMonthRange('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' })
    expect(getPhilippineMonthRange('2000-02').end).toBe('2000-02-29')
  })

  it('knows 2100 is not a leap year', () => {
    expect(getPhilippineMonthRange('2100-02').end).toBe('2100-02-28')
  })

  it('ends a 30-day month on the 30th', () => {
    for (const m of ['04', '06', '09', '11']) {
      expect(getPhilippineMonthRange(`2026-${m}`).end).toBe(`2026-${m}-30`)
    }
  })

  it('ends a 31-day month on the 31st', () => {
    for (const m of ['01', '03', '05', '07', '08', '10', '12']) {
      expect(getPhilippineMonthRange(`2026-${m}`).end).toBe(`2026-${m}-31`)
    }
  })

  it('never produces a date that does not exist', () => {
    for (let year = 2024; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`
        const { end } = getPhilippineMonthRange(key)
        const [y, m, d] = end.split('-').map(Number)
        const parsed = new Date(Date.UTC(y, m - 1, d))
        // A rolled-over date means we asked for a day the month does not have.
        expect(parsed.getUTCMonth()).toBe(m - 1)
        expect(parsed.getUTCDate()).toBe(d)
      }
    }
  })
})

describe('motivation tone', () => {
  const bad = progress(1, 0, 0, 0) // 100 percent... of one finalized item
  const terrible = progress(1, 9, 0)
  const good = progress(9, 1, 0)

  it('never roasts someone who is doing well, whatever the tone', () => {
    for (const tone of ['encourage', 'balanced', 'roast', 'brutal'] as const) {
      const message = getMotivationMessage(good, 0, tone)
      expect(message).not.toMatch(/lazy|decoration|excuse/i)
    }
  })

  it('never roasts at all on the gentlest tone, even on a bad day', () => {
    const message = getMotivationMessage(terrible, 0, 'encourage')
    expect(message).not.toMatch(/lazy|decoration|excuse|ignore/i)
  })

  it('gets harsher as the tone goes up on the same bad day', () => {
    const soft = getMotivationMessage(terrible, 0, 'encourage')
    const hard = getMotivationMessage(terrible, 0, 'brutal')
    expect(soft).not.toBe(hard)
  })

  it('calls out a day that was mostly skipped, but never on the gentlest tone', () => {
    // Four of six skipped or cancelled: its own failure mode, not just a low score.
    const mostlySkipped = progress(2, 3, 1)
    expect(getMotivationMessage(mostlySkipped, 3, 'balanced')).toMatch(/skip|cancel|excuse/i)
    expect(getMotivationMessage(mostlySkipped, 3, 'roast')).toMatch(/skip|cancel|excuse/i)
    expect(getMotivationMessage(mostlySkipped, 3, 'encourage')).not.toMatch(/excuse|never real/i)
  })

  it('says something neutral when nothing has been decided yet', () => {
    expect(getMotivationMessage(progress(0, 0, 0, 5), 0, 'brutal')).toMatch(/Nothing logged yet/i)
  })

  it('does not divide by zero on an empty day', () => {
    expect(() => getMotivationMessage(progress(0, 0, 0, 0), 0)).not.toThrow()
  })

  it('is stable for the same day and changes across days', () => {
    expect(getMotivationMessage(bad, 3, 'balanced')).toBe(getMotivationMessage(bad, 3, 'balanced'))
  })

  it('contains no em dashes, as specified', () => {
    for (const tone of ['encourage', 'balanced', 'roast', 'brutal'] as const) {
      for (let seed = 0; seed < 8; seed++) {
        for (const p of [good, terrible, progress(5, 5, 0), progress(2, 3, 1)]) {
          expect(getMotivationMessage(p, seed, tone)).not.toContain('—')
        }
      }
    }
  })
})
