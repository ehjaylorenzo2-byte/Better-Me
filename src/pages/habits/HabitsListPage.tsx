import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { StatusSelector } from '@/components/ui/StatusSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getOccurrencesInRange, setOccurrenceStatus } from '@/services/habits'
import {
  addDaysToIsoDate,
  formatIsoDateLong,
  formatIsoTime12h,
  getPhilippineToday,
  isFuturePhilippineDate,
  isoDateWeekday,
} from '@/utils/timezone'
import { calculateDailyProgress } from '@/utils/calculations'
import type { Habit, HabitOccurrence, HabitSchedule, HabitStatus } from '@/types/models'
import './habits.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }
type Tab = 'today' | 'week' | 'month' | 'all'

export function HabitsListPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const today = getPhilippineToday()
  const [tab, setTab] = useState<Tab>('today')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => {
    if (tab === 'today') return { start: today, end: today }
    if (tab === 'week') {
      const weekday = isoDateWeekday(today)
      const start = addDaysToIsoDate(today, -weekday)
      return { start, end: addDaysToIsoDate(start, 6) }
    }
    if (tab === 'month') {
      const [y, m] = today.split('-')
      const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate()
      return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, '0')}` }
    }
    return { start: addDaysToIsoDate(today, -180), end: addDaysToIsoDate(today, 30) }
  }, [tab, today])

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getOccurrencesInRange(userId, range.start, range.end)
      setRows(data)
    } catch {
      setError('Could not load your habits.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, range.start, range.end])

  const progress = useMemo(() => calculateDailyProgress(rows.map((r) => r.status)), [rows])

  const onStatusChange = async (row: Row, status: HabitStatus | null) => {
    // A day that has not happened yet cannot be decided. The database refuses
    // it too; this just says so before the round trip.
    if (isFuturePhilippineDate(row.occurrenceDate)) {
      show('That day has not happened yet.', 'error')
      return
    }
    try {
      await setOccurrenceStatus(row.habitId, row.scheduleId, row.occurrenceDate, row.scheduledTime, status)
      show(status ? `${row.habit.name} marked ${status}.` : `${row.habit.name} cleared.`, 'success')
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not update status. Try again.', 'error')
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of rows) {
      const list = map.get(row.occurrenceDate) ?? []
      list.push(row)
      map.set(row.occurrenceDate, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [rows])

  return (
    <div className="bm-habits-page">
      <div className="bm-habits-header">
        <h1>Habit Tracker</h1>
        <Link to="/calendar" aria-label="Calendar" className="bm-icon-link">
          <CalendarIcon />
        </Link>
      </div>

      <div className="bm-tabs">
        {(['today', 'week', 'month', 'all'] as Tab[]).map((t) => (
          <button key={t} className={`bm-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'today' ? (
        <Card elevated className="bm-habits-progress-card">
          <p className="bm-habits-date">{formatIsoDateLong(today)}</p>
          <div className="bm-habits-progress-row">
            <strong>
              {progress.done} / {progress.scheduled} Completed
            </strong>
            <span>{Math.round(progress.scheduledCompletionRate)}%</span>
          </div>
          <ProgressBar value={progress.scheduledCompletionRate} />
        </Card>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          message="No habits yet. Add your first one."
          action={
            <button className="bm-btn bm-btn-primary" onClick={() => navigate('/habits/new')}>
              Add Habit
            </button>
          }
        />
      ) : (
        <div className="bm-habits-groups">
          {grouped.map(([date, dateRows]) => (
            <div key={date} className="bm-habits-group">
              {tab !== 'today' ? <p className="bm-habits-group-date">{formatIsoDateLong(date)}</p> : null}
              <ul className="bm-habit-item-list">
                {dateRows.map((row) => (
                  <li key={row.id}>
                    <Card className="bm-habit-item">
                      <div className="bm-habit-item-top">
                        <Link to={`/habits/${row.habitId}`} className="bm-habit-item-name">
                          {row.habit.name}
                        </Link>
                        {row.scheduledTime ? (
                          <span className="bm-habit-item-time">{formatIsoTime12h(row.scheduledTime)}</span>
                        ) : null}
                      </div>
                      <StatusSelector
                        value={row.status}
                        disabled={isFuturePhilippineDate(row.occurrenceDate)}
                        onChange={(s) => onStatusChange(row, s)}
                      />
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  )
}
