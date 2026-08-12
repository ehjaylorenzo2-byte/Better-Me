import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getUserPreferences, updateNotificationPreferences, type CombinedPreferences } from '@/services/preferences'
import { getNotificationPermission, isPushSupported, requestNotificationPermissionAndSubscribe, unsubscribeFromPush } from '@/services/push'
import './profile.css'

export function NotificationSettingsPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const [prefs, setPrefs] = useState<CombinedPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (!userId) return
    Promise.all([getUserPreferences(userId), getNotificationPermission()]).then(([p, perm]) => {
      setPrefs(p)
      setPermission(perm)
      setLoading(false)
    })
  }, [userId])

  if (loading || !prefs) return <LoadingState />

  type ToggleKey = keyof Pick<
    CombinedPreferences,
    | 'remindersEnabled'
    | 'oneHourReminderEnabled'
    | 'noonSummaryEnabled'
    | 'gymRemindersEnabled'
    | 'financeRemindersEnabled'
  >

  const toggle = async (key: ToggleKey) => {
    if (!userId) return
    const previous = prefs
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    try {
      await updateNotificationPreferences(userId, { [key]: next[key] })
    } catch {
      setPrefs(previous)
      show('Could not save that. Try again.', 'error')
    }
  }

  const onEnablePush = async () => {
    if (!userId) return
    const result = await requestNotificationPermissionAndSubscribe(userId)
    if (result.success) {
      show('Push notifications enabled.', 'success')
      setPermission('granted')
    } else {
      show(result.error ?? 'Could not enable notifications.', 'error')
    }
  }

  const onDisablePush = async () => {
    if (!userId) return
    await unsubscribeFromPush(userId)
    show('Push notifications disabled on this device.', 'success')
  }

  return (
    <div>
      <PageHeader title="Notification Settings" />

      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, marginBottom: 10, color: 'var(--text-secondary)' }}>
          {!isPushSupported()
            ? 'Push notifications are not supported on this browser.'
            : permission === 'granted'
              ? 'Push notifications are enabled on this device.'
              : 'Enable push notifications to receive reminders even when Better Me is closed.'}
        </p>
        {isPushSupported() ? (
          permission === 'granted' ? (
            <button className="bm-btn bm-btn-secondary bm-btn-full" onClick={onDisablePush}>
              Disable on this device
            </button>
          ) : (
            <button className="bm-btn bm-btn-primary bm-btn-full" onClick={onEnablePush}>
              Enable Push Notifications
            </button>
          )
        ) : null}
      </Card>

      <Card>
        <ToggleRow
          label="Send me reminders"
          hint="The master switch. Off means nothing is sent at all."
          value={prefs.remindersEnabled}
          onToggle={() => toggle('remindersEnabled')}
        />
        <ToggleRow
          label="1 hour before"
          hint="A nudge an hour before something on your schedule."
          value={prefs.oneHourReminderEnabled}
          disabled={!prefs.remindersEnabled}
          onToggle={() => toggle('oneHourReminderEnabled')}
        />
        <ToggleRow
          label="Midday summary"
          hint="One message around noon with what is still left."
          value={prefs.noonSummaryEnabled}
          disabled={!prefs.remindersEnabled}
          onToggle={() => toggle('noonSummaryEnabled')}
        />
        <ToggleRow
          label="Gym reminders"
          hint="Reminders for gym sessions specifically."
          value={prefs.gymRemindersEnabled}
          disabled={!prefs.remindersEnabled}
          onToggle={() => toggle('gymRemindersEnabled')}
        />
        <ToggleRow
          label="Money reminders"
          hint="Nudges about your budget and entries you have not logged."
          value={prefs.financeRemindersEnabled}
          disabled={!prefs.remindersEnabled}
          onToggle={() => toggle('financeRemindersEnabled')}
        />
      </Card>

      <p className="bm-settings-footnote" style={{ marginTop: 16 }}>
        These switches are checked before anything is sent, not just when it is scheduled. Turning one
        off stops it straight away.
      </p>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  value,
  disabled = false,
  onToggle,
}: {
  label: string
  hint?: string
  value: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <div className={`bm-toggle-row ${disabled ? 'is-off' : ''}`}>
      <span className="bm-toggle-text">
        <span className="bm-toggle-label">{label}</span>
        {hint ? <span className="bm-toggle-hint">{hint}</span> : null}
      </span>
      <button
        className={`bm-switch ${value && !disabled ? 'on' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={value}
        aria-label={label}
      >
        <span className="bm-switch-dot" />
      </button>
    </div>
  )
}
