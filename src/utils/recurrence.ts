import type { HabitSchedule } from '@/types/models'
import { addDaysToIsoDate, compareIsoDate, isoDateWeekday, type IsoDate } from './timezone'

/**
 * Better Me does NOT pre-create infinite future occurrence rows. Instead we
 * compute, on demand, which calendar dates a schedule applies to within a
 * bounded window, and lazily materialize `habit_occurrences` rows only when
 * needed (viewed, or acted on). This keeps storage bounded and scalable.
 */

/** Returns true if `schedule` produces an occurrence on `date` (inclusive of schedule.startDate, exclusive past schedule.endDate if set). */
export function scheduleAppliesOnDate(schedule: HabitSchedule, date: IsoDate): boolean {
  if (compareIsoDate(date, schedule.startDate) < 0) return false
  if (schedule.endDate && compareIsoDate(date, schedule.endDate) > 0) return false

  switch (schedule.recurrence) {
    case 'once':
      return date === schedule.startDate
    case 'daily':
      return true
    case 'weekly': {
      const weekday = isoDateWeekday(date)
      return schedule.weekdays?.includes(weekday) ?? isoDateWeekday(schedule.startDate) === weekday
    }
    case 'monthly': {
      const [, , d] = date.split('-')
      const [, , sd] = schedule.startDate.split('-')
      return d === sd
    }
    case 'custom': {
      const weekday = isoDateWeekday(date)
      return schedule.weekdays?.includes(weekday) ?? false
    }
    default:
      return false
  }
}

/** Expands one schedule into the list of ISO dates it applies to within [rangeStart, rangeEnd] inclusive. */
export function expandScheduleInRange(schedule: HabitSchedule, rangeStart: IsoDate, rangeEnd: IsoDate): IsoDate[] {
  const dates: IsoDate[] = []
  let cursor = compareIsoDate(schedule.startDate, rangeStart) > 0 ? schedule.startDate : rangeStart
  let guard = 0
  while (compareIsoDate(cursor, rangeEnd) <= 0 && guard < 3660) {
    if (scheduleAppliesOnDate(schedule, cursor)) dates.push(cursor)
    cursor = addDaysToIsoDate(cursor, 1)
    guard++
  }
  return dates
}

export function describeSchedule(schedule: HabitSchedule): string {
  switch (schedule.recurrence) {
    case 'once':
      return 'One time'
    case 'daily':
      return 'Daily'
    case 'weekly':
    case 'custom': {
      if (!schedule.weekdays?.length) return 'Weekly'
      const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return schedule.weekdays
        .slice()
        .sort()
        .map((w) => labels[w])
        .join(', ')
    }
    case 'monthly':
      return 'Monthly'
    default:
      return ''
  }
}
