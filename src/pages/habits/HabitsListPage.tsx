import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { StatusSelector } from '@/components/ui/StatusSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { CategoryIcon } from '@/components/CategoryIcon'
import { getOccurrencesInRange, setOccurrenceStatus, listHabits } from '@/services/habits'
import {
  addDaysToIsoDate,
  formatIsoDateLong,
  formatIsoTime12h,
  getPhilippineToday,
  isFuturePhilippineDate,
} from '@/utils/timezone'
import { calculateDailyProgress } from '@/utils/calculations'
import { chipVarsForLabel } from '@/theme/categoryStyles'
import type { Habit, HabitOccurrence, HabitSchedule, HabitStatus } from '@/types/models'
import './habits.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }

/**
 * Schedule.
 *
 * The brief renames "Habit" to "To Do" everywhere a person can read it, and
 * inside this screen the two words are not interchangeable either — they name
 * two different things the old single list ran together:
 *
 *   Today  — the occurrences due today. Things to act on.
 *   To Dos — the definitions themselves. Things to manage.
 *
 * The old screen only had the first, which is why there was no way to see
 * everything you had set up, or to reach an archived one again, without
 * walking the calendar until an instance happened to appear.
 *
 * Week and Month moved out to the Calendar, which draws them as grids rather
 * than as a long flat run of dated groups. The link is in the header.
 *
 * Database names are untouched. This is a rename in the interface and nowhere
 * else — tables, columns and routes still say habit, because renaming a URL
 * breaks every bookmark for no visible gain.
 */
type Tab = 'today' | 'todos'

export function HabitsListPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const today = getPhilippineToday()

  const [tab, setTab] = useState<Tab>('today')
  const [rows, setRows] = useState<Row[]>([])
  const [upcoming, setUpcoming] = useState<Row[]>([])
  const [todos, setTodos] = useState<Habit[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      // One range covers today and the next six days, so "later this week"
      // costs no extra round trip and the two lists can never disagree.
      const [range, defs] = await Promise.all([
        getOccurrencesInRange(userId, today, addDaysToIsoDate(today, 6)),
        listHabits(userId, true),
      ])
      setRows(range.filter((r) => r.occurrenceDate === today))
      setUpcoming(range.filter((r) => r.occurrenceDate !== today))
      setTodos(defs)
    } catch {
      setError('Could not load your schedule.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

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

  // Grouped by day so the rest of the week reads as days, not one long run.
  const upcomingByDate = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const row of upcoming) {
      const list = map.get(row.occurrenceDate) ?? []
      list.push(row)
      map.set(row.occurrenceDate, list)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [upcoming])

  const visibleTodos = useMemo(
    () => todos.filter((h) => (showArchived ? true : !h.archived)),
    [todos, showArchived],
  )
  const archivedCount = useMemo(() => todos.filter((h) => h.archived).length, [todos])

  return (
    <div className="bm-habits-page">
      <div className="bm-habits-header">
        <h1>Schedule</h1>
        <Link to="/calendar" aria-label="Open calendar" className="bm-icon-link">
          <CalendarIcon />
        </Link>
      </div>

      <div className="bm-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'today'}
          className={`bm-tab ${tab === 'today' ? 'active' : ''}`}
          onClick={() => setTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'todos'}
          className={`bm-tab ${tab === 'todos' ? 'active' : ''}`}
          onClick={() => setTab('todos')}
        >
          To Dos
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tab === 'today' ? (
        <>
          <Card elevated className="bm-habits-progress-card">
            <p className="bm-habits-date">{formatIsoDateLong(today)}</p>
            <div className="bm-habits-progress-row">
              <strong>
                {progress.done} / {progress.scheduled} done
              </strong>
              <span>{Math.round(progress.scheduledCompletionRate)}%</span>
            </div>
            <ProgressBar value={progress.scheduledCompletionRate} />
          </Card>

          {rows.length === 0 ? (
            <EmptyState
              message="Nothing scheduled today."
              action={
                <button className="bm-btn bm-btn-primary" onClick={() => navigate('/habits/new')}>
                  Add a To Do
                </button>
              }
            />
          ) : (
            <ul className="bm-habit-item-list">
              {rows.map((row) => (
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
                    <StatusSelector value={row.status} onChange={(s) => onStatusChange(row, s)} />
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {/*
            The rest of the week, on the same screen. Read-only on purpose: a
            future day cannot be marked, so offering the control here would be
            a button that always refuses.
          */}
          {upcomingByDate.length > 0 ? (
            <section className="bm-sched-upcoming">
              <p className="bm-eyebrow">Later this week</p>
              {upcomingByDate.map(([date, dateRows]) => (
                <div key={date} className="bm-habits-group">
                  <p className="bm-habits-group-date">{formatIsoDateLong(date)}</p>
                  <ul className="bm-sched-mini-list">
                    {dateRows.map((row) => (
                      <li key={row.id}>
                        <Link to={`/habits/${row.habitId}`} className="bm-card-row bm-press">
                          <span className="bm-chip" style={chipVarsForLabel(row.habit.name)}>
                            <CategoryIcon
                              name={row.habit.category === 'gym' ? 'dumbbell' : 'star'}
                              size={18}
                            />
                          </span>
                          <span className="bm-sched-mini-text">
                            <span className="bm-sched-mini-name">{row.habit.name}</span>
                            <span className="bm-sched-mini-time">
                              {row.scheduledTime ? formatIsoTime12h(row.scheduledTime) : 'Any time'}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : (
        /*
          Everything you have set up, whether or not it lands today. This is
          also the only place an archived To Do can be found again.
        */
        <>
          {archivedCount > 0 ? (
            <label className="bm-sched-archived-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>Show archived ({archivedCount})</span>
            </label>
          ) : null}

          {visibleTodos.length === 0 ? (
            <EmptyState
              message="No To Dos yet. Add your first one."
              action={
                <button className="bm-btn bm-btn-primary" onClick={() => navigate('/habits/new')}>
                  Add a To Do
                </button>
              }
            />
          ) : (
            <ul className="bm-sched-todo-list">
              {visibleTodos.map((h) => (
                <li key={h.id}>
                  <Link to={`/habits/${h.id}`} className="bm-card-row bm-press">
                    <span className="bm-chip" style={chipVarsForLabel(h.name)}>
                      <CategoryIcon name={h.category === 'gym' ? 'dumbbell' : 'star'} size={18} />
                    </span>
                    <span className="bm-sched-mini-text">
                      <span className="bm-sched-mini-name">{h.name}</span>
                      <span className="bm-sched-mini-time">
                        {h.archived ? 'Archived' : h.description || 'Tap to see its schedule'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
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
