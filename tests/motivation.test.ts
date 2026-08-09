import { describe, it, expect } from 'vitest'
import { getMotivationMessage } from '@/utils/motivation'
import { calculateDailyProgress } from '@/utils/calculations'

describe('motivation system (data-driven, spec #24)', () => {
  it('never uses an em dash in any phrase', () => {
    const scenarios = [
      ['done', 'done', 'done', 'done', 'done'],
      ['done', 'done', 'done', 'skipped', 'skipped'],
      ['done', 'skipped', 'skipped', 'cancelled', 'cancelled'],
      ['skipped', 'cancelled', 'cancelled', 'cancelled'],
    ] as const
    for (const statuses of scenarios) {
      const progress = calculateDailyProgress([...statuses])
      const message = getMotivationMessage(progress, 1)
      expect(message).not.toContain('—')
    }
  })

  it('gives strong encouragement at high done rate', () => {
    const progress = calculateDailyProgress(['done', 'done', 'done', 'done', 'skipped'])
    expect(progress.doneRateAmongFinalized).toBeCloseTo(80)
    const message = getMotivationMessage(progress, 0)
    expect(typeof message).toBe('string')
    expect(message.length).toBeGreaterThan(0)
  })

  it('roasts harder when skip+cancel rate is high regardless of raw done rate', () => {
    const progress = calculateDailyProgress(['cancelled', 'cancelled', 'cancelled', 'done'])
    const message = getMotivationMessage(progress, 0)
    expect(message.toLowerCase()).toMatch(/skip|cancel|excuse/)
  })
})
