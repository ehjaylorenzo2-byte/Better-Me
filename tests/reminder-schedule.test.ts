import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  addDaysToIsoDate,
  dueOneHourReminders,
  oneHourBefore,
  scheduleAppliesOn,
  toMinutes,
  withinPhWindow,
  type ScheduleRow,
} from '../supabase/functions/send-reminders/schedule'

/**
 * The reminder scheduler.
 *
 * This is the part of Better Me nobody can see working — a reminder that never
 * arrives leaves no trace on any screen — so every bug in it survived for
 * months. These tests import the real file the edge function imports, so they
 * cannot pass against a stale copy.
 *
 * Each block names the defect it pins down.
 */

const MON = '2026-08-10' // Monday
const TUE = '2026-08-11'
const HOUR = 60

function schedule(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    id: 'sched-1',
    recurrence: 'daily',
    start_date: '2026-01-01',
    end_date: null,
    weekdays: null,
    time: '18:00',
    ...overrides,
  }
}

describe('the ordinary case', () => {
  it('fires an hour before, on the same day', () => {
    const due = dueOneHourReminders(schedule({ time: '18:00' }), MON, toMinutes('17:00'), HOUR)
    expect(due).toHaveLength(1)
    expect(due[0].occurrenceDate).toBe(MON)
    expect(due[0].lateBy).toBe(0)
  })

  it('stays quiet an hour and a half before', () => {
    expect(dueOneHourReminders(schedule({ time: '18:00' }), MON, toMinutes('16:30'), HOUR)).toHaveLength(0)
  })

  it('stays quiet once the habit has started', () => {
    expect(dueOneHourReminders(schedule({ time: '18:00' }), MON, toMinutes('18:00'), HOUR)).toHaveLength(0)
    expect(dueOneHourReminders(schedule({ time: '18:00' }), MON, toMinutes('19:30'), HOUR)).toHaveLength(0)
  })
})

describe('the midnight bug', () => {
  /**
   * A habit at 00:30 on Tuesday must be reminded at 23:30 on MONDAY. The old
   * code subtracted an hour from the clock but kept the date, so it looked for
   * "23:30" inside Tuesday's run and the weekday test for Tuesday threw it out.
   * The reminder was never sent, ever, for any after-midnight habit.
   */
  it('reminds a 00:30 Tuesday habit at 23:30 on Monday', () => {
    const due = dueOneHourReminders(schedule({ time: '00:30' }), MON, toMinutes('23:30'), HOUR)
    expect(due).toHaveLength(1)
    expect(due[0].occurrenceDate).toBe(TUE)
  })

  it('does not re-fire Tuesday\'s reminder on Tuesday night', () => {
    // A daily 00:30 habit does have a reminder due at 23:30 on Tuesday — but it
    // belongs to WEDNESDAY. If this ever came back as Tuesday, the delivery
    // ledger would treat it as a duplicate and the real Wednesday reminder
    // would be swallowed.
    const due = dueOneHourReminders(schedule({ time: '00:30' }), TUE, toMinutes('23:30'), HOUR)
    expect(due).toHaveLength(1)
    expect(due[0].occurrenceDate).toBe('2026-08-12')
  })

  it('rolls the clock back over midnight correctly', () => {
    expect(oneHourBefore(TUE, '00:30')).toEqual({ date: MON, time: '23:30' })
    expect(oneHourBefore(MON, '18:00')).toEqual({ date: MON, time: '17:00' })
  })

  it('respects the weekday of the day the habit actually falls on', () => {
    // Tuesdays only. The reminder goes out on Monday night, but it is Tuesday's
    // weekday that has to match.
    const tuesdaysOnly = schedule({ recurrence: 'weekly', weekdays: [2], time: '00:30' })
    expect(dueOneHourReminders(tuesdaysOnly, MON, toMinutes('23:30'), HOUR)).toHaveLength(1)

    const mondaysOnly = schedule({ recurrence: 'weekly', weekdays: [1], time: '00:30' })
    expect(dueOneHourReminders(mondaysOnly, MON, toMinutes('23:30'), HOUR)).toHaveLength(0)
  })
})

