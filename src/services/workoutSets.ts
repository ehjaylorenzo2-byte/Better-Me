import { supabase } from '@/lib/supabase'
import type { ExerciseMeasure, ExerciseTotals, PreviousSet, WorkoutSet, WorkoutTotals } from '@/types/models'
import type { IsoDate } from '@/utils/timezone'

/**
 * Per-set logging, and everything derived from it.
 *
 * Weight is stored in grams for the same reason money is stored in centavos:
 * 62.5 kg is exactly 62500 and only approximately 62.5. Every figure the app
 * shows is computed from these rows, never from a number typed into a summary.
 */

export const KG = 1000

export function gramsToKg(grams: number | null): number | null {
  return grams === null ? null : grams / KG
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * KG)
}

function mapSet(row: {
  id: string
  workout_exercise_id: string
  set_number: number
  weight_grams: number | null
  reps: number | null
  duration_seconds: number | null
  distance_metres: number | null
  completed: boolean
}): WorkoutSet {
  return {
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    setNumber: row.set_number,
    weightGrams: row.weight_grams,
    reps: row.reps,
    durationSeconds: row.duration_seconds,
    distanceMetres: row.distance_metres,
    completed: row.completed,
  }
}

export async function listSetsForWorkout(workoutId: string): Promise<Map<string, WorkoutSet[]>> {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('*, workout_exercises!inner(workout_id)')
    .eq('workout_exercises.workout_id', workoutId)
    .order('set_number')
  if (error) throw error

  const byExercise = new Map<string, WorkoutSet[]>()
  for (const row of (data ?? []) as Parameters<typeof mapSet>[0][]) {
    const set = mapSet(row)
    const list = byExercise.get(set.workoutExerciseId) ?? []
    list.push(set)
    byExercise.set(set.workoutExerciseId, list)
  }
  return byExercise
}

export interface SetDraft {
  weightKg?: number | null
  reps?: number | null
  durationSeconds?: number | null
  distanceMetres?: number | null
  completed?: boolean
}

/**
 * Adds the next set for an exercise.
 *
 * The set number is derived here rather than passed in, so two quick taps
 * cannot both claim set 3 and collide on the unique index.
 */
