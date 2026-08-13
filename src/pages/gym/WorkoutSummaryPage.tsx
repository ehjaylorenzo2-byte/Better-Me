import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { getOrCreateWorkoutForDate } from '@/services/gym'
import { listRoutines } from '@/services/programs'
import {
  findNewRecords,
  formatDuration,
  formatVolume,
  getExerciseTotals,
  getWorkoutTotals,
  gramsToKg,
  listPersonalRecords,
  type RecordKind,
} from '@/services/workoutSets'
import { formatIsoDateLong, getPhilippineToday } from '@/utils/timezone'
import type { ExerciseTotals, WorkoutTotals } from '@/types/models'
import './gym.css'
import '@/components/gym/gym-log.css'

/**
 * What you just did.
 *
 * Every figure here is computed from the individual sets, so it cannot drift
 * from what was logged. Exercises measured in time or distance are shown in
 * their own units rather than being folded into a kilogram total they have no
 * business being part of.
 */
export function WorkoutSummaryPage() {
  const params = useParams()
  const date = params.date ?? getPhilippineToday()
  const { userId } = useAuth()
  const navigate = useNavigate()

  const [totals, setTotals] = useState<WorkoutTotals | null>(null)
  const [exercises, setExercises] = useState<ExerciseTotals[]>([])
  const [records, setRecords] = useState<Array<{ name: string; kind: RecordKind; valueGrams?: number; reps?: number }>>([])
  const [routineName, setRoutineName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const workout = await getOrCreateWorkoutForDate(userId, date)
      const [workoutTotals, exerciseTotals, personalRecords, routines] = await Promise.all([
        getWorkoutTotals(workout.id),
        getExerciseTotals(workout.id),
        listPersonalRecords(userId),
        listRoutines(userId, { includeArchived: true }),
      ])
      setTotals(workoutTotals)
      setExercises(exerciseTotals.filter((e) => e.setCount > 0))
      setRecords(findNewRecords(exerciseTotals, personalRecords))
      setRoutineName(routines.find((r) => r.id === workout.routineId)?.name ?? null)
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

  if (loading) return <LoadingState />
  if (error || !totals) return <ErrorState message={error ?? 'Nothing logged for this day.'} onRetry={load} />

  // Biggest lifts first, which is what anyone looks for.
  const top = [...exercises].sort((a, b) => b.volumeGrams - a.volumeGrams).slice(0, 3)

  const describeRecord = (record: { kind: RecordKind; valueGrams?: number; reps?: number }): string => {
    if (record.kind === 'weight') {
      return `${gramsToKg(record.valueGrams ?? 0)} kg${record.reps ? ` × ${record.reps}` : ''}`
    }
    if (record.kind === 'reps') return `${record.reps} reps`
    return formatVolume(record.valueGrams ?? 0)
  }

  return (
    <div className="bm-enter">
      <PageHeader title="Workout complete" />

      <Card elevated className="bm-summary-hero">
        <p className="bm-summary-routine">{routineName ?? 'Workout'}</p>
        <p className="bm-summary-date">{formatIsoDateLong(date)}</p>
        <p className="bm-summary-duration num">{formatDuration(totals.durationMinutes)}</p>
      </Card>

      <div className="bm-summary-grid">
        <Stat value={String(totals.exerciseCount)} label="Exercises" />
        <Stat value={String(totals.setCount)} label="Sets" />
        <Stat value={String(totals.totalReps)} label="Reps" />
        <Stat value={formatVolume(totals.volumeGrams)} label="Volume" />
      </div>

      {records.length > 0 ? (
        <Card className="bm-pr-card">
          <p className="bm-pr-title">New personal {records.length === 1 ? 'record' : 'records'} 🎉</p>
          {records.map((record) => (
            <p key={`${record.name}-${record.kind}`} className="bm-pr-line">
              <strong>{record.name}</strong> · {describeRecord(record)}
            </p>
          ))}
        </Card>
      ) : null}

      {top.length > 0 ? (
        <Card style={{ marginBottom: 14 }}>
          <h2 className="bm-section-title">Top exercises</h2>
          {top.map((exercise) => (
            <div key={exercise.workoutExerciseId} className="bm-summary-ex">
              <span>{exercise.name}</span>
              <span className="num">
                {exercise.measure === 'weight_reps'
                  ? `${gramsToKg(exercise.bestWeightGrams) ?? 0} kg × ${exercise.bestReps ?? 0}`
                  : exercise.measure === 'duration'
                    ? `${Math.round(exercise.totalSeconds / 60)} min`
                    : exercise.measure === 'distance'
                      ? `${(exercise.totalMetres / 1000).toFixed(2)} km`
                      : `${exercise.totalReps} reps`}
              </span>
            </div>
          ))}
        </Card>
      ) : null}

      {totals.totalSeconds > 0 || totals.totalMetres > 0 ? (
        <p className="bm-entry-meta" style={{ marginBottom: 14 }}>
          Also {totals.totalSeconds > 0 ? `${Math.round(totals.totalSeconds / 60)} minutes of timed work` : ''}
          {totals.totalSeconds > 0 && totals.totalMetres > 0 ? ' and ' : ''}
          {totals.totalMetres > 0 ? `${(totals.totalMetres / 1000).toFixed(2)} km covered` : ''}. Those are not
          counted in the kilogram volume, because weight times reps does not apply to them.
        </p>
      ) : null}

      <button className="bm-btn bm-btn-secondary bm-btn-full" onClick={() => navigate(`/gym/${date}`)}>
        Back to the workout
      </button>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bm-summary-stat">
      <span className="bm-summary-stat-value num">{value}</span>
      <span className="bm-summary-stat-label">{label}</span>
    </div>
  )
}
