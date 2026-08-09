import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  addExercise,
  completeWorkout,
  getOrCreateWorkoutForDate,
  isGymDateCompletable,
  isGymDateEditable,
  isGymFutureDate,
  removeExercise,
  updateWorkoutMeta,
} from '@/services/gym'
import { formatIsoDateLong, getPhilippineToday } from '@/utils/timezone'
import type { Workout } from '@/types/models'
import './gym.css'

export function WorkoutDetailsPage() {
  const params = useParams()
  const date = params.date ?? getPhilippineToday()
  const { userId } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('')

  const [exName, setExName] = useState('')
  const [exSets, setExSets] = useState('3')
  const [exReps, setExReps] = useState('10')
  const [exWeight, setExWeight] = useState('0')

  const editable = isGymDateEditable(date)
  const completable = isGymDateCompletable(date)
  const isFuture = isGymFutureDate(date)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const w = await getOrCreateWorkoutForDate(userId, date)
      setWorkout(w)
      setNotes(w.notes ?? '')
      setDuration(w.durationMinutes ? String(w.durationMinutes) : '')
    } catch {
      setError('Could not load this workout.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date])

  const onAddExercise = async () => {
    if (!workout || !userId || !exName.trim()) return
    try {
      await addExercise(
        workout.id,
        userId,
        { name: exName, sets: Number(exSets) || 0, reps: Number(exReps) || 0, weightKg: Number(exWeight) || 0 },
        workout.exercises.length,
      )
      setExName('')
      show('Exercise added.', 'success')
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not add exercise.', 'error')
    }
  }

  const onRemoveExercise = async (id: string) => {
    await removeExercise(id)
    load()
  }

  const onSaveMeta = async () => {
    if (!workout) return
    await updateWorkoutMeta(workout.id, {
      durationMinutes: duration ? Number(duration) : null,
      notes: notes || null,
    })
    show('Saved.', 'success')
  }

  const onComplete = async () => {
    if (!workout) return
    try {
      await completeWorkout(workout.id)
      show('Workout completed. Gym habit marked Done.', 'success')
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Only today\'s workout can be completed.', 'error')
    }
  }

  if (loading) return <LoadingState />
  if (error || !workout) return <ErrorState message={error ?? 'Not found.'} onRetry={load} />

  return (
    <div>
      <PageHeader title={formatIsoDateLong(date)} />

      {isFuture ? (
        <div className="bm-gym-banner">Future workout: you can plan exercises now, but completion unlocks on the day.</div>
      ) : !editable ? (
        <div className="bm-gym-banner">This day has passed. Viewing in read-only mode.</div>
      ) : null}

      {workout.completed ? (
        <Card className="bm-gym-completed-banner">Workout completed ✓</Card>
      ) : null}

      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Session</h3>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <Input
            label="Duration (min)"
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={!editable}
          />
        </div>
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} />
        {editable ? (
          <Button variant="secondary" fullWidth onClick={onSaveMeta} style={{ marginTop: 10 }}>
            Save Session Info
          </Button>
        ) : null}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Exercises</h3>
        {workout.exercises.length === 0 ? (
          <EmptyState message="No exercises yet." />
        ) : (
          <ul className="bm-exercise-list">
            {workout.exercises.map((ex) => (
              <li key={ex.id} className="bm-exercise-row">
                <div>
                  <p className="bm-exercise-name">{ex.name}</p>
                  <p className="bm-exercise-meta">
                    {ex.weightKg} kg · {ex.sets} sets · {ex.reps} reps
                  </p>
                  {ex.notes ? <p className="bm-exercise-meta">{ex.notes}</p> : null}
                </div>
                {editable ? (
                  <button className="bm-link" onClick={() => onRemoveExercise(ex.id)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {editable ? (
          <div className="bm-add-exercise-form">
            <Input label="Exercise name" value={exName} onChange={(e) => setExName(e.target.value)} placeholder="Bench Press" />
            <div className="bm-exercise-inputs-row">
              <Input label="Weight (kg)" type="number" min="0" value={exWeight} onChange={(e) => setExWeight(e.target.value)} />
              <Input label="Sets" type="number" min="0" value={exSets} onChange={(e) => setExSets(e.target.value)} />
              <Input label="Reps" type="number" min="0" value={exReps} onChange={(e) => setExReps(e.target.value)} />
            </div>
            <Button variant="secondary" fullWidth onClick={onAddExercise}>
              Add Exercise
            </Button>
          </div>
        ) : null}
      </Card>

      {completable && !workout.completed ? (
        <Button fullWidth onClick={onComplete}>
          Mark Workout Complete
        </Button>
      ) : null}

      <button className="bm-btn bm-btn-ghost bm-btn-full" onClick={() => navigate('/gym/calendar')} style={{ marginTop: 12 }}>
        View Gym Calendar
      </button>
    </div>
  )
}