export async function addSet(
  userId: string,
  workoutExerciseId: string,
  draft: SetDraft,
): Promise<WorkoutSet> {
  const { data: existing, error: countError } = await supabase
    .from('workout_sets')
    .select('set_number')
    .eq('workout_exercise_id', workoutExerciseId)
    .order('set_number', { ascending: false })
    .limit(1)
  if (countError) throw countError

  const nextNumber = ((existing?.[0]?.set_number as number | undefined) ?? 0) + 1

  const { data, error } = await supabase
    .from('workout_sets')
    .insert({
      user_id: userId,
      workout_exercise_id: workoutExerciseId,
      set_number: nextNumber,
      weight_grams: draft.weightKg === null || draft.weightKg === undefined ? null : kgToGrams(draft.weightKg),
      reps: draft.reps ?? null,
      duration_seconds: draft.durationSeconds ?? null,
      distance_metres: draft.distanceMetres ?? null,
      completed: draft.completed ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapSet(data)
}

export async function updateSet(setId: string, draft: SetDraft): Promise<void> {
  const { error } = await supabase
    .from('workout_sets')
    .update({
      ...(draft.weightKg !== undefined
        ? { weight_grams: draft.weightKg === null ? null : kgToGrams(draft.weightKg) }
        : {}),
      ...(draft.reps !== undefined ? { reps: draft.reps } : {}),
      ...(draft.durationSeconds !== undefined ? { duration_seconds: draft.durationSeconds } : {}),
      ...(draft.distanceMetres !== undefined ? { distance_metres: draft.distanceMetres } : {}),
      ...(draft.completed !== undefined ? { completed: draft.completed } : {}),
    })
    .eq('id', setId)
  if (error) throw error
}

export async function removeSet(setId: string): Promise<void> {
  const { error } = await supabase.from('workout_sets').delete().eq('id', setId)
  if (error) throw error
}

/**
 * What you did last time, so the logging screen can show it inline.
 *
 * Looks up by exercise NAME rather than by routine, so moving Bench Press to a
 * different routine does not lose sight of its history.
 */
export async function getPreviousSets(name: string, before: IsoDate): Promise<PreviousSet[]> {
  const { data, error } = await supabase.rpc('previous_exercise_sets', {
    p_name: name,
    p_before: before,
  })
  if (error) throw error
  return ((data ?? []) as Array<{
    workout_date: string
    set_number: number
    weight_grams: number | null
    reps: number | null
    duration_seconds: number | null
    distance_metres: number | null
  }>).map((row) => ({
    workoutDate: row.workout_date,
    setNumber: row.set_number,
    weightGrams: row.weight_grams,
    reps: row.reps,
    durationSeconds: row.duration_seconds,
    distanceMetres: row.distance_metres,
  }))
}

export async function getWorkoutTotals(workoutId: string): Promise<WorkoutTotals | null> {
  const { data, error } = await supabase
    .from('workout_totals')
    .select('*')
    .eq('workout_id', workoutId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    workoutId: data.workout_id,
    exerciseCount: data.exercise_count,
    setCount: data.set_count,
    totalReps: data.total_reps,
    volumeGrams: data.volume_grams,
    totalSeconds: data.total_seconds,
    totalMetres: data.total_metres,
    durationMinutes: data.duration_minutes,
  }
}

export async function getExerciseTotals(workoutId: string): Promise<ExerciseTotals[]> {
  const { data, error } = await supabase
    .from('workout_exercise_totals')
    .select('*')
    .eq('workout_id', workoutId)
  if (error) throw error
  return (data ?? []).map((row) => ({
    workoutExerciseId: row.workout_exercise_id,
    name: row.name,
    measure: row.measure,
    setCount: row.set_count,
    totalReps: row.total_reps,
    volumeGrams: row.volume_grams,
    totalSeconds: row.total_seconds,
    totalMetres: row.total_metres,
    bestWeightGrams: row.best_weight_grams,
    bestReps: row.best_reps,
  }))
}

export interface ExerciseRecord {
  name: string
  bestWeightGrams: number | null
  bestReps: number | null
  bestVolumeGrams: number
  lastDone: IsoDate | null
}

export async function listPersonalRecords(userId: string): Promise<Map<string, ExerciseRecord>> {
  const { data, error } = await supabase.from('exercise_records').select('*').eq('user_id', userId)
  if (error) throw error

  const byKey = new Map<string, ExerciseRecord>()
  for (const row of data ?? []) {
    byKey.set(row.key, {
      name: row.name,
      bestWeightGrams: row.best_weight_grams,
      bestReps: row.best_reps,
      bestVolumeGrams: row.best_volume_grams,
      lastDone: row.last_done,
    })
  }
  return byKey
}

/**
 * Did this session beat anything?
 *
 * Compared against records that INCLUDE today, so the check is "is today's best
 * also the all-time best", which is true on the day you set one. Kept to three
 * plain kinds rather than anything clever, because a personal record nobody can
 * explain is just a badge.
 */
export type RecordKind = 'weight' | 'reps' | 'volume'

export function findNewRecords(
  todays: ExerciseTotals[],
  records: Map<string, ExerciseRecord>,
): Array<{ name: string; kind: RecordKind; valueGrams?: number; reps?: number }> {
  const found: Array<{ name: string; kind: RecordKind; valueGrams?: number; reps?: number }> = []

  for (const total of todays) {
    if (total.setCount === 0) continue
    const record = records.get(total.name.trim().toLowerCase())
    if (!record) continue

    if (
      total.bestWeightGrams !== null &&
      record.bestWeightGrams !== null &&
      total.bestWeightGrams >= record.bestWeightGrams
    ) {
      found.push({ name: total.name, kind: 'weight', valueGrams: total.bestWeightGrams, reps: total.bestReps ?? undefined })
      continue
    }
    if (total.bestReps !== null && record.bestReps !== null && total.bestReps >= record.bestReps) {
      found.push({ name: total.name, kind: 'reps', reps: total.bestReps })
      continue
    }
    if (total.volumeGrams > 0 && total.volumeGrams >= record.bestVolumeGrams) {
      found.push({ name: total.name, kind: 'volume', valueGrams: total.volumeGrams })
    }
  }

  return found
}

/** "1h 18m", or "18m" when it is under an hour. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

/** Volume in whole kilograms, which is the only precision anyone reads. */
export function formatVolume(grams: number): string {
  return `${Math.round(grams / KG).toLocaleString('en-PH')} kg`
}
