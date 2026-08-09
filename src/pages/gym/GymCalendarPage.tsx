import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { getWorkoutHistory } from '@/services/gym'
import { getPhilippineToday } from '@/utils/timezone'
import type { Workout } from '@/types/models'
import './gym.css'
import '../calendar/calendar.css'

export function GymCalendarPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const today = getPhilippineToday()
  const [cursor, setCursor] = useState(today.slice(0, 7))
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getWorkoutHistory(userId, 400)
      setWorkouts(data)
    } catch {
      setError('Could not load gym history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const completedDates = useMemo(
    () => new Set(workouts.filter((w) => w.completed).map((w) => w.workoutDate)),
    [workouts],
  )
  const totalCompleted = completedDates.size

  const [year, month] = cursor.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay()
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1))
    setCursor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  const cells: Array<{ date: string | null; day: number | null }> = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: `${cursor}-${String(d).padStart(2, '0')}`, day: d })

  return (
    <div>
      <PageHeader title="Gym Calendar" />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
            You've been to the gym <strong style={{ color: 'var(--accent)' }}>{totalCompleted}</strong> times.
          </p>

          <div className="bm-cal-month-nav">
            <button onClick={() => shiftMonth(-1)}>‹</button>
            <strong>{monthLabel}</strong>
            <button onClick={() => shiftMonth(1)}>›</button>
          </div>

          <div className="bm-cal-weekday-row">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="bm-cal-grid">
            {cells.map((cell, i) => {
              if (!cell.date) return <div key={i} className="bm-cal-cell bm-cal-cell-empty" />
              const completed = completedDates.has(cell.date)
              return (
                <button
                  key={cell.date}
                  className={`bm-cal-cell ${completed ? 'bm-gym-cell-completed' : ''} ${cell.date === today ? 'bm-cal-cell-today' : ''}`}
                  onClick={() => navigate(`/gym/${cell.date}`)}
                >
                  <span className="bm-cal-day-num">{cell.day}</span>
                  {completed ? <span aria-hidden="true">💪</span> : null}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
