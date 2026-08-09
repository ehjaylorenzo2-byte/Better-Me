import { supabase } from '@/lib/supabase'
import type { ThemePreference } from '@/types/models'

export interface CombinedPreferences {
  theme: ThemePreference
  timezone: string
  remindersEnabled: boolean
  oneHourReminderEnabled: boolean
  noonSummaryEnabled: boolean
}

export async function getUserPreferences(userId: string): Promise<CombinedPreferences | null> {
  const [{ data: prefs }, { data: notif }] = await Promise.all([
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
  ])

  if (!prefs && !notif) return null

  return {
    theme: prefs?.theme ?? 'system',
    timezone: prefs?.timezone ?? 'Asia/Manila',
    remindersEnabled: notif?.reminders_enabled ?? true,
    oneHourReminderEnabled: notif?.one_hour_reminder_enabled ?? true,
    noonSummaryEnabled: notif?.noon_summary_enabled ?? true,
  }
}

export async function updateThemePreference(userId: string, theme: ThemePreference): Promise<void> {
  await supabase.from('user_preferences').upsert({ user_id: userId, theme }, { onConflict: 'user_id' })
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<Pick<CombinedPreferences, 'remindersEnabled' | 'oneHourReminderEnabled' | 'noonSummaryEnabled'>>,
): Promise<void> {
  await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        ...(updates.remindersEnabled !== undefined ? { reminders_enabled: updates.remindersEnabled } : {}),
        ...(updates.oneHourReminderEnabled !== undefined
          ? { one_hour_reminder_enabled: updates.oneHourReminderEnabled }
          : {}),
        ...(updates.noonSummaryEnabled !== undefined ? { noon_summary_enabled: updates.noonSummaryEnabled } : {}),
      },
      { onConflict: 'user_id' },
    )
}
