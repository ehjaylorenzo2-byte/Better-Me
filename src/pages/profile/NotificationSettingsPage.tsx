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

  const toggle = async (key: keyof Pick<CombinedPreferences, 'remindersEnabled' | 'oneHourReminderEnabled' | 'noonSummaryEnabled'>) => {
    if (!userId) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await updateNotificationPreferences(userId, { [key]: next[key] })
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
        <ToggleRow label="Reminders enabled" value={prefs.remindersEnabled} onToggle={() => toggle('remindersEnabled')} />
        <ToggleRow
          label="1 hour before reminder"
          value={prefs.oneHourReminderEnabled}
          onToggle={() => toggle('oneHourReminderEnabled')}
        />
        <ToggleRow label="12PM daily summary" value={prefs.noonSummaryEnabled} onToggle={() => toggle('noonSummaryEnabled')} />
      </Card>
    </div>
  )
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="bm-toggle-row">
      <span>{label}</span>
      <button className={`bm-switch ${value ? 'on' : ''}`} onClick={onToggle} aria-pressed={value} aria-label={label}>
        <span className="bm-switch-dot" />
      </button>
    </div>
  )
}
