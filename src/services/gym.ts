import { supabase } from '@/lib/supabase'
import type { ExerciseMeasure, Workout, WorkoutExercise } from '@/types/models'
import { getPhilippineToday, isFuturePhilippineDate, isPastPhilippineDate, type IsoDate } from '@/utils/timezone'

function mapExercise(row: {
  id: string
  workout_id: string
  name: string
  sets: number
  reps: number
  weight_kg: number
  measure?: ExerciseMeasure
  notes: string | null
  order_index: number
}): WorkoutExercise {
  return {
    id: row.id,
    workoutId: row.workout_id,
    name: row.name,
    sets: row.sets,
    reps: row.reps,
    weightKg: row.weight_kg,
    measure: row.measure ?? 'weight_reps',
    notes: row.notes,
    orderIndex: row.order_index,
  }
}

function mapWorkout(
  row: {
    id: string
    user_id: string
    occurrence_id: string | null
    habit_id?: string | null
    routine_id?: string | null
    started_at?: string | null
    ended_at?: string | null
    workout_date: string
    duration_minutes: number | null
    notes: string | null
    completed: boolean
  },
  exercises: WorkoutExercise[] = [],
): Workout {
  return {
    id: row.id,
    userId: row.user_id,
    occurrenceId: row.occurrence_id,
    habitId: row.habit_id ?? null,
    routineId: row.routine_id ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    workoutDate: row.workout_date,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    completed: row.completed,
    exercises,
  }
}

/** UI-level gate mirrored by DB checks in complete_workout(): today = editable, future = schedulable only, past = locked. */
export function isGymDateEditable(date: IsoDate, today: IsoDate = getPhilippineToday()): boolean {
  return !isPastPhilippineDate(date, today)
}

export function isGymDateCompletable(date: IsoDate, today: IsoDate = getPhilippineToday()): boolean {
  return date === today
}

export function isGymFutureDate(date: IsoDate, today: IsoDate = getPhilippineToday()): boolean {
  return isFuturePhilippineDate(date, today)
}

/**
 * Reads a day's workout without creating one.
 *
 * The summary and share screens must never write. They are pages you come back
 * to — days later, from a link, after the app has been closed and reopened —
 * and getOrCreateWorkoutForDate would try to INSERT a row when it found none,
 * which for a past date the database correctly refuses. The screen then said
 * "Could not load this workout" about a workout that was sitting right there.
 */
export async function getWorkoutForDate(userId: string, date: IsoDate): Promise<Workout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('user_id', userId)
    .eq('workout_date', date)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { workout_exercises, ...rest } = data as typeof data & { workout_exercises: unknown[] }
  return mapWorkout(rest, ((workout_exercises ?? []) as Parameters<typeof mapExercise>[0][]).map(mapExercise))
}

export async function getOrCreateWorkoutForDate(userId: string, date: IsoDate): Promise<Workout> {
  const { data: existing, error: fetchError } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('user_id', userId)
    .eq('workout_date', date)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (existing) {
    const { workout_exercises, ...rest } = existing as typeof existing & { workout_exercises: unknown[] }
    return mapWorkout(rest, (workout_exercises as Parameters<typeof mapExercise>[0][]).map(mapExercise))
  }

  // Which gym habit this workout belongs to is decided once, here, and stored.
  // The old code searched for "any gym habit" at completion time and could pick
  // a different one each time, marking the wrong habit Done.
  const { data: habitId } = await supabase.rpc('resolve_gym_habit', { p_date: date })

  const { data: created, error: createError } = await supabase
    .from('workouts')
    .insert({ user_id: userId, workout_date: date, habit_id: habitId ?? null })
    .select('*')
    .single()
  if (createError) throw createError
  return mapWorkout(created, [])
}

export async function getWorkoutHistory(userId: string, limit = 90): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('user_id', userId)
    .order('workout_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const { workout_exercises, ...rest } = row as typeof row & { workout_exercises: unknown[] }
    return mapWorkout(rest, (workout_exercises as Parameters<typeof mapExercise>[0][]).map(mapExercise))
  })
}

export async function updateWorkoutMeta(
  workoutId: string,
  updates: { durationMinutes?: number | null; notes?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({
      ...(updates.durationMinutes !== undefined ? { duration_minutes: updates.durationMinutes } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
    })
    .eq('id', workoutId)
  if (error) throw error
}

export interface ExerciseInput {
  name: string
  sets: number
  reps: number
  weightKg: number
  notes?: string | null
}

export async function addExercise(workoutId: string, userId: string, input: ExerciseInput, orderIndex: number) {
  if (!input.name.trim()) throw new Error('Exercise name is required.')
  const { error } = await supabase.from('workout_exercises').insert({
    workout_id: workoutId,
    user_id: userId,
    name: input.name.trim(),
    sets: input.sets,
    reps: input.reps,
    weight_kg: input.weightKg,
    notes: input.notes ?? null,
    order_index: orderIndex,
  })
  if (error) throw error
}

export async function removeExercise(exerciseId: string): Promise<void> {
  const { error } = await supabase.from('workout_exercises').delete().eq('id', exerciseId)
  if (error) throw error
}

/** Single source of truth: completing here also flips the linked Gym habit occurrence to Done (server-side). */
export async function completeWorkout(workoutId: string): Promise<Workout> {
  const { data, error } = await supabase.rpc('complete_workout', { p_workout_id: workoutId })
  if (error) throw error
  return mapWorkout(data, [])
}

/**
 * Starts today's workout from a routine, copying its exercises in order.
 *
 * This is the whole point of routines: you built Push Day once, so training it
 * again should not mean retyping five exercise names. The copy is deliberate
 * rather than a live link, so editing the routine next week does not rewrite
 * what you actually did today.
 */
export async function startWorkoutFromRoutine(
  userId: string,
  date: IsoDate,
  routineId: string,
): Promise<Workout> {
  const workout = await getOrCreateWorkoutForDate(userId, date)

  const { error: markError } = await supabase
    .from('workouts')
    .update({ routine_id: routineId, started_at: workout.startedAt ?? new Date().toISOString() })
    .eq('id', workout.id)
  if (markError) throw markError

  // Only seed exercises into an empty workout, so re-entering the screen never
  // duplicates what is already logged.
  if (workout.exercises.length === 0) {
    const { data: routineExercises, error } = await supabase
      .from('routine_exercises')
      .select('id, name, measure, sort_order')
      .eq('routine_id', routineId)
      .order('sort_order')
    if (error) throw error

    if ((routineExercises ?? []).length > 0) {
      const rows = (routineExercises ?? []).map((re, index) => ({
        workout_id: workout.id,
        user_id: userId,
        name: re.name,
        measure: re.measure,
        routine_exercise_id: re.id,
        order_index: index,
        sets: 0,
        reps: 0,
        weight_kg: 0,
      }))
      const { error: insertError } = await supabase.from('workout_exercises').insert(rows)
      if (insertError) throw insertError
    }
  }

  return getOrCreateWorkoutForDate(userId, date)
}

/** Stamps the end of the session so duration comes from the clock, not a guess. */
export async function finishWorkoutClock(workoutId: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', workoutId)
  if (error) throw error
}
