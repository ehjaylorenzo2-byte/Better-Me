import { supabase } from '@/lib/supabase'
import type { Habit, HabitSchedule, HabitOccurrence, HabitStatus, Recurrence } from '@/types/models'
import { expandScheduleInRange } from '@/utils/recurrence'
import type { IsoDate, IsoTime } from '@/utils/timezone'

function mapHabit(row: {
  id: string
  user_id: string
  name: string
  description: string | null
  icon: string | null
  category: 'general' | 'gym'
  archived: boolean
  created_at: string
}): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    category: row.category,
    archived: row.archived,
    createdAt: row.created_at,
  }
}

function mapSchedule(row: {
  id: string
  habit_id: string
  recurrence: Recurrence
  weekdays: number[] | null
  time: string | null
  start_date: string
  end_date: string | null
  reminder_enabled: boolean
  supersedes_schedule_id: string | null
  created_at: string
}): HabitSchedule {
  return {
    id: row.id,
    habitId: row.habit_id,
    recurrence: row.recurrence,
    weekdays: row.weekdays,
    time: row.time as IsoTime | null,
    startDate: row.start_date,
    endDate: row.end_date,
    reminderEnabled: row.reminder_enabled,
    supersedesScheduleId: row.supersedes_schedule_id,
    createdAt: row.created_at,
  }
}

function mapOccurrence(row: {
  id: string
  habit_id: string
  schedule_id: string
  user_id: string
  occurrence_date: string
  scheduled_time: string | null
  status: HabitStatus | null
  completed_at: string | null
  notes: string | null
}): HabitOccurrence {
  return {
    id: row.id,
    habitId: row.habit_id,
    scheduleId: row.schedule_id,
    userId: row.user_id,
    occurrenceDate: row.occurrence_date,
    scheduledTime: row.scheduled_time as IsoTime | null,
    status: row.status,
    completedAt: row.completed_at,
    notes: row.notes,
  }
}

export async function listHabits(userId: string, includeArchived = false): Promise<Habit[]> {
  let query = supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true })
  if (!includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapHabit)
}

export async function getHabit(habitId: string): Promise<Habit | null> {
  const { data, error } = await supabase.from('habits').select('*').eq('id', habitId).maybeSingle()
  if (error) throw error
  return data ? mapHabit(data) : null
}

export async function listSchedulesForHabit(habitId: string): Promise<HabitSchedule[]> {
  const { data, error } = await supabase
    .from('habit_schedules')
    .select('*')
    .eq('habit_id', habitId)
    .order('start_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapSchedule)
}

export interface CreateHabitInput {
  userId: string
  name: string
  description?: string | null
  icon?: string | null
  category?: 'general' | 'gym'
  recurrence: Recurrence
  weekdays?: number[] | null
  time?: IsoTime | null
  startDate: IsoDate
  endDate?: IsoDate | null
  reminderEnabled?: boolean
}

export async function createHabit(input: CreateHabitInput): Promise<{ habit: Habit; schedule: HabitSchedule }> {
  if (!input.name.trim()) throw new Error('Habit name is required.')

  const { data: habitRow, error: habitError } = await supabase
    .from('habits')
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      description: input.description ?? null,
      icon: input.icon ?? null,
      category: input.category ?? 'general',
    })
    .select('*')
    .single()
  if (habitError) throw habitError

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from('habit_schedules')
    .insert({
      habit_id: habitRow.id,
      user_id: input.userId,
      recurrence: input.recurrence,
      weekdays: input.weekdays ?? null,
      time: input.time ?? null,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      reminder_enabled: input.reminderEnabled ?? true,
    })
    .select('*')
    .single()
  if (scheduleError) throw scheduleError

  return { habit: mapHabit(habitRow), schedule: mapSchedule(scheduleRow) }
}

export interface EditScheduleInput {
  habitId: string
  userId: string
  currentSchedule: HabitSchedule
  recurrence: Recurrence
  weekdays?: number[] | null
  time?: IsoTime | null
  reminderEnabled?: boolean
  /** 'this_occurrence_only' | 'this_and_future' */
  scope: 'this_occurrence_only' | 'this_and_future'
  effectiveDate: IsoDate
  /** Required when scope === 'this_occurrence_only': the single date being changed. */
  overrideStatus?: HabitStatus | null
}

/**
 * Recurring edit with history preservation (spec #20/#21). "This and future"
 * closes out the old schedule at (effectiveDate - 1) and opens a new schedule
 * row starting at effectiveDate, linked via supersedes_schedule_id, so past
 * occurrences keep referencing the original schedule unchanged.
 */
