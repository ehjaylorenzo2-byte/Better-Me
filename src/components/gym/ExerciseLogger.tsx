import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import {
  addSet,
  getPreviousSets,
  gramsToKg,
  removeSet,
  updateSet,
  type SetDraft,
} from '@/services/workoutSets'
import type { ExerciseMeasure, PreviousSet, WorkoutExercise, WorkoutSet } from '@/types/models'
import type { IsoDate } from '@/utils/timezone'
import './gym-log.css'

/**
 * One exercise, its sets, and what you did last time.
 *
 * The previous column is the whole reason this screen is worth using during a
 * workout rather than after it: you can see that last Monday was 60kg for 10
 * without leaving the page to go looking.
 */
export function ExerciseLogger({
  userId,
  exercise,
  sets,
  date,
  editable,
  onChanged,
  onSetLogged,
}: {
  userId: string
  exercise: WorkoutExercise
  sets: WorkoutSet[]
  date: IsoDate
  editable: boolean
  onChanged: () => void
  /** Fired after a set is added, so the screen can start the rest timer. */
  onSetLogged: () => void
}) {
  const { show } = useToast()
  const [previous, setPrevious] = useState<PreviousSet[]>([])
  const [busy, setBusy] = useState(false)

  // Seeded from the last set so the common case is one tap.
  const last = sets[sets.length - 1]
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [minutes, setMinutes] = useState('')
  const [distance, setDistance] = useState('')

  useEffect(() => {
    let active = true
    getPreviousSets(exercise.name, date)
      .then((rows) => {
        if (active) setPrevious(rows)
      })
      .catch(() => {
        // A missing history is not an error worth interrupting a workout for.
      })
    return () => {
      active = false
    }
  }, [exercise.name, date])

  useEffect(() => {
    if (last) {
      setWeight(last.weightGrams ? String(gramsToKg(last.weightGrams)) : '')
      setReps(last.reps ? String(last.reps) : '')
    } else if (previous.length > 0) {
      // No sets yet today: start from last session's first set.
      const first = previous[0]
      setWeight(first.weightGrams ? String(gramsToKg(first.weightGrams)) : '')
      setReps(first.reps ? String(first.reps) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets.length, previous.length])

  const measure: ExerciseMeasure = exercise.measure

  const describePrevious = (row: PreviousSet): string => {
    if (measure === 'duration') return `${Math.round((row.durationSeconds ?? 0) / 60)} min`
    if (measure === 'distance') return `${((row.distanceMetres ?? 0) / 1000).toFixed(2)} km`
    if (measure === 'reps') return `${row.reps ?? 0} reps`
    return `${gramsToKg(row.weightGrams) ?? 0} kg × ${row.reps ?? 0}`
  }

  const describeSet = (set: WorkoutSet): string => {
    if (measure === 'duration') return `${Math.round((set.durationSeconds ?? 0) / 60)} min`
    if (measure === 'distance') return `${((set.distanceMetres ?? 0) / 1000).toFixed(2)} km`
    if (measure === 'reps') return `${set.reps ?? 0} reps`
    return `${gramsToKg(set.weightGrams) ?? 0} kg × ${set.reps ?? 0}`
  }

  const buildDraft = (): SetDraft | string => {
    if (measure === 'weight_reps') {
      const w = Number(weight)
      const r = Number(reps)
      if (!Number.isFinite(w) || w < 0) return 'Enter a weight.'
      if (!Number.isFinite(r) || r <= 0) return 'Enter how many reps.'
      return { weightKg: w, reps: r }
    }
    if (measure === 'reps') {
      const r = Number(reps)
      if (!Number.isFinite(r) || r <= 0) return 'Enter how many reps.'
      return { reps: r }
    }
    if (measure === 'duration') {
      const m = Number(minutes)
      if (!Number.isFinite(m) || m <= 0) return 'Enter how long, in minutes.'
      return { durationSeconds: Math.round(m * 60) }
    }
    const km = Number(distance)
    if (!Number.isFinite(km) || km <= 0) return 'Enter the distance in kilometres.'
    return { distanceMetres: Math.round(km * 1000) }
  }

  const onAdd = async () => {
    if (busy || !editable) return
    const draft = buildDraft()
    if (typeof draft === 'string') {
      show(draft, 'error')
      return
    }
    setBusy(true)
    try {
      await addSet(userId, exercise.id, draft)
      onChanged()
      onSetLogged()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save that set.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onToggleComplete = async (set: WorkoutSet) => {
    if (!editable) return
    try {
      await updateSet(set.id, { completed: !set.completed })
      onChanged()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not update that set.', 'error')
    }
  }

  const onRemove = async (set: WorkoutSet) => {
    if (!editable) return
    try {
      await removeSet(set.id)
      onChanged()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not remove that set.', 'error')
    }
  }

  return (
    <Card className="bm-ex-card">
      <div className="bm-ex-head">
        <h3 className="bm-ex-name">{exercise.name}</h3>
        {previous.length > 0 ? (
          <span className="bm-ex-prev-label">Last time · {previous[0].workoutDate}</span>
        ) : (
          <span className="bm-ex-prev-label">First time</span>
        )}
      </div>

      <div className="bm-set-table">
        <div className="bm-set-row is-header">
          <span>Set</span>
          <span>Previous</span>
          <span>Today</span>
          <span aria-hidden="true" />
        </div>

        {sets.map((set, index) => (
          <div key={set.id} className={`bm-set-row ${set.completed ? '' : 'is-skipped'}`}>
            <span className="bm-set-num num">{set.setNumber}</span>
            <span className="bm-set-prev num">
              {previous[index] ? describePrevious(previous[index]) : '—'}
            </span>
            <button
              type="button"
              className="bm-set-today num"
              onClick={() => onToggleComplete(set)}
              disabled={!editable}
              aria-label={`${describeSet(set)}, ${set.completed ? 'done' : 'not counted'}`}
            >
              {/* The value carries the strikethrough on its own. A line-through
                  on the button would run through the label too, because CSS
                  decorations propagate and a child cannot cancel them. */}
              <span className="bm-set-value">{describeSet(set)}</span>
              {set.completed ? null : <span className="bm-set-flag">not counted</span>}
            </button>
            {editable ? (
              <button
                type="button"
                className="bm-set-remove"
                onClick={() => onRemove(set)}
                aria-label={`Remove set ${set.setNumber}`}
              >
                ×
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}

        {sets.length === 0 && previous.length > 0 ? (
          <div className="bm-set-row is-ghost">
            <span className="bm-set-num num">1</span>
            <span className="bm-set-prev num">{describePrevious(previous[0])}</span>
            <span className="bm-set-today num">—</span>
            <span />
          </div>
        ) : null}
      </div>

      {editable ? (
        <div className="bm-set-entry">
          {measure === 'weight_reps' ? (
            <>
              <label className="bm-set-field">
                <span>kg</span>
                <input
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="bm-set-field">
                <span>reps</span>
                <input
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="0"
                />
              </label>
            </>
          ) : null}

          {measure === 'reps' ? (
            <label className="bm-set-field">
              <span>reps</span>
              <input
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="0"
              />
            </label>
          ) : null}

          {measure === 'duration' ? (
            <label className="bm-set-field">
              <span>minutes</span>
              <input
                inputMode="decimal"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
              />
            </label>
          ) : null}

          {measure === 'distance' ? (
            <label className="bm-set-field">
              <span>km</span>
              <input
                inputMode="decimal"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0"
              />
            </label>
          ) : null}

          <button type="button" className="bm-set-add bm-press" onClick={onAdd} disabled={busy}>
            {busy ? 'Saving…' : 'Add set'}
          </button>
        </div>
      ) : null}
    </Card>
  )
}
