/**
 * The reminder scheduler's decision-making, with no database and no network in
 * it, so it can be tested.
 *
 * This file is deliberately free of Deno and npm imports. The edge function
 * imports it with a relative path, which Deno resolves natively, and the test
 * suite imports the very same file — so what is proven is the code that ships,
 * not a copy of it that can drift away from it.
 *
 * Every rule here exists because the previous version got it wrong. The
 * comments say which.
 */

export const PH_TZ = 'Asia/Manila'

/** YYYY-MM-DD */
export type IsoDate = string
/** HH:mm */
export type IsoTime = string

export interface ScheduleRow {
  id: string
  recurrence: 'once' | 'daily' | 'weekly' | 'custom' | 'monthly' | string
  start_date: IsoDate
  end_date: IsoDate | null
  weekdays: number[] | null
  /** HH:mm or HH:mm:ss. */
  time: string
}

const phFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PH_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function phPartsOf(instant: Date): { date: IsoDate; time: IsoTime } {
  const parts = Object.fromEntries(phFormatter.formatToParts(instant).map((p) => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function addDaysToIsoDate(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function weekdayOf(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  // Noon UTC avoids any edge rounding.
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

/**
 * The reminder moment for a habit, as a real Philippine date AND time.
 *
 * This is the fix for the bug that made every after-midnight habit
 * unreachable. The old code subtracted sixty minutes from "00:30", got
 * "23:30", and then looked for it in that same day's run — but 23:30 belongs to
 * the day before, so the only run that could have matched was testing the wrong
 * calendar date, and its weekday check usually said no. The reminder was never
 * sent while a phantom one was searched for. Carrying the date along with the
 * time is the whole difference.
 *
 * Manila is a fixed UTC+8 with no daylight saving, which is the only reason
 * this arithmetic is allowed to be this direct.
 */
export function oneHourBefore(date: IsoDate, time: string): { date: IsoDate; time: IsoTime } {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.slice(0, 5).split(':').map(Number)
  const instant = new Date(Date.UTC(y, m - 1, d, hh - 8, mm, 0) - 60 * 60 * 1000)
  return phPartsOf(instant)
}

export function scheduleAppliesOn(schedule: ScheduleRow, date: IsoDate): boolean {
  if (schedule.start_date > date) return false
  if (schedule.end_date && schedule.end_date < date) return false
  switch (schedule.recurrence) {
    case 'once':
      return schedule.start_date === date
    case 'daily':
      return true
    case 'weekly':
    case 'custom': {
      const wd = weekdayOf(date)
      return schedule.weekdays ? schedule.weekdays.includes(wd) : weekdayOf(schedule.start_date) === wd
    }
    case 'monthly':
      return date.slice(8, 10) === schedule.start_date.slice(8, 10)
    default:
      return false
  }
}

export interface DueReminder {
  /** The day the habit is actually scheduled for — not always today. */
  occurrenceDate: IsoDate
  /** When the reminder was due, in Philippine wall-clock minutes past midnight. */
  dueMinute: number
  /** True when this run is picking up a reminder an earlier run should have sent. */
  lateBy: number
}

/**
 * Should this schedule be reminded about during this run?
 *
 * Tomorrow is considered as well as today, because the reminder for a habit
 * scheduled just after midnight falls on the previous evening. Reaching forward
 * one day is what lets a 00:30 habit be reminded at 23:30 tonight.
 *
 * The window is "due at some point in the last catchupMinutes, and not yet
 * sent" rather than "due in the next five minutes". A cron that missed a tick
 * used to lose those reminders permanently. Reaching back is safe only because
 * the unique index on reminder_deliveries makes a second send impossible.
 */
export function dueOneHourReminders(
  schedule: ScheduleRow,
  today: IsoDate,
  nowMinute: number,
  catchupMinutes: number,
): DueReminder[] {
  const due: DueReminder[] = []

  for (const offset of [0, 1]) {
    const occurrenceDate = addDaysToIsoDate(today, offset)
    if (!scheduleAppliesOn(schedule, occurrenceDate)) continue

    const reminder = oneHourBefore(occurrenceDate, schedule.time)
    // The reminder has to belong to today. Yesterday's was yesterday's run's
    // job, and tomorrow's is tomorrow's. This also removes the old 23:55 dead
    // zone, which came from adding five minutes to the clock, wrapping past
    // midnight to "00:00", and then comparing "23:55" <= "00:00" as strings —
    // which is false, so that one run of the day matched nothing at all and
    // habits at 00:55 to 00:59 could never be reminded.
    if (reminder.date !== today) continue

    const dueMinute = toMinutes(reminder.time)
    if (dueMinute > nowMinute) continue
    if (dueMinute <= nowMinute - catchupMinutes) continue

    // Never remind about something that has already started. A catch-up run an
    // hour late must not announce a habit as being "in 1 hour" when the hour
    // has gone.
    const startMinute = toMinutes(schedule.time) + offset * 1440
    if (startMinute <= nowMinute) continue

    due.push({ occurrenceDate, dueMinute, lateBy: nowMinute - dueMinute })
  }

  return due
}

/** Inclusive of the start, exclusive of the end, on the Philippine clock. */
export function withinPhWindow(nowTime: IsoTime, from: IsoTime, until: IsoTime): boolean {
  return nowTime >= from && nowTime < until
}
