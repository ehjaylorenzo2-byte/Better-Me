import { describe, it, expect } from 'vitest'
import { scheduleAppliesOnDate, expandScheduleInRange } from '@/utils/recurrence'
import type { HabitSchedule } from '@/types/models'

function makeSchedule(overrides: Partial<HabitSchedule>): HabitSchedule {
  return {
    id: 's1',
    habitId: 'h1',
    recurrence: 'daily',
    weekdays: null,
    time: '18:00',
    startDate: '2026-08-01',
    endDate: null,
    reminderEnabled: true,
    supersedesScheduleId: null,
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('recurrence engine', () => {
  it('expands a daily schedule across every day in range', () => {
    const schedule = makeSchedule({ recurrence: 'daily' })
    const dates = expandScheduleInRange(schedule, '2026-08-01', '2026-08-05')
    expect(dates).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'])
  })

  it('expands a weekly Mon/Wed/Fri schedule correctly (spec #18 example)', () => {
    const schedule = makeSchedule({ recurrence: 'weekly', weekdays: [1, 3, 5], startDate: '2026-08-03' })
    const dates = expandScheduleInRange(schedule, '2026-08-03', '2026-08-09')
    // Aug 3 2026 is a Monday
    expect(dates).toEqual(['2026-08-03', '2026-08-05', '2026-08-07'])
  })

  it('does not apply before the start date', () => {
    const schedule = makeSchedule({ recurrence: 'daily', startDate: '2026-08-10' })
    expect(scheduleAppliesOnDate(schedule, '2026-08-09')).toBe(false)
    expect(scheduleAppliesOnDate(schedule, '2026-08-10')).toBe(true)
  })

  it('does not apply after an end date (used for closing out a superseded schedule)', () => {
    const schedule = makeSchedule({ recurrence: 'daily', startDate: '2026-08-01', endDate: '2026-08-19' })
    expect(scheduleAppliesOnDate(schedule, '2026-08-19')).toBe(true)
    expect(scheduleAppliesOnDate(schedule, '2026-08-20')).toBe(false)
  })

  it('preserves historical schedule when edited "this and future" (spec #20 example)', () => {
    // Original: Mon/Wed/Fri through Aug 19. New: Tue/Thu/Sat from Aug 20.
    const original = makeSchedule({
      recurrence: 'weekly',
      weekdays: [1, 3, 5],
      startDate: '2026-08-01',
      endDate: '2026-08-19',
    })
    const updated = makeSchedule({
      id: 's2',
      recurrence: 'weekly',
      weekdays: [2, 4, 6],
      startDate: '2026-08-20',
      supersedesScheduleId: 's1',
    })

    const originalDates = expandScheduleInRange(original, '2026-08-01', '2026-08-19')
    const updatedDates = expandScheduleInRange(updated, '2026-08-20', '2026-08-26')

    // Aug 1-19 unaffected by the Aug 20 change.
    expect(originalDates.every((d) => d <= '2026-08-19')).toBe(true)
    expect(updatedDates.every((d) => d >= '2026-08-20')).toBe(true)
  })

  it('once recurrence only produces a single occurrence', () => {
    const schedule = makeSchedule({ recurrence: 'once', startDate: '2026-08-15' })
    const dates = expandScheduleInRange(schedule, '2026-08-01', '2026-08-31')
    expect(dates).toEqual(['2026-08-15'])
  })
})
