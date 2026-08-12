import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getUserPreferences, updateAppPreferences } from '@/services/preferences'
import { getMotivationMessage } from '@/utils/motivation'
import type { MotivationTone } from '@/types/models'
import type { DailyProgress } from '@/utils/calculations'
import './profile.css'

const TONES: Array<{ value: MotivationTone; label: string; blurb: string }> = [
  { value: 'encourage', label: 'Encourage', blurb: 'Kind, whatever the day looked like.' },
  { value: 'balanced', label: 'Balanced', blurb: 'Honest. Praise when earned, a nudge when not.' },
  { value: 'roast', label: 'Roast', blurb: 'Blunt about a bad day, still on your side.' },
  { value: 'brutal', label: 'Brutal', blurb: 'No softening. Only pick this if you mean it.' },
]

/**
 * A middling day, so the preview is representative rather than flattering.
 * Deliberately not a mostly-skipped day: that has its own message which every
 * tone but Encourage shares, and it would make the four options look identical.
 */
const SAMPLE_DAY: DailyProgress = {
  scheduled: 6,
  done: 3,
  skipped: 2,
  cancelled: 1,
  noStatus: 0,
  scheduledCompletionRate: 50,
  doneRateAmongFinalized: 50,
}

export function MotivationSettingsPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const [tone, setTone] = useState<MotivationTone | null>(null)

  useEffect(() => {
    if (!userId) return
    getUserPreferences(userId).then((p) => setTone(p.motivationTone))
  }, [userId])

  if (!tone) return <LoadingState />

  const pick = async (value: MotivationTone) => {
    if (!userId) return
    const previous = tone
    setTone(value)
    try {
      await updateAppPreferences(userId, { motivationTone: value })
    } catch {
      setTone(previous)
      show('Could not save that. Try again.', 'error')
    }
  }

  return (
    <div className="bm-enter">
      <PageHeader title="Motivation Style" />

      <p className="bm-settings-note" style={{ marginBottom: 16 }}>
        This changes how the message on your Home screen talks to you. It never changes your numbers,
        and a good day is never turned into a telling-off.
      </p>

      <div className="bm-theme-options">
        {TONES.map((option) => (
          <button
            key={option.value}
            className={`bm-tone-option ${tone === option.value ? 'active' : ''}`}
            onClick={() => pick(option.value)}
            aria-pressed={tone === option.value}
          >
            <span className="bm-tone-head">
              <strong>{option.label}</strong>
              {tone === option.value ? <span aria-hidden="true">✓</span> : null}
            </span>
            <span className="bm-tone-blurb">{option.blurb}</span>
          </button>
        ))}
      </div>

      <div className="bm-tone-preview">
        <span className="bm-tone-preview-label">On a day like 3 done, 2 skipped, 1 cancelled:</span>
        <p>{getMotivationMessage(SAMPLE_DAY, 3, tone)}</p>
      </div>
    </div>
  )
}
