import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
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

/**
 * Coming back to a finished workout.
 *
 * Two separate things used to make the summary and the share image
 * disappear once you left them. Both are pinned here because neither shows
 * up as a crash — the screen just says it cannot load, or the route exists
 * with nothing pointing at it.
 */
describe('a finished workout stays reachable', () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

  it.each([
    'src/pages/gym/WorkoutSummaryPage.tsx',
    'src/pages/gym/ShareWorkoutPage.tsx',
  ])('%s reads the workout instead of creating one', (file) => {
    // getOrCreateWorkoutForDate INSERTs when it finds nothing, and the database
    // refuses a write to a past date — so opening yesterday's summary reported
    // "Could not load this workout" about a workout that was right there.
    const source = read(file)
    expect(source).not.toContain('getOrCreateWorkoutForDate')
    expect(source).toContain('getWorkoutForDate')
  })

  it('offers a way back from the workout itself', () => {
    // Completing was once the only route to these screens, so leaving the app
    // put them out of reach until you completed another workout.
    const source = read('src/pages/gym/WorkoutDetailsPage.tsx')
    expect(source).toContain('/summary')
    expect(source).toContain('/share')
  })
})
