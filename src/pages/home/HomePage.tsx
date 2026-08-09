import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { ProgressBar, ProgressRing } from '@/components/ui/Progress'
import { StatusBadge } from '@/components/ui/StatusSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { getOccurrencesInRange } from '@/services/habits'
import { getBudgetForMonth, listExpensesForMonth } from '@/services/finance'
import { getOrCreateWorkoutForDate } from '@/services/gym'
import {
  addDaysToIsoDate,
  formatIsoTime12h,
  getCurrentPhilippineMonth,
  getPhilippineToday,
  isoDateWeekday,
} from '@/utils/timezone'
import { calculateDailyProgress, calculateBudgetRemaining } from '@/utils/calculations'
import { formatCurrency } from '@/utils/money'
import { getMotivationMessage } from '@/utils/motivation'
import type { HabitOccurrence, Habit, HabitSchedule } from '@/types/models'
import './home.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }

function startOfWeek(date: string): string {
  const weekday = isoDateWeekday(date) // 0=Sun
  return addDaysToIsoDate(date, -weekday)
}

export function HomePage() {
  const { userId, username } = useAuth()
  const today = getPhilippineToday()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todayRows, setTodayRows] = useState<Row[]>([])
  const [weekRows, setWeekRows] = useState<Row[]>([])
  const [budgetLine, setBudgetLine] = useState<string | null>(null)
  const [gymToday, setGymToday] = useState<Row | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const weekStart = startOfWeek(today)
      const weekEnd = addDaysToIsoDate(weekStart, 6)
      const [today_, week, budget, expenses] = await Promise.all([
        getOccurrencesInRange(userId, today, today),
        getOccurrencesInRange(userId, weekStart, weekEnd),
        getBudgetForMonth(userId, getCurrentPhilippineMonth()),
        listExpensesForMonth(userId, getCurrentPhilippineMonth()),
      ])
      setTodayRows(today_)
      setWeekRows(week)
      setGymToday(today_.find((r) => r.habit.category === 'gym') ?? null)

      if (budget) {
        const spent = expenses.reduce((sum, e) => sum + e.amount, 0)
        const summary = calculateBudgetRemaining(budget.amount, spent)
        setBudgetLine(
          summary.isOverBudget
            ? `Over budget by ${formatCurrency(summary.overBy)}`
            : `${formatCurrency(summary.remaining)} left to spend`,
        )
      } else {
        setBudgetLine('No budget set')
      }
    } catch {
      setError('Could not load your dashboard right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const todayProgress = useMemo(() => calculateDailyProgress(todayRows.map((r) => r.status)), [todayRows])
  const weekProgress = useMemo(() => calculateDailyProgress(weekRows.map((r) => r.status)), [weekRows])
  const motivation = useMemo(
    () => getMotivationMessage(todayProgress, today.split('-').reduce((a, n) => a + Number(n), 0)),
    [todayProgress, today],
  )

  const habitsDoneCount = todayRows.filter((r) => r.status === 'done').length

  const greeting = (() => {
    const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }))
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  if (loading) return <LoadingState label="Loading your dashboard..." />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="bm-home">
      <header className="bm-home-header">
        <p>{greeting},</p>
        <h1>{username ?? '...'}</h1>
        <p className="bm-home-sub">{motivation}</p>
      </header>

      <Card elevated className="bm-home-progress-card">
        <div className="bm-home-progress-row">
          <ProgressRing value={todayProgress.scheduledCompletionRate} label="Today" />
          <div className="bm-home-progress-stats">
            <Stat label="Done" value={todayProgress.done} tone="success" />
            <Stat label="Skipped" value={todayProgress.skipped} tone="warning" />
            <Stat label="Cancelled" value={todayProgress.cancelled} tone="danger" />
            <Stat label="No Status" value={todayProgress.noStatus} />
          </div>
        </div>
      </Card>

      <div className="bm-home-summary-grid">
        <Card>
          <p className="bm-summary-label">Habits</p>
          <p className="bm-summary-value">
            {habitsDoneCount} / {todayRows.length} Done
          </p>
        </Card>
        <Card>
          <p className="bm-summary-label">Gym</p>
          <p className="bm-summary-value">
            {gymToday ? (gymToday.scheduledTime ? formatIsoTime12h(gymToday.scheduledTime) : 'Scheduled') : 'Rest day'}
          </p>
        </Card>
        <Card>
          <p className="bm-summary-label">Finance</p>
          <p className="bm-summary-value bm-summary-value-sm">{budgetLine}</p>
        </Card>
      </div>

      <Card>
        <div className="bm-section-title-row">
          <h2>Weekly Progress</h2>
          <span>{Math.round(weekProgress.doneRateAmongFinalized)}%</span>
        </div>
        <ProgressBar value={weekProgress.doneRateAmongFinalized} />
      </Card>

      <Card>
        <h2 className="bm-section-title">Today's Schedule</h2>
        {todayRows.length === 0 ? (
          <EmptyState message="Nothing scheduled today. Add your first habit." />
        ) : (
          <ul className="bm-schedule-list">
            {todayRows.map((row) => (
              <li key={row.id} className="bm-schedule-row">
                <div>
                  <p className="bm-schedule-name">{row.habit.name}</p>
                  {row.scheduledTime ? <p className="bm-schedule-time">{formatIsoTime12h(row.scheduledTime)}</p> : null}
                </div>
                <StatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link to="/habits" className="bm-home-cta">
        Open Habit Tracker
      </Link>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="bm-stat">
      <span className={`bm-stat-value ${tone ? `bm-stat-${tone}` : ''}`}>{value}</span>
      <span className="bm-stat-label">{label}</span>
    </div>
  )
}
