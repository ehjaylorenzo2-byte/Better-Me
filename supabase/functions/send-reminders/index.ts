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
    .select('*, habits!inner(id, user_id, name, archived)')
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
      .select('*, habits!inner(id, user_id, name, archived)')

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
      const { data: pref } = await supabase
        .from('notification_preferences')
        .select('noon_summary_enabled')
        .eq('user_id', userId)
        .maybeSingle()
      if (pref && pref.noon_summary_enabled === false) continue
      if (names.length === 0) continue // nothing outstanding -> no unnecessary reminder.

      const body = `You still have ${names.length} thing${names.length > 1 ? 's' : ''} left today:\n${names.join('\n')}\n\nYou've got time. Get moving.`
      await sendPushToUser(userId, { title: 'Better Me', body, tag: `noon-${today}`, url: '/' })
    }
  }

  return new Response(JSON.stringify({ ok: true, ranAt: `${today} ${nowTime}` }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