export async function editScheduleThisAndFuture(input: EditScheduleInput): Promise<HabitSchedule> {
  const dayBefore = input.effectiveDate
  await supabase
    .from('habit_schedules')
    .update({ end_date: dayBeforeIso(dayBefore) })
    .eq('id', input.currentSchedule.id)

  const { data, error } = await supabase
    .from('habit_schedules')
    .insert({
      habit_id: input.habitId,
      user_id: input.userId,
      recurrence: input.recurrence,
      weekdays: input.weekdays ?? null,
      time: input.time ?? null,
      start_date: input.effectiveDate,
      end_date: input.currentSchedule.endDate,
      reminder_enabled: input.reminderEnabled ?? input.currentSchedule.reminderEnabled,
      supersedes_schedule_id: input.currentSchedule.id,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapSchedule(data)
}

function dayBeforeIso(date: IsoDate): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

export async function archiveHabit(habitId: string): Promise<void> {
  const { error } = await supabase.from('habits').update({ archived: true }).eq('id', habitId)
  if (error) throw error
}

export async function updateHabitDetails(
  habitId: string,
  updates: { name?: string; description?: string | null; icon?: string | null },
): Promise<void> {
  const { error } = await supabase.from('habits').update(updates).eq('id', habitId)
  if (error) throw error
}

/**
 * Core "occurrences for a date range" reader. Expands each habit's active
 * schedule(s) across the range, then overlays any already-materialized
 * habit_occurrences rows (which carry status). Un-materialized dates are
 * returned as virtual occurrences with status = null and no row id yet --
 * a real row is only created when the user sets a status.
 */
export async function getOccurrencesInRange(
  userId: string,
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
): Promise<Array<HabitOccurrence & { habit: Habit; schedule: HabitSchedule }>> {
  const [habits, schedulesResp, occurrencesResp] = await Promise.all([
    listHabits(userId),
    supabase.from('habit_schedules').select('*').eq('user_id', userId),
    supabase
      .from('habit_occurrences')
      .select('*')
      .eq('user_id', userId)
      .gte('occurrence_date', rangeStart)
      .lte('occurrence_date', rangeEnd),
  ])
  if (schedulesResp.error) throw schedulesResp.error
  if (occurrencesResp.error) throw occurrencesResp.error

  const habitsById = new Map(habits.map((h) => [h.id, h]))
  const schedules = (schedulesResp.data ?? []).map(mapSchedule)
  const existingByHabitDate = new Map(
    (occurrencesResp.data ?? []).map(mapOccurrence).map((o) => [`${o.habitId}:${o.occurrenceDate}`, o]),
  )

  const results: Array<HabitOccurrence & { habit: Habit; schedule: HabitSchedule }> = []

  for (const schedule of schedules) {
    const habit = habitsById.get(schedule.habitId)
    if (!habit || habit.archived) continue
    const dates = expandScheduleInRange(schedule, rangeStart, rangeEnd)
    for (const date of dates) {
      const key = `${habit.id}:${date}`
      const existing = existingByHabitDate.get(key)
      if (existing) {
        results.push({ ...existing, habit, schedule })
      } else {
        results.push({
          id: `virtual:${key}`,
          habitId: habit.id,
          scheduleId: schedule.id,
          userId,
          occurrenceDate: date,
          scheduledTime: schedule.time,
          status: null,
          completedAt: null,
          notes: null,
          habit,
          schedule,
        })
      }
    }
  }

  results.sort((a, b) => {
    if (a.occurrenceDate !== b.occurrenceDate) return a.occurrenceDate < b.occurrenceDate ? -1 : 1
    return (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99')
  })

  return results
}

export async function setOccurrenceStatus(
  habitId: string,
  scheduleId: string,
  occurrenceDate: IsoDate,
  scheduledTime: IsoTime | null,
  status: HabitStatus | null,
): Promise<HabitOccurrence> {
  const { data, error } = await supabase.rpc('set_habit_occurrence_status', {
    p_habit_id: habitId,
    p_schedule_id: scheduleId,
    p_occurrence_date: occurrenceDate,
    p_scheduled_time: scheduledTime,
    p_status: status,
  })
  if (error) throw error
  return mapOccurrence(data)
}

export async function getHabitOccurrenceHistory(habitId: string, limit = 60): Promise<HabitOccurrence[]> {
  const { data, error } = await supabase
    .from('habit_occurrences')
    .select('*')
    .eq('habit_id', habitId)
    .order('occurrence_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapOccurrence)
}
