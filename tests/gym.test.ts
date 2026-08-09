import { describe, it, expect } from 'vitest'
import { isGymDateEditable, isGymDateCompletable, isGymFutureDate } from '@/services/gym'

describe('gym date rules (spec #30)', () => {
  const today = '2026-08-10'

  it('locks past dates from editing', () => {
    expect(isGymDateEditable('2026-08-09', today)).toBe(false)
  })

  it('allows editing today', () => {
    expect(isGymDateEditable(today, today)).toBe(true)
  })

  it('allows editing/scheduling future dates but blocks completion', () => {
    expect(isGymDateEditable('2026-08-11', today)).toBe(true)
    expect(isGymDateCompletable('2026-08-11', today)).toBe(false)
    expect(isGymFutureDate('2026-08-11', today)).toBe(true)
  })

  it('only allows completion on today', () => {
    expect(isGymDateCompletable(today, today)).toBe(true)
    expect(isGymDateCompletable('2026-08-09', today)).toBe(false)
  })
})
