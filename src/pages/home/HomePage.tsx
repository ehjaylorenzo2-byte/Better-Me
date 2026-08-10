import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Avatar } from '@/components/Avatar'
import { CategoryIcon } from '@/components/CategoryIcon'
import { ProgressRing } from '@/components/ui/Progress'
import { StatusBadge } from '@/components/ui/StatusSelector'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { getOccurrencesInRange } from '@/services/habits'
import { getBudgetForMonth, listExpensesForMonth } from '@/services/finance'
import { getAvatarUrl } from '@/services/avatar'
import { chipVarsForLabel } from '@/theme/categoryStyles'
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
  return addDaysToIsoDate(date, -isoDateWeekday(date))
}

/** Counts a number up on mount. Small touch that makes the hero feel alive. */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

export function HomePage() {
  const { userId, username, displayName } = useAuth()
  const navigate = useNavigate()
  const today = getPhilippineToday()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todayRows, setTodayRows] = useState<Row[]>([])
  const [weekRows, setWeekRows] = useState<Row[]>([])
  const [budgetLine, setBudgetLine] = useState<string | null>(null)
  const [overBudget, setOverBudget] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const weekStart = startOfWeek(today)
      const [todayData, weekData, budget, expenses, avatar] = await Promise.all([
        getOccurrencesInRange(userId, today, today),
        getOccurrencesInRange(userId, weekStart, addDaysToIsoDate(weekStart, 6)),
        getBudgetForMonth(userId, getCurrentPhilippineMonth()),
        listExpensesForMonth(userId, getCurrentPhilippineMonth()),
        getAvatarUrl(userId),
      ])

      setTodayRows(todayData)
      setWeekRows(weekData)
      setAvatarUrl(avatar)

      if (budget) {
        const spent = expenses.reduce((sum, e) => sum + e.amount, 0)
        const summary = calculateBudgetRemaining(budget.amount, spent)
        setOverBudget(summary.isOverBudget)
        setBudgetLine(
          summary.isOverBudget
            ? `Over budget by ${formatCurrency(summary.overBy)}`
            : `${formatCurrency(summary.remaining)} left to spend`,
        )
      } else {
        setOverBudget(false)
        setBudgetLine('Set a monthly budget')
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

  const pct = Math.round(todayProgress.scheduledCompletionRate)
  const animatedPct = useCountUp(pct)

  const greeting = (() => {
    const hour = Number(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }),
    )
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  if (loading) return <LoadingState label="Loading your dashboard..." />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="bm-home">
      {/* ---- Identity header: avatar left, greeting, name, motivation ---- */}
      <header className="bm-home-top bm-enter">
        <Link to="/profile" className="bm-home-identity bm-press" aria-label="Open your profile">
          <Avatar url={avatarUrl} username={displayName ?? username} size={56} />
          <span className="bm-home-identity-text">
            <span className="bm-home-greeting">{greeting} 👋</span>
            <span className="bm-home-name">{displayName ?? username ?? '...'}</span>
          </span>
        </Link>
        <Link to="/profile/notifications" className="bm-home-bell bm-press" aria-label="Notification settings">
          <BellIcon />
        </Link>
      </header>

      <p className="bm-home-motivation bm-enter">{motivation}</p>

      {/* ---- Hero: today's progress ---- */}
      <section className="bm-hero bm-lift bm-enter">
        <div className="bm-hero-glow" aria-hidden="true" />
        <div className="bm-hero-inner">
          <div className="bm-hero-left">
            <p className="bm-hero-label">Today's progress</p>
            <p className="bm-hero-value num">
              {animatedPct}
              <span className="bm-hero-pct">%</span>
            </p>
            <p className="bm-hero-sub">
              {todayProgress.scheduled === 0
                ? 'Nothing scheduled today'
                : todayProgress.noStatus > 0
                  ? `${todayProgress.noStatus} still to go`
                  : 'Everything decided today'}
            </p>
          </div>
          <ProgressRing
            value={pct}
            size={92}
            strokeWidth={9}
            showValue={false}
            centre={
              <span className="bm-ring-fraction num">
                {todayProgress.done}
                <span>/{todayProgress.scheduled}</span>
              </span>
            }
          />
        </div>

        <Link
          to="/finance/budget"
          className={`bm-hero-pill bm-press ${overBudget ? 'over' : ''}`}
        >
          <span className="bm-hero-pill-dot" />
          {budgetLine}
          <ChevronIcon />
        </Link>
      </section>

      {/* ---- Quick actions ---- */}
      <section className="bm-quick bm-stagger">
        <QuickAction label="Add Habit" icon="star" onClick={() => navigate('/habits/new')} />
        <QuickAction label="Expense" icon="wallet" onClick={() => navigate('/finance/expense/new')} />
        <QuickAction label="Transfer" icon="repeat" onClick={() => navigate('/finance/transfers/new')} />
        <QuickAction label="Gym" icon="dumbbell" onClick={() => navigate('/gym')} />
      </section>

      {/* ---- Stat strip ---- */}
      <section className="bm-stats bm-stagger">
        <StatTile label="Done" value={todayProgress.done} tone="success" />
        <StatTile label="Skipped" value={todayProgress.skipped} tone="warning" />
        <StatTile label="Left" value={todayProgress.noStatus} />
        <StatTile label="This week" value={`${Math.round(weekProgress.scheduledCompletionRate)}%`} tone="accent" />
      </section>

      {/* ---- Today's schedule ---- */}
      <section className="bm-section">
        <div className="bm-section-head">
          <h2>Today's schedule</h2>
          <Link to="/habits" className="bm-link">
            See all
          </Link>
        </div>

        {todayRows.length === 0 ? (
          <EmptyState
            message="Nothing scheduled today. Add your first habit."
            action={
              <button className="bm-btn bm-btn-primary" onClick={() => navigate('/habits/new')}>
                Add Habit
              </button>
            }
          />
        ) : (
          <ul className="bm-activity bm-stagger">
            {todayRows.slice(0, 6).map((row) => {
              return (
                <li key={row.id}>
                  <Link to={`/habits/${row.habitId}`} className="bm-activity-row bm-press">
                    <span
                      className="bm-chip bm-chip-anim"
                      style={chipVarsForLabel(row.habit.name)}
                    >
                      <CategoryIcon name={row.habit.category === 'gym' ? 'dumbbell' : 'star'} size={19} />
                    </span>
                    <span className="bm-activity-text">
                      <span className="bm-activity-name">{row.habit.name}</span>
                      <span className="bm-activity-time">
                        {row.scheduledTime ? formatIsoTime12h(row.scheduledTime) : 'Any time today'}
                      </span>
                    </span>
                    <StatusBadge status={row.status} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function QuickAction({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button className="bm-quick-item bm-press" onClick={onClick}>
      <span className="bm-quick-circle bm-chip-anim">
        <CategoryIcon name={icon} size={22} />
      </span>
      <span className="bm-quick-label">{label}</span>
    </button>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: 'success' | 'warning' | 'accent'
}) {
  return (
    <div className="bm-stat-tile bm-press">
      <span className={`bm-stat-tile-value num ${tone ? `tone-${tone}` : ''}`}>{value}</span>
      <span className="bm-stat-tile-label">{label}</span>
    </div>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 20a2 2 0 003 0" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
