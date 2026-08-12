// Better Me — scheduled Edge Function: 1-hour-before reminders + 12PM PH daily summary.
//
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
// Schedule (recommended, every 5 minutes) with Supabase's native Cron
// (Dashboard -> Edge Functions -> send-reminders -> Cron) or via pg_cron +
// pg_net calling this function's URL. See README "Web Push setup".
//
// Required secrets (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-available to edge functions)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)

// @ts-nocheck -- Deno edge runtime; not part of the Vite/TS app build.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const PH_TZ = 'Asia/Manila'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const supabase = createClient(supabaseUrl, serviceRoleKey)

function phNowParts() {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, now }
}

function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

function scheduleAppliesToday(schedule: any, today: string): boolean {
  if (schedule.start_date > today) return false
  if (schedule.end_date && schedule.end_date < today) return false
  switch (schedule.recurrence) {
    case 'once':
      return schedule.start_date === today
    case 'daily':
      return true
    case 'weekly':
    case 'custom': {
      const wd = weekdayOf(today)
      return schedule.weekdays ? schedule.weekdays.includes(wd) : weekdayOf(schedule.start_date) === wd
    }
    case 'monthly':
      return today.slice(8, 10) === schedule.start_date.slice(8, 10)
    default:
      return false
  }
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const wrapped = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId)
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    } catch (err) {
      // 410/404 means the subscription is gone; clean it up.
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push send failed', userId, err)
      }
    }
  }
}

Deno.serve(async () => {

/**
 * Preferences, read once per user per run.
 *
 * Until now these switches were decoration: the one hour reminder never looked
 * at them at all, so turning notifications off changed nothing. Every send now
 * passes through canSend().
 */
const prefCache = new Map<string, Record<string, boolean>>()

async function loadPrefs(userId: string): Promise<Record<string, boolean>> {
  const cached = prefCache.get(userId)
  if (cached) return cached

  const { data } = await supabase
    .from('notification_preferences')
    .select('reminders_enabled, one_hour_reminder_enabled, noon_summary_enabled, gym_reminders_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  // Missing row means the user has never touched settings, so defaults apply.
  const prefs = {
    reminders: data?.reminders_enabled ?? true,
    oneHour: data?.one_hour_reminder_enabled ?? true,
    noon: data?.noon_summary_enabled ?? true,
    gym: data?.gym_reminders_enabled ?? true,
  }
  prefCache.set(userId, prefs)
  return prefs
}

async function canSend(userId: string, kind: 'one_hour' | 'noon_summary', isGym: boolean): Promise<boolean> {
  const prefs = await loadPrefs(userId)
  if (!prefs.reminders) return false
  if (kind === 'one_hour' && !prefs.oneHour) return false
  if (kind === 'noon_summary' && !prefs.noon) return false
  if (isGym && !prefs.gym) return false
  return true
}

/**
 * Claims the right to send one reminder, and returns false if it was already
 * claimed.
 *
 * The guarantee is the unique index on reminder_deliveries, not this function:
 * inserting first means two overlapping runs cannot both win, which a
 * check-then-send would allow. The push tag only ever deduplicated what the
 * phone displayed, never what we sent.
 */
async function claimDelivery(
  userId: string,
  kind: 'one_hour' | 'noon_summary',
  subjectId: string | null,
  date: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('reminder_deliveries')
    .insert({ user_id: userId, kind, subject_id: subjectId, occurrence_date: date })

  // 23505 is the unique violation: someone already sent this one. Any other
  // error also means do not send, because we could not prove it is safe to.
  if (error) return false
  return true
}

  const { date: today, time: nowTime } = phNowParts()
  const windowStart = nowTime
  const windowEnd = addMinutes(nowTime, 5)

  // ---------------------------------------------------------------------
  // 1-hour-before reminders: any schedule whose (time - 60min) falls in the
  // current 5-minute execution window, for today's occurrence, only if that
  // occurrence has no finalized status yet.
  // ---------------------------------------------------------------------
  const { data: schedules } = await supabase
    .from('habit_schedules')
    .select('*, habits!inner(id, user_id, name, archived, category)')
    .eq('reminder_enabled', true)
    .not('time', 'is', null)

  for (const schedule of schedules ?? []) {
    if (schedule.habits.archived) continue
    if (!scheduleAppliesToday(schedule, today)) continue

    const reminderTime = addMinutes(schedule.time.slice(0, 5), -60)
    const inWindow = windowStart <= windowEnd ? reminderTime >= windowStart && reminderTime < windowEnd : false
    if (!inWindow) continue

    const { data: occurrence } = await supabase
      .from('habit_occurrences')
      .select('status')
      .eq('habit_id', schedule.habits.id)
      .eq('occurrence_date', today)
      .maybeSingle()

    if (occurrence?.status) continue // already Done/Skipped/Cancelled -- no reminder.

    const isGym = schedule.habits.category === 'gym'
    if (!(await canSend(schedule.habits.user_id, 'one_hour', isGym))) continue
    if (!(await claimDelivery(schedule.habits.user_id, 'one_hour', schedule.habits.id, today))) continue

    await sendPushToUser(schedule.habits.user_id, {
      title: `${schedule.habits.name} in 1 hour`,
      body: `You scheduled it. Show up.`,
      tag: `reminder-${schedule.habits.id}-${today}`,
      url: '/habits',
    })
  }

  // ---------------------------------------------------------------------
  // 12:00 PM Philippine daily summary of everything still status = null.
  // ---------------------------------------------------------------------
  if (nowTime >= '12:00' && nowTime < '12:05') {
    const { data: allSchedules } = await supabase
      .from('habit_schedules')
      .select('*, habits!inner(id, user_id, name, archived, category)')

    const outstandingByUser = new Map<string, string[]>()

    for (const schedule of allSchedules ?? []) {
      if (schedule.habits.archived) continue
      if (!scheduleAppliesToday(schedule, today)) continue

      const { data: occurrence } = await supabase
        .from('habit_occurrences')
        .select('status')
        .eq('habit_id', schedule.habits.id)
        .eq('occurrence_date', today)
        .maybeSingle()

      if (occurrence?.status) continue

      const list = outstandingByUser.get(schedule.habits.user_id) ?? []
      list.push(schedule.habits.name)
      outstandingByUser.set(schedule.habits.user_id, list)
    }

    for (const [userId, names] of outstandingByUser) {
      if (names.length === 0) continue // nothing outstanding -> no unnecessary reminder.
      if (!(await canSend(userId, 'noon_summary', false))) continue
      if (!(await claimDelivery(userId, 'noon_summary', null, today))) continue

      const body = `You still have ${names.length} thing${names.length > 1 ? 's' : ''} left today:\n${names.join('\n')}\n\nYou've got time. Get moving.`
      await sendPushToUser(userId, { title: 'Better Me', body, tag: `noon-${today}`, url: '/' })
    }
  }

  return new Response(JSON.stringify({ ok: true, ranAt: `${today} ${nowTime}` }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
