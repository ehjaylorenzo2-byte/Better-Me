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
  finishWorkoutClock,
  getOrCreateWorkoutForDate,
  isGymDateCompletable,
  isGymDateEditable,
  isGymFutureDate,
  removeExercise,
  startWorkoutFromRoutine,
  updateWorkoutMeta,
} from '@/services/gym'
import { listRoutines } from '@/services/programs'
import { listSetsForWorkout, formatVolume, getWorkoutTotals } from '@/services/workoutSets'
import { getUserPreferences } from '@/services/preferences'
import { ExerciseLogger } from '@/components/gym/ExerciseLogger'
import { RestTimer } from '@/components/gym/RestTimer'
import { formatIsoDateLong, getPhilippineToday } from '@/utils/timezone'
import type { Routine, Workout, WorkoutSet, WorkoutTotals } from '@/types/models'
import './gym.css'
import '@/components/gym/gym-log.css'

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

  const [setsByExercise, setSetsByExercise] = useState<Map<string, WorkoutSet[]>>(new Map())
  const [totals, setTotals] = useState<WorkoutTotals | null>(null)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [restSeconds, setRestSeconds] = useState<number | null>(null)
  const [restDefault, setRestDefault] = useState(90)
  const [restEnabled, setRestEnabled] = useState(true)

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

      const [sets, workoutTotals, routineList, prefs] = await Promise.all([
        listSetsForWorkout(w.id),
        getWorkoutTotals(w.id),
        listRoutines(userId),
        getUserPreferences(userId),
      ])
      setSetsByExercise(sets)
      setTotals(workoutTotals)
      setRoutines(routineList)
      setRestDefault(prefs.restSeconds)
      setRestEnabled(prefs.restTimerEnabled)
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
      // Sets, reps and weight start at zero: what you actually do is logged set
      // by set below, not guessed up front.
      await addExercise(
        workout.id,
        userId,
        { name: exName, sets: 0, reps: 0, weightKg: 0 },
        workout.exercises.length,
      )
      setExName('')
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not add exercise.', 'error')
    }
  }

  const onUseRoutine = async (routineId: string) => {
    if (!userId) return
    try {
      await startWorkoutFromRoutine(userId, date, routineId)
      show('Routine loaded.', 'success')
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not load that routine.', 'error')
    }
  }

  const onRemoveExercise = async (id: string) => {
    await removeExercise(id)
    load()
  }
  void onRemoveExercise

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
      await finishWorkoutClock(workout.id)
      await completeWorkout(workout.id)
      // Deliberately not claiming the habit was marked: it only is when a gym
      // habit exists and is scheduled today, and the old screen said so either
      // way. The summary shows what actually happened.
      navigate(`/gym/${date}/summary`)
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

      {/*
        The way back to the summary and the share image.

        Completing a workout used to be the only route to those two screens, so
        leaving the app — or just tapping Home — put them out of reach until you
        completed something else. They are pages you want days later, so a
        finished workout is now a permanent door to both.
      */}
      {workout.completed ? (
        <Card className="bm-gym-completed-banner">
          <p style={{ marginBottom: 10 }}>Workout completed ✓</p>
          <div className="bm-gym-done-actions">
            <button
              type="button"
              className="bm-btn bm-btn-secondary"
              onClick={() => navigate(`/gym/${date}/summary`)}
            >
              View summary
            </button>
            <button
              type="button"
              className="bm-btn bm-btn-secondary"
              onClick={() => navigate(`/gym/${date}/share`)}
            >
              Share image
            </button>
          </div>
        </Card>
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

      {totals && totals.setCount > 0 ? (
        <Card className="bm-live-totals" style={{ marginBottom: 14 }}>
          <span><strong className="num">{totals.exerciseCount}</strong> exercises</span>
          <span><strong className="num">{totals.setCount}</strong> sets</span>
          <span><strong className="num">{totals.totalReps}</strong> reps</span>
          <span><strong className="num">{formatVolume(totals.volumeGrams)}</strong></span>
        </Card>
      ) : null}

      {workout.exercises.length === 0 && routines.length > 0 && editable ? (
        <Card style={{ marginBottom: 14 }}>
          <h3 className="bm-section-title">Start from a routine</h3>
          <p className="bm-entry-meta" style={{ marginBottom: 12 }}>
            Loads its exercises in order, so you are not retyping them.
          </p>
          <div className="bm-routine-picks">
            {routines.map((routine) => (
              <button
                key={routine.id}
                type="button"
                className="bm-routine-pick bm-press"
                onClick={() => onUseRoutine(routine.id)}
              >
                {routine.name}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {workout.exercises.length === 0 ? (
        <EmptyState message="No exercises yet. Add one below, or start from a routine." />
      ) : (
        <div className="bm-ex-list">
          {workout.exercises.map((ex) => (
            <ExerciseLogger
              key={ex.id}
              userId={userId ?? ''}
              exercise={ex}
              sets={setsByExercise.get(ex.id) ?? []}
              date={date}
              editable={editable}
              onChanged={load}
              onSetLogged={() => {
                if (restEnabled) setRestSeconds(restDefault)
              }}
            />
          ))}
        </div>
      )}

      {editable ? (
        <Card style={{ marginBottom: 14 }}>
          <Input
            label="Add an exercise"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            placeholder="Bench Press"
          />
          <Button variant="secondary" fullWidth onClick={onAddExercise} style={{ marginTop: 10 }}>
            Add exercise
          </Button>
        </Card>
      ) : null}

      {completable && !workout.completed ? (
        <Button fullWidth onClick={onComplete}>
          Mark Workout Complete
        </Button>
      ) : null}

      <button className="bm-btn bm-btn-ghost bm-btn-full" onClick={() => navigate('/gym/calendar')} style={{ marginTop: 12 }}>
        View Gym Calendar
      </button>

      {/* The only way into the routine builder. Without this the programs
          screen exists but nothing links to it. */}
      <button className="bm-btn bm-btn-ghost bm-btn-full" onClick={() => navigate('/gym/programs')}>
        Programs & Routines
      </button>

      <RestTimer
        seconds={restSeconds}
        onDismiss={() => setRestSeconds(null)}
      />
    </div>
  )
}
