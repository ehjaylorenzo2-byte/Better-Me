import { supabase } from '@/lib/supabase'
import type { Workout, WorkoutExercise } from '@/types/models'
import { getPhilippineToday, isFuturePhilippineDate, isPastPhilippineDate, type IsoDate } from '@/utils/timezone'

function mapExercise(row: {
  id: string
  workout_id: string
  name: string
  sets: number
  reps: number
  weight_kg: number
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
    notes: row.notes,
    orderIndex: row.order_index,
  }
}

function mapWorkout(
  row: {
    id: string
    user_id: string
    occurrence_id: string | null
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
