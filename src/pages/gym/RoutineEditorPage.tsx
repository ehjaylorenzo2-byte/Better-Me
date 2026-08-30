import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { BottomSheet, ConfirmDialog } from '@/components/ui/Sheet'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  listRoutines,
  listRoutineExercises,
  addRoutineExercise,
  updateRoutineExercise,
  removeRoutineExercise,
  reorderRoutineExercises,
  updateRoutine,
} from '@/services/programs'
import type { ExerciseMeasure, Routine, RoutineExercise } from '@/types/models'
import './gym.css'

const MEASURES: Array<{ id: ExerciseMeasure; label: string; hint: string }> = [
  { id: 'weight_reps', label: 'Weight & reps', hint: 'Bench, squat, curls' },
  { id: 'reps', label: 'Reps only', hint: 'Push-ups, pull-ups' },
  { id: 'duration', label: 'Time', hint: 'Plank, stretching' },
  { id: 'distance', label: 'Distance', hint: 'Run, row, walk' },
]

/**
 * The routine editor.
 *
 * Reordering is done with up/down buttons rather than drag-and-drop. Dragging
 * inside a scrolling list on a phone fights the scroll — you pick a row up
 * when you meant to scroll past it — and it is unusable with a screen reader.
 * Two buttons are duller and they work every time.
 *
 * The order is written on every move rather than batched behind a Save. There
 * is no draft state to lose, and the reorder call is a single upsert.
 */
