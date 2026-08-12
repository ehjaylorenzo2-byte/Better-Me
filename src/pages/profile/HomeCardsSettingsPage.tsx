import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getUserPreferences, updateAppPreferences } from '@/services/preferences'
import './profile.css'

/**
 * Which optional blocks appear on Home.
 *
 * The greeting, Today's progress and Today's schedule are deliberately not
 * listed. Turning those off would leave Home with nothing on it, and Home is
 * the screen the app opens to.
 */
const CARDS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'motivation', label: 'Daily message', hint: 'The line under your name about how today is going.' },
  { id: 'budget', label: 'Budget line', hint: 'How much you have left to spend, inside the progress card.' },
  { id: 'quick', label: 'Quick actions', hint: 'The four shortcut buttons: habit, expense, transfer, gym.' },
  { id: 'stats', label: 'Done, Skipped, Left, This week', hint: 'The row of four small numbers.' },
]

export function HomeCardsSettingsPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const [hidden, setHidden] = useState<string[] | null>(null)
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(0)

  useEffect(() => {
    if (!userId) return
    getUserPreferences(userId).then((p) => {
      setHidden(p.hiddenHomeCards)
      setWeekStartsOn(p.weekStartsOn)
    })
  }, [userId])

  if (!hidden) return <LoadingState />

  const toggle = async (id: string) => {
    if (!userId) return
    const previous = hidden
    const next = hidden.includes(id) ? hidden.filter((c) => c !== id) : [...hidden, id]
    setHidden(next)
    try {
      await updateAppPreferences(userId, { hiddenHomeCards: next })
    } catch {
      setHidden(previous)
      show('Could not save that. Try again.', 'error')
    }
  }

  const pickWeekStart = async (value: 0 | 1) => {
    if (!userId) return
    const previous = weekStartsOn
    setWeekStartsOn(value)
    try {
      await updateAppPreferences(userId, { weekStartsOn: value })
    } catch {
      setWeekStartsOn(previous)
      show('Could not save that. Try again.', 'error')
    }
  }

  return (
    <div className="bm-enter">
      <PageHeader title="Home screen" />

      <p className="bm-settings-note" style={{ marginBottom: 16 }}>
        Switch off anything you do not look at. Your greeting, Today's progress and Today's schedule
        always stay, so Home never ends up empty.
      </p>

      <Card>
        {CARDS.map((card) => {
          const on = !hidden.includes(card.id)
          return (
            <div className="bm-toggle-row" key={card.id}>
              <span className="bm-toggle-text">
                <span className="bm-toggle-label">{card.label}</span>
                <span className="bm-toggle-hint">{card.hint}</span>
              </span>
              <button
                className={`bm-switch ${on ? 'on' : ''}`}
                onClick={() => toggle(card.id)}
                aria-pressed={on}
                aria-label={card.label}
              >
                <span className="bm-switch-dot" />
              </button>
            </div>
          )
        })}
      </Card>

      <h2 className="bm-section-title" style={{ margin: '32px 0 12px' }}>
        Calendar
      </h2>
      <p className="bm-settings-note" style={{ marginBottom: 16 }}>
        Which day your calendar weeks begin on.
      </p>
      <div className="bm-month-choices" role="group" aria-label="First day of the week">
        {([0, 1] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`bm-month-choice ${weekStartsOn === value ? 'active' : ''}`}
            onClick={() => pickWeekStart(value)}
            aria-pressed={weekStartsOn === value}
          >
            Start on {value === 0 ? 'Sunday' : 'Monday'}
          </button>
        ))}
      </div>
    </div>
  )
}
