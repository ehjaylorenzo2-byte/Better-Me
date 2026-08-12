/**
 * Better Me runs its business logic on a single fixed timezone: Asia/Manila
 * (Philippine Time, UTC+8), regardless of the device's local timezone.
 *
 * Do NOT use `new Date().toDateString()` / local getters anywhere in habit,
 * gym, or finance logic — always go through these helpers so a user who
 * changes their phone's timezone still gets consistent Philippine-calendar
 * behavior.
 */

export const APP_TIMEZONE = 'Asia/Manila'

/** YYYY-MM-DD */
export type IsoDate = string
/** HH:mm (24h) */
export type IsoTime = string

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Current date in the Philippine calendar, as YYYY-MM-DD. */
export function getPhilippineToday(referenceDate: Date = new Date()): IsoDate {
  return dateFormatter.format(referenceDate)
}

/** Current time of day in the Philippine calendar, as HH:mm. */
export function getPhilippineTimeNow(referenceDate: Date = new Date()): IsoTime {
  return timeFormatter.format(referenceDate)
}

/**
 * Converts a Philippine-calendar local date+time into a real UTC Date
 * instant, correctly accounting for the fixed +08:00 offset (Manila has
 * no DST), so it can be safely stored/compared as a timestamptz.
 */
export function philippineDateTimeToUtc(date: IsoDate, time: IsoTime): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  // Manila is a fixed UTC+8 offset year-round (no DST).
  const utcMs = Date.UTC(y, m - 1, d, hh - 8, mm, 0)
  return new Date(utcMs)
}

/** Given a UTC instant, returns the Philippine-calendar YYYY-MM-DD it falls on. */
export function utcToPhilippineDate(instant: Date): IsoDate {
  return dateFormatter.format(instant)
}

/** Given a UTC instant, returns the Philippine-calendar HH:mm it falls on. */
export function utcToPhilippineTime(instant: Date): IsoTime {
  return timeFormatter.format(instant)
}

/** Full Philippine-calendar timestamp parts, useful for debugging/logging. */
export function utcToPhilippineParts(instant: Date) {
  const formatted = partsFormatter.format(instant) // "YYYY-MM-DD, HH:mm:ss"
  const [date, time] = formatted.split(', ')
  return { date: date as IsoDate, time: time.slice(0, 5) as IsoTime }
}

/** Adds `days` (can be negative) to an ISO date string, calendar-safe. */
export function addDaysToIsoDate(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** 0 (Sunday) - 6 (Saturday), matching JS Date convention, for a PH-calendar date. */
export function isoDateWeekday(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  // Noon UTC avoids any edge rounding.
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

/**
 * How many cells sit before the 1st in a month grid.
 *
 * The `+ 7) % 7` is load bearing. With a Monday start, a month beginning on a
 * Sunday needs six leading cells, and a plain subtraction gives minus one,
 * which silently collapses the first row of the calendar.
 */
export function leadingCellsForMonth(yearMonth: string, weekStartsOn: 0 | 1): number {
  return (isoDateWeekday(`${yearMonth}-01`) - weekStartsOn + 7) % 7
}

/** Weekday headings rotated so the chosen first day comes first. */
export function orderWeekdays<T>(labels: readonly T[], weekStartsOn: 0 | 1): T[] {
  return [...labels.slice(weekStartsOn), ...labels.slice(0, weekStartsOn)]
}

export function compareIsoDate(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isPastPhilippineDate(date: IsoDate, today = getPhilippineToday()): boolean {
  return compareIsoDate(date, today) < 0
}

export function isFuturePhilippineDate(date: IsoDate, today = getPhilippineToday()): boolean {
  return compareIsoDate(date, today) > 0
}

export function isTodayPhilippineDate(date: IsoDate, today = getPhilippineToday()): boolean {
  return date === today
}

/** 1-hour-before reminder time for a scheduled HH:mm, correctly rolling back over a calendar-day boundary. */
export function getOneHourBeforeReminder(date: IsoDate, time: IsoTime): { date: IsoDate; time: IsoTime } {
  const instant = philippineDateTimeToUtc(date, time)
  const reminderInstant = new Date(instant.getTime() - 60 * 60 * 1000)
  return utcToPhilippineParts(reminderInstant)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? ''
}

export function formatIsoDateLong(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, month: 'long', day: 'numeric', year: 'numeric' }).format(dt)
}

export function formatIsoTime12h(time: IsoTime): string {
  const [hh, mm] = time.split(':').map(Number)
  const period = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`
}

export function getPhilippineMonthRange(yearMonth: string): { start: IsoDate; end: IsoDate } {
  // yearMonth = "YYYY-MM"
  const [y, m] = yearMonth.split('-').map(Number)
  const start = `${yearMonth}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function getCurrentPhilippineMonth(referenceDate: Date = new Date()): string {
  return getPhilippineToday(referenceDate).slice(0, 7)
}

/**
 * "August 2026" for a "YYYY-MM" string.
 *
 * Built at midday UTC on the first of the month so the +8 shift can never roll
 * the label back into the previous month, which is the classic way a month
 * header ends up one behind the data under it.
 */
export function philippineMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, 1, 12))
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'long',
    year: 'numeric',
  }).format(dt)
}

/** "August" without the year, for a month header that already shows the year. */
export function philippineMonthNameOnly(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, 1, 12))
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, month: 'long' }).format(dt)
}

/** Shifts a "YYYY-MM" string by whole months, wrapping the year correctly. */
export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const zero = y * 12 + (m - 1) + delta
  const year = Math.floor(zero / 12)
  const month = zero - year * 12 + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * "Today", "Yesterday", or "Sat, 8 Aug" for grouping a list of entries.
 * Anything in another year keeps the year so old rows are never ambiguous.
 */
export function relativeDayLabel(date: IsoDate, today: IsoDate = getPhilippineToday()): string {
  if (date === today) return 'Today'
  if (date === addDaysToIsoDate(today, -1)) return 'Yesterday'
  if (date === addDaysToIsoDate(today, 1)) return 'Tomorrow'
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(dt)
}
