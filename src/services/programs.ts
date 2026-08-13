import { supabase } from '@/lib/supabase'
import type { ExerciseMeasure, Program, Routine, RoutineExercise } from '@/types/models'

/**
 * Programs, routines and the exercises inside them.
 *
 * The point of this layer is that you build Push Day once. Every time you train
 * it afterwards the exercises come with it, in order, instead of being retyped
 * from memory.
 */

function mapProgram(row: {
  id: string
  user_id: string
  name: string
  notes: string | null
  archived: boolean
  sort_order: number
}): Program {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    notes: row.notes,
    archived: row.archived,
    sortOrder: row.sort_order,
  }
}

function mapRoutine(row: {
  id: string
  user_id: string
  program_id: string | null
  name: string
  routine_note: string | null
  archived: boolean
  sort_order: number
}): Routine {
  return {
    id: row.id,
    userId: row.user_id,
    programId: row.program_id,
    name: row.name,
    routineNote: row.routine_note,
    archived: row.archived,
    sortOrder: row.sort_order,
  }
}

function mapRoutineExercise(row: {
  id: string
  user_id: string
  routine_id: string
  name: string
  measure: ExerciseMeasure
  target_sets: number | null
  notes: string | null
  sort_order: number
}): RoutineExercise {
  return {
    id: row.id,
    userId: row.user_id,
    routineId: row.routine_id,
    name: row.name,
    measure: row.measure,
    targetSets: row.target_sets,
    notes: row.notes,
    sortOrder: row.sort_order,
  }
}

function requireName(value: string, what: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`Give the ${what} a name.`)
  return trimmed
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function listPrograms(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Program[]> {
  let query = supabase.from('programs').select('*').eq('user_id', userId)
  if (!options.includeArchived) query = query.eq('archived', false)
  const { data, error } = await query.order('sort_order').order('created_at')
  if (error) throw error
  return (data ?? []).map(mapProgram)
}

export async function createProgram(userId: string, name: string, notes?: string): Promise<Program> {
  if (!name.trim()) throw new Error('Give the program a name.')
  const { data, error } = await supabase
    .from('programs')
    .insert({ user_id: userId, name: name.trim(), notes: notes?.trim() || null })
    .select('*')
    .single()
  if (error) throw error
  return mapProgram(data)
}

export async function updateProgram(
  programId: string,
  updates: { name?: string; notes?: string | null; archived?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('programs')
    .update({
      ...(updates.name !== undefined ? { name: requireName(updates.name, 'program') } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      ...(updates.archived !== undefined ? { archived: updates.archived } : {}),
    })
    .eq('id', programId)
  if (error) throw error
}

/** Cascades to its routines and their exercises. Past workouts are untouched. */
export async function deleteProgram(programId: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', programId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export async function listRoutines(
  userId: string,
  options: { programId?: string; includeArchived?: boolean } = {},
): Promise<Routine[]> {
  let query = supabase.from('routines').select('*').eq('user_id', userId)
  if (options.programId) query = query.eq('program_id', options.programId)
  if (!options.includeArchived) query = query.eq('archived', false)
  const { data, error } = await query.order('sort_order').order('created_at')
  if (error) throw error
  return (data ?? []).map(mapRoutine)
}

export async function createRoutine(
  userId: string,
  input: { programId: string | null; name: string; routineNote?: string | null },
): Promise<Routine> {
  if (!input.name.trim()) throw new Error('Give the routine a name.')
  const { data, error } = await supabase
    .from('routines')
    .insert({
      user_id: userId,
      program_id: input.programId,
      name: input.name.trim(),
      routine_note: input.routineNote?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRoutine(data)
}

export async function updateRoutine(
  routineId: string,
  updates: { name?: string; routineNote?: string | null; archived?: boolean; sortOrder?: number },
): Promise<void> {
  const { error } = await supabase
    .from('routines')
    .update({
      ...(updates.name !== undefined ? { name: requireName(updates.name, 'routine') } : {}),
      ...(updates.routineNote !== undefined ? { routine_note: updates.routineNote } : {}),
      ...(updates.archived !== undefined ? { archived: updates.archived } : {}),
      ...(updates.sortOrder !== undefined ? { sort_order: updates.sortOrder } : {}),
    })
    .eq('id', routineId)
  if (error) throw error
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const { error } = await supabase.from('routines').delete().eq('id', routineId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// The exercises inside a routine
// ---------------------------------------------------------------------------

export async function listRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
  const { data, error } = await supabase
    .from('routine_exercises')
    .select('*')
    .eq('routine_id', routineId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(mapRoutineExercise)
}

export async function addRoutineExercise(
  userId: string,
  input: {
    routineId: string
    name: string
    measure?: ExerciseMeasure
    targetSets?: number | null
    sortOrder?: number
  },
): Promise<RoutineExercise> {
  if (!input.name.trim()) throw new Error('Give the exercise a name.')
  const { data, error } = await supabase
    .from('routine_exercises')
    .insert({
      user_id: userId,
      routine_id: input.routineId,
      name: input.name.trim(),
      measure: input.measure ?? 'weight_reps',
      target_sets: input.targetSets ?? 3,
      sort_order: input.sortOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRoutineExercise(data)
}

export async function updateRoutineExercise(
  exerciseId: string,
  updates: {
    name?: string
    measure?: ExerciseMeasure
    targetSets?: number | null
    notes?: string | null
    sortOrder?: number
  },
): Promise<void> {
  const { error } = await supabase
    .from('routine_exercises')
    .update({
      ...(updates.name !== undefined ? { name: requireName(updates.name, 'exercise') } : {}),
      ...(updates.measure !== undefined ? { measure: updates.measure } : {}),
      ...(updates.targetSets !== undefined ? { target_sets: updates.targetSets } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      ...(updates.sortOrder !== undefined ? { sort_order: updates.sortOrder } : {}),
    })
    .eq('id', exerciseId)
  if (error) throw error
}

export async function removeRoutineExercise(exerciseId: string): Promise<void> {
  const { error } = await supabase.from('routine_exercises').delete().eq('id', exerciseId)
  if (error) throw error
}

/**
 * Reorder in one round trip.
 *
 * An upsert replaces the whole row, so the caller passes the exercises it
 * already has rather than just their ids: sending a partial row would blank
 * the name and measure of everything being reordered.
 */
export async function reorderRoutineExercises(
  userId: string,
  routineId: string,
  ordered: RoutineExercise[],
): Promise<void> {
  const rows = ordered.map((exercise, index) => ({
    id: exercise.id,
    user_id: userId,
    routine_id: routineId,
    name: exercise.name,
    measure: exercise.measure,
    target_sets: exercise.targetSets,
    notes: exercise.notes,
    sort_order: index,
  }))
  const { error } = await supabase.from('routine_exercises').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}