export function RoutineEditorPage() {
  const { routineId } = useParams<{ routineId: string }>()
  const { userId } = useAuth()
  const { show } = useToast()

  const [routine, setRoutine] = useState<Routine | null>(null)
  const [exercises, setExercises] = useState<RoutineExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [measure, setMeasure] = useState<ExerciseMeasure>('weight_reps')
  const [targetSets, setTargetSets] = useState('3')
  const [editing, setEditing] = useState<RoutineExercise | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<RoutineExercise | null>(null)

  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const load = async () => {
    if (!userId || !routineId) return
    setLoading(true)
    setError(null)
    try {
      // There is no getRoutine, and adding one to the service for a single
      // screen is not worth a round trip that already exists.
      const all = await listRoutines(userId, { includeArchived: true })
      const found = all.find((r) => r.id === routineId) ?? null
      if (!found) {
        setError('Could not find this routine.')
        return
      }
      setRoutine(found)
      setNote(found.routineNote ?? '')
      setExercises(await listRoutineExercises(routineId))
    } catch {
      setError('Could not load this routine.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, routineId])

  const resetForm = () => {
    setName('')
    setMeasure('weight_reps')
    setTargetSets('3')
    setEditing(null)
  }

  const onSaveExercise = async () => {
    if (!userId || !routineId || busy) return
    setBusy(true)
    try {
      // Blank means "no target", which is different from zero.
      const parsed = targetSets.trim() === '' ? null : Number(targetSets)
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 1 || parsed > 20)) {
        show('Target sets must be between 1 and 20.', 'error')
        return
      }
      if (editing) {
        await updateRoutineExercise(editing.id, { name, measure, targetSets: parsed })
        show('Exercise updated.', 'success')
      } else {
        await addRoutineExercise(userId, {
          routineId,
          name,
          measure,
          targetSets: parsed,
          sortOrder: exercises.length,
        })
        show('Exercise added.', 'success')
      }
      setAddOpen(false)
      resetForm()
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save that exercise.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async () => {
    if (!confirmRemove) return
    try {
      await removeRoutineExercise(confirmRemove.id)
      show(`${confirmRemove.name} removed.`, 'success')
      setConfirmRemove(null)
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not remove that exercise.', 'error')
    }
  }

  const move = async (index: number, delta: number) => {
    if (!userId || !routineId || busy) return
    const target = index + delta
    if (target < 0 || target >= exercises.length) return
    const next = exercises.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    // Show the move immediately, then persist. If the write fails the reload
    // in the catch puts the real order back.
    setExercises(next)
    setBusy(true)
    try {
      await reorderRoutineExercises(userId, routineId, next)
    } catch {
      show('Could not save the new order.', 'error')
      load()
    } finally {
      setBusy(false)
    }
  }

  const onSaveNote = async () => {
    if (!routineId || busy) return
    setBusy(true)
    try {
      await updateRoutine(routineId, { routineNote: note.trim() || null })
      show('Note saved.', 'success')
      setNoteOpen(false)
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save the note.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading routine..." />
  if (error || !routine) return <ErrorState message={error ?? 'Routine not found.'} onRetry={load} />

  return (
    <div className="bm-routine-page">
      <PageHeader title={routine.name} />

      {/* The note travels with the routine and reappears every time it is
          trained, which is where cues like "increase once all sets hit 10"
          actually belong. */}
      <section className="bm-card">
        <div className="bm-program-head">
          <p className="bm-eyebrow">Routine note</p>
          <button type="button" className="bm-btn bm-btn-ghost bm-btn-tight" onClick={() => setNoteOpen(true)}>
            {routine.routineNote ? 'Edit' : 'Add'}
          </button>
        </div>
        <p className={routine.routineNote ? 'bm-program-notes' : 'bm-gym-quiet'}>
          {routine.routineNote ?? 'No note yet. It shows every time you train this routine.'}
        </p>
      </section>

      <section className="bm-card">
        <p className="bm-eyebrow">Exercises</p>

        {exercises.length === 0 ? (
          <p className="bm-gym-quiet">
            No exercises yet. Add the first one and it will be waiting the next time you train this
            routine.
          </p>
        ) : (
          <ul className="bm-routine-ex-list">
            {exercises.map((exercise, index) => (
              <li key={exercise.id} className="bm-routine-ex">
                <div className="bm-routine-ex-text">
                  <span className="bm-routine-ex-name">{exercise.name}</span>
                  <span className="bm-routine-ex-meta">
                    {MEASURES.find((m) => m.id === exercise.measure)?.label ?? exercise.measure}
                    {exercise.targetSets ? ` · ${exercise.targetSets} sets` : ''}
                  </span>
                </div>
                <div className="bm-routine-ex-actions">
                  <button
                    type="button"
                    className="bm-shell-btn bm-routine-move"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || busy}
                    aria-label={`Move ${exercise.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="bm-shell-btn bm-routine-move"
                    onClick={() => move(index, 1)}
                    disabled={index === exercises.length - 1 || busy}
                    aria-label={`Move ${exercise.name} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="bm-btn bm-btn-ghost bm-btn-tight"
                    onClick={() => {
                      setEditing(exercise)
                      setName(exercise.name)
                      setMeasure(exercise.measure)
                      setTargetSets(exercise.targetSets === null ? '' : String(exercise.targetSets))
                      setAddOpen(true)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="bm-btn bm-btn-ghost bm-btn-tight bm-routine-remove"
                    onClick={() => setConfirmRemove(exercise)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          className="bm-btn bm-btn-primary bm-btn-full"
          onClick={() => {
            resetForm()
            setAddOpen(true)
          }}
        >
          Add an exercise
        </button>
      </section>

      <BottomSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          resetForm()
        }}
        title={editing ? 'Edit exercise' : 'Add an exercise'}
      >
        <Input
          label="Exercise name"
          placeholder="e.g. Bench Press"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="bm-eyebrow bm-routine-measure-label">How is it measured?</p>
        <div className="bm-routine-measures" role="radiogroup" aria-label="How is it measured?">
          {MEASURES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={measure === m.id}
              className={`bm-routine-measure ${measure === m.id ? 'active' : ''}`}
              onClick={() => setMeasure(m.id)}
            >
              <span className="bm-routine-measure-name">{m.label}</span>
              <span className="bm-routine-measure-hint">{m.hint}</span>
            </button>
          ))}
        </div>

        <Input
          label="Target sets"
          type="number"
          inputMode="numeric"
          placeholder="Leave blank for no target"
          value={targetSets}
          onChange={(e) => setTargetSets(e.target.value)}
        />

        <button
          className="bm-btn bm-btn-primary bm-btn-full"
          onClick={onSaveExercise}
          disabled={busy || !name.trim()}
        >
          {busy ? 'Saving...' : editing ? 'Save changes' : 'Add exercise'}
        </button>
      </BottomSheet>

      <BottomSheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Routine note">
        <Input
          label="Note"
          placeholder="e.g. Increase weight once all sets hit 10."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="bm-btn bm-btn-primary bm-btn-full" onClick={onSaveNote} disabled={busy}>
          {busy ? 'Saving...' : 'Save note'}
        </button>
      </BottomSheet>

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove this exercise?"
        message="It comes out of this routine. Workouts you have already logged are kept."
        confirmLabel="Remove"
        danger
        onConfirm={onRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  )
}
