import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Avatar } from '@/components/Avatar'
import { CategoryIcon } from '@/components/CategoryIcon'
import { StatusBadge } from '@/components/ui/StatusSelector'
import { LoadingState, ErrorState } from '@/components/ui/States'
import { getOccurrencesInRange } from '@/services/habits'
import { listExpensesForMonth } from '@/services/finance'
import { listPaymentsForMonth } from '@/services/debt'
import { getWorkoutForDate } from '@/services/gym'
import { listRoutines } from '@/services/programs'
import { getAvatarUrl } from '@/services/avatar'
import { getUserPreferences } from '@/services/preferences'
import { chipVarsForLabel } from '@/theme/categoryStyles'
import {
  formatIsoDateLong,
  formatIsoTime12h,
  getCurrentPhilippineMonth,
  getPhilippineToday,
} from '@/utils/timezone'
import { addCentavos, formatCurrency } from '@/utils/money'
import { calculateDailyProgress } from '@/utils/calculations'
import { getMotivationMessage } from '@/utils/motivation'
import type { HabitOccurrence, Habit, HabitSchedule, MotivationTone } from '@/types/models'
import './home.css'

type Row = HabitOccurrence & { habit: Habit; schedule: HabitSchedule }

/**
 * Home is a daily snapshot, not a dashboard.
 *
 * It answers one question — what matters today — and then gets out of the way.
 * The previous version opened with a large progress ring and a row of
 * percentages, which is a report about yourself rather than a prompt to do
 * something. Both are gone. The one figure worth keeping — how much of today
 * is done — is a plain line above the schedule.
 *
 * There are no shortcut buttons here either. They live behind the plus in the
 * header, which is reachable from every screen rather than only this one.
 *
 * The financial rule is deliberate and narrow: Home shows SPENT TODAY and
 * nothing else about money. Savings, debt, wallet balances and net worth stay
 * inside Money. That is a decision about who can read your phone over your
 * shoulder, not a layout preference.
 */
