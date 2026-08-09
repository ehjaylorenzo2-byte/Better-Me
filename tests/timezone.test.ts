import { describe, it, expect } from 'vitest'
import {
  philippineDateTimeToUtc,
  utcToPhilippineDate,
  getOneHourBeforeReminder,
  isoDateWeekday,
  addDaysToIsoDate,
  isPastPhilippineDate,
  isFuturePhilippineDate,
  isTodayPhilippineDate,
} from '@/utils/timezone'

describe('Asia/Manila timezone handling', () => {
  it('converts a PH local date+time to the correct UTC instant (UTC+8, no DST)', () => {
    const utc = philippineDateTimeToUtc('2026-08-10', '18:00')
    // 18:00 PHT == 10:00 UTC same day
    expect(utc.toISOString()).toBe('2026-08-10T10:00:00.000Z')
  })

  it('reads back the correct PH calendar date from a UTC instant near midnight', () => {
    // 2026-08-09T16:30:00Z is 2026-08-10T00:30 in Manila -- the PH day has already rolled over.
    const date = utcToPhilippineDate(new Date('2026-08-09T16:30:00.000Z'))
    expect(date).toBe('2026-08-10')
  })

  it('rolls the 1-hour-before reminder back over a PH calendar-day boundary (spec edge case)', () => {
    // Habit scheduled 12:30 AM -> reminder should be 11:30 PM the PREVIOUS Philippine date.
    const reminder = getOneHourBeforeReminder('2026-08-10', '00:30')
    expect(reminder.date).toBe('2026-08-09')
    expect(reminder.time).toBe('23:30')
  })

  it('computes a normal same-day 1-hour reminder', () => {
    const reminder = getOneHourBeforeReminder('2026-08-10', '18:00')
    expect(reminder.date).toBe('2026-08-10')
    expect(reminder.time).toBe('17:00')
  })

  it('weekday lookup matches JS Date convention (0=Sun..6=Sat)', () => {
    expect(isoDateWeekday('2026-08-10')).toBe(1) // Monday
    expect(isoDateWeekday('2026-08-09')).toBe(0) // Sunday
  })

  it('adds days across month boundaries correctly', () => {
    expect(addDaysToIsoDate('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDaysToIsoDate('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('classifies past/future/today relative to a fixed "today"', () => {
    const today = '2026-08-10'
    expect(isPastPhilippineDate('2026-08-09', today)).toBe(true)
    expect(isFuturePhilippineDate('2026-08-11', today)).toBe(true)
    expect(isTodayPhilippineDate('2026-08-10', today)).toBe(true)
    expect(isPastPhilippineDate('2026-08-10', today)).toBe(false)
  })
})
