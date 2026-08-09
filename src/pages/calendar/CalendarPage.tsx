import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { getOccurrencesInRange } from '@/services/habits'
import { getPhilippineToday, isoDateWeekday } from '@/utils/timezone'
import type { Habit, HabitOccurrence, HabitSchedule } from '@/types/models'
import './calendar.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }

export function CalendarPage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const today = getPhilippineToday()
  const [cursor, setCursor] = useState(today.slice(0, 7)) // YYYY-MM
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [year, month] = cursor.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = isoDateWeekday(`${cursor}-01`)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const end = `${cursor}-${String(daysInMonth).padStart(2, '0')}`
      const data = await getOccurrencesInRange(userId, `${cursor}-01`, end)
      setRows(data)
    } catch {
      setError('Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cursor])

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of rows) {
      const list = map.get(r.occurrenceDate) ?? []
      list.push(r)
      map.set(r.occurrenceDate, list)
    }
    return map
  }, [rows])

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
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${cursor}-${String(d).padStart(2, '0')}`, day: d })
  }

  return (
    <div>
      <div className="bm-cal-header">
        <h1>Calendar</h1>
        <Link to={`/calendar/${today}`} className="bm-link">
          Add
        </Link>
      </div>

      <div className="bm-cal-month-nav">
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>{monthLabel}</strong>
        <button onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <div className="bm-cal-weekday-row">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="bm-cal-grid">
            {cells.map((cell, i) => {
              if (!cell.date) return <div key={i} className="bm-cal-cell bm-cal-cell-empty" />
              const dayRows = byDate.get(cell.date) ?? []
              const isToday = cell.date === today
              return (
                <button
                  key={cell.date}
                  className={`bm-cal-cell ${isToday ? 'bm-cal-cell-today' : ''}`}
                  onClick={() => navigate(`/calendar/${cell.date}`)}
                >
                  <span className="bm-cal-day-num">{cell.day}</span>
                  <span className="bm-cal-indicators">
                    {dayRows.slice(0, 4).map((r) => (
                      <span key={r.id} className={`bm-cal-dot bm-cal-dot-${r.status ?? 'none'}`} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