export function HomePage() {
  const { userId, username, displayName } = useAuth()
  const navigate = useNavigate()
  const today = getPhilippineToday()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todayRows, setTodayRows] = useState<Row[]>([])
  const [spentToday, setSpentToday] = useState(0)
  const [spentCount, setSpentCount] = useState(0)
  const [workoutName, setWorkoutName] = useState<string | null>(null)
  const [workoutParts, setWorkoutParts] = useState<string[]>([])
  const [workoutDone, setWorkoutDone] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [tone, setTone] = useState<MotivationTone>('balanced')
  // Optional cards switched off under Settings. The greeting, the schedule and
  // the workout are not in here on purpose: hiding those would leave Home with
  // nothing to say.
  const [hiddenCards, setHiddenCards] = useState<string[]>([])
  const shows = (card: string) => !hiddenCards.includes(card)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const month = getCurrentPhilippineMonth()
      const [todayData, expenses, payments, workout, routines, avatar, prefs] =
        await Promise.all([
          getOccurrencesInRange(userId, today, today),
          listExpensesForMonth(userId, month),
          listPaymentsForMonth(userId, month),
          // Read-only on purpose. Opening Home must never create a workout row.
          getWorkoutForDate(userId, today),
          listRoutines(userId, { includeArchived: true }),
          getAvatarUrl(userId),
          getUserPreferences(userId),
        ])

      setTodayRows(todayData)
      setAvatarUrl(avatar)
      setTone(prefs.motivationTone)
      setHiddenCards(prefs.hiddenHomeCards)

      // Spent today uses the same definition of spending as every other screen:
      // expenses plus debt payments. Transfers are not spending and never count.
      const todayExpenses = expenses.filter((e) => e.entryDate === today)
      const todayPayments = payments.filter((p) => p.entryDate === today)
      setSpentToday(
        addCentavos(...todayExpenses.map((e) => e.amount), ...todayPayments.map((p) => p.amount)),
      )
      setSpentCount(todayExpenses.length + todayPayments.length)

      if (workout) {
        setWorkoutDone(workout.completed)
        setWorkoutName(routines.find((r) => r.id === workout.routineId)?.name ?? 'Workout')
        setWorkoutParts(workout.exercises.slice(0, 3).map((e) => e.name))
      } else {
        setWorkoutDone(false)
        setWorkoutName(null)
        setWorkoutParts([])
      }
    } catch {
      setError('Could not load your day right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const todayProgress = useMemo(() => calculateDailyProgress(todayRows.map((r) => r.status)), [todayRows])
  const motivation = useMemo(
    () => getMotivationMessage(todayProgress, today.split('-').reduce((a, n) => a + Number(n), 0), tone),
    [todayProgress, today, tone],
  )

  const greeting = (() => {
    const hour = Number(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }),
    )
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  if (loading) return <LoadingState label="Loading your day..." />
  if (error) return <ErrorState message={error} onRetry={load} />

  const preview = todayRows.slice(0, 4)

  return (
    <div className="bm-home">
      {/* ---- Compact welcome ---- */}
      <header className="bm-home-top bm-enter">
        <Link to="/profile" className="bm-home-identity bm-press" aria-label="Open your profile">
          <Avatar url={avatarUrl} username={displayName ?? username} size={52} />
          <span className="bm-home-identity-text">
            <span className="bm-home-greeting">{greeting}</span>
            <span className="bm-home-name">{displayName ?? username ?? '...'}</span>
            <span className="bm-home-date">{formatIsoDateLong(today)}</span>
          </span>
        </Link>
      </header>

      {shows('motivation') ? <p className="bm-home-motivation bm-enter">{motivation}</p> : null}

      <div className="bm-home-grid">
        {/* ---- Today's schedule. A preview, never the whole calendar. ---- */}
        <section className="bm-card bm-home-schedule bm-enter">
          <div className="bm-home-card-head">
            <p className="bm-eyebrow">Today's schedule</p>
            <Link to="/habits" className="bm-link">
              Open
            </Link>
          </div>

          {todayRows.length === 0 ? (
            <>
              <p className="bm-home-quiet">Nothing scheduled today.</p>
              <button className="bm-btn bm-btn-primary bm-btn-full" onClick={() => navigate('/habits/new')}>
                Add a To Do
              </button>
            </>
          ) : (
            <>
              <p className="bm-home-progress-line num">
                {todayProgress.done} <span>of {todayProgress.scheduled} done</span>
              </p>
              <ul className="bm-home-list">
                {preview.map((row) => (
                  <li key={row.id}>
                    <Link to={`/habits/${row.habitId}`} className="bm-card-row bm-home-row bm-press">
                      <span className="bm-chip" style={chipVarsForLabel(row.habit.name)}>
                        <CategoryIcon name={row.habit.category === 'gym' ? 'dumbbell' : 'star'} size={18} />
                      </span>
                      <span className="bm-home-row-text">
                        <span className="bm-home-row-name">{row.habit.name}</span>
                        <span className="bm-home-row-time">
                          {row.scheduledTime ? formatIsoTime12h(row.scheduledTime) : 'Any time today'}
                        </span>
                      </span>
                      <StatusBadge status={row.status} />
                    </Link>
                  </li>
                ))}
              </ul>
              {todayRows.length > preview.length ? (
                <p className="bm-home-more">and {todayRows.length - preview.length} more in Schedule</p>
              ) : null}
            </>
          )}
        </section>

        {/* ---- Today's workout: what am I training, and start it ---- */}
        <section className="bm-card bm-home-workout bm-enter">
          <p className="bm-eyebrow">Today's workout</p>
          <h2 className="bm-home-workout-name">{workoutName ?? 'Nothing planned'}</h2>
          <p className="bm-home-workout-parts">
            {workoutName
              ? workoutParts.length > 0
                ? workoutParts.join(' · ')
                : 'No exercises yet'
              : 'Start one and it is logged for today.'}
          </p>
          <button
            className={`bm-btn bm-btn-full ${workoutDone ? 'bm-btn-secondary' : 'bm-btn-primary'}`}
            onClick={() => navigate('/gym')}
          >
            {workoutDone ? 'View workout' : 'Start workout'}
          </button>
        </section>

        {/* ---- Spent today. The ONLY money on this screen. ---- */}
        {shows('budget') ? (
          <section className="bm-card bm-home-spent bm-enter">
            <p className="bm-eyebrow">Spent today</p>
            <Link to="/finance/expenses" className="bm-home-spent-value num bm-press">
              {formatCurrency(spentToday)}
            </Link>
            <p className="bm-home-quiet">
              {spentCount === 0
                ? 'Nothing recorded yet today.'
                : `${spentCount} ${spentCount === 1 ? 'entry' : 'entries'} today.`}
            </p>
          </section>
        ) : null}

      </div>
    </div>
  )
}