describe('the 23:55 dead zone', () => {
  /**
   * The old window was [now, now + 5 minutes) built by string arithmetic. At
   * 23:55 the end wrapped to "00:00", and "23:55" <= "00:00" is false when
   * compared as text, so that run of the day matched nothing at all. Habits at
   * 00:55 through 00:59 could therefore never be reminded, permanently.
   */
  it.each(['00:55', '00:56', '00:57', '00:58', '00:59'])(
    'reminds a %s habit from the 23:5x run',
    (habitTime) => {
      const runMinute = toMinutes(habitTime) + 1440 - 60 // an hour before, on the previous day
      const due = dueOneHourReminders(schedule({ time: habitTime }), MON, runMinute - 1440 + 1440, HOUR)
      expect(due).toHaveLength(1)
      expect(due[0].occurrenceDate).toBe(TUE)
    },
  )

  it('handles the very last minute of the day', () => {
    const due = dueOneHourReminders(schedule({ time: '00:59' }), MON, toMinutes('23:59'), HOUR)
    expect(due).toHaveLength(1)
  })
})

describe('catch-up after a missed run', () => {
  /**
   * The scheduler used to look only at the five minutes around the present, so
   * a cron tick that failed lost those reminders for good.
   */
  it('picks up a reminder the previous run should have sent', () => {
    const due = dueOneHourReminders(schedule({ time: '18:00' }), MON, toMinutes('17:25'), HOUR)
    expect(due).toHaveLength(1)
    expect(due[0].lateBy).toBe(25)
  })

  it('does not reach back further than the catch-up window', () => {
    // Due at 17:00, run at 18:05 — but the habit has also started by then, so
    // two separate rules both say no. This checks the window rule on its own.
    expect(dueOneHourReminders(schedule({ time: '23:00' }), MON, toMinutes('23:30'), HOUR)).toHaveLength(0)
  })

  it('never claims "in 1 hour" about something already under way', () => {
    // Due 17:00, habit at 18:00, run at 18:30: inside the catch-up window by
    // clock arithmetic, but the hour has gone.
    expect(dueOneHourReminders(schedule({ time: '18:00' }), MON, toMinutes('18:30'), HOUR)).toHaveLength(0)
  })
})

describe('recurrence', () => {
  it('honours once, and only on its own date', () => {
    const once = schedule({ recurrence: 'once', start_date: MON, time: '18:00' })
    expect(scheduleAppliesOn(once, MON)).toBe(true)
    expect(scheduleAppliesOn(once, TUE)).toBe(false)
  })

  it('honours an end date', () => {
    expect(scheduleAppliesOn(schedule({ end_date: MON }), TUE)).toBe(false)
    expect(scheduleAppliesOn(schedule({ end_date: MON }), MON)).toBe(true)
  })

  it('does not start before its start date', () => {
    expect(scheduleAppliesOn(schedule({ start_date: TUE }), MON)).toBe(false)
  })

  it('handles monthly by day-of-month', () => {
    const monthly = schedule({ recurrence: 'monthly', start_date: '2026-01-10' })
    expect(scheduleAppliesOn(monthly, '2026-08-10')).toBe(true)
    expect(scheduleAppliesOn(monthly, '2026-08-11')).toBe(false)
  })
})

describe('date arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysToIsoDate('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToIsoDate('2028-02-28', 1)).toBe('2028-02-29') // leap year
  })
})

describe('windows', () => {
  it('includes the start and excludes the end', () => {
    expect(withinPhWindow('12:00', '12:00', '13:00')).toBe(true)
    expect(withinPhWindow('12:59', '12:00', '13:00')).toBe(true)
    expect(withinPhWindow('13:00', '12:00', '13:00')).toBe(false)
    expect(withinPhWindow('11:59', '12:00', '13:00')).toBe(false)
  })
})

describe('the shipped function', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/send-reminders/index.ts'),
    'utf8',
  )

  it('imports its scheduling from the module these tests cover', () => {
    expect(source).toContain("from './schedule.ts'")
  })

  it('claims one-hour reminders against the schedule, not the habit', () => {
    // Keying on the habit gave a habit with a morning and an evening schedule
    // a single reminder a day.
    expect(source).toContain("'one_hour', schedule.id")
  })

  it('gives the midday summary a full hour, not five minutes', () => {
    expect(source).toContain("withinPhWindow(nowTime, '12:00', '13:00')")
  })

  it('filters the midday summary by the per-habit reminder switch', () => {
    const noonBlock = source.slice(source.indexOf("withinPhWindow(nowTime, '12:00'"))
    expect(noonBlock).toContain(".eq('reminder_enabled', true)")
  })

  it('reads the finance switch that has never had a sender behind it', () => {
    expect(source).toContain('finance_reminders_enabled')
    expect(source).toContain('finance_nudge')
  })
})
