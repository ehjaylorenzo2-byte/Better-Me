/**
 * Visual check harness.
 *
 * Builds against a fake Supabase project, serves dist, injects a signed-in
 * session into localStorage and answers every PostgREST call from fixtures.
 * That lets us look at the real screens with real data shapes before anything
 * goes near GitHub, instead of finding out from a phone.
 *
 * Usage:  node scripts/shoot.mjs [outDir]
 */

import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIST = path.join(ROOT, 'dist')
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'shots'))
const PROJECT = 'shots'
const SUPA = `https://${PROJECT}.supabase.co`
const USER = '11111111-1111-1111-1111-111111111111'

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

function serve(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0])
      let file = path.join(DIST, url)
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
      const body = fs.readFileSync(file)
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      res.end(body)
    })
    server.listen(port, () => resolve(server))
  })
}

const day = (offset) => {
  const d = new Date(Date.UTC(2026, 7, 10 + offset))
  return d.toISOString().slice(0, 10)
}

const ACC = {
  gcash: 'aaaaaaaa-0000-0000-0000-000000000001',
  bpi: 'aaaaaaaa-0000-0000-0000-000000000002',
  cash: 'aaaaaaaa-0000-0000-0000-000000000003',
}

const FIXTURES = {
  profiles: [{ id: USER, username: 'ehjay', display_name: 'Ehjay Lorenzo', avatar_url: null }],
  finance_accounts: [
    { id: ACC.gcash, user_id: USER, name: 'GCash', flow: 'both', color: 'sky', icon: 'wallet', is_builtin: false, archived: false, sort_order: 0, created_at: '' },
    { id: ACC.bpi, user_id: USER, name: 'BPI', flow: 'savings', color: 'indigo', icon: 'landmark', is_builtin: false, archived: false, sort_order: 1, created_at: '' },
    { id: ACC.cash, user_id: USER, name: 'Cash', flow: 'outgoing', color: 'amber', icon: 'wallet', is_builtin: true, archived: false, sort_order: 2, created_at: '' },
  ],
  finance_categories: [
    { id: 'c1', user_id: USER, name: 'Food', kind: 'expense', color: 'orange', icon: 'utensils', is_builtin: true, archived: false, sort_order: 0 },
    { id: 'c2', user_id: USER, name: 'Transport', kind: 'expense', color: 'sky', icon: 'car', is_builtin: true, archived: false, sort_order: 1 },
    { id: 'c3', user_id: USER, name: 'Bills', kind: 'expense', color: 'violet', icon: 'zap', is_builtin: true, archived: false, sort_order: 2 },
    { id: 'c4', user_id: USER, name: 'Shopping', kind: 'expense', color: 'pink', icon: 'shopping-bag', is_builtin: true, archived: false, sort_order: 3 },
    { id: 'c5', user_id: USER, name: 'Salary', kind: 'income', color: 'lime', icon: 'banknote', is_builtin: true, archived: false, sort_order: 0 },
    { id: 'c6', user_id: USER, name: 'Freelance', kind: 'income', color: 'teal', icon: 'briefcase', is_builtin: true, archived: false, sort_order: 1 },
  ],
  expense_entries: [
    { id: 'e1', user_id: USER, amount_centavos: 26000, category: 'Food', entry_date: day(0), description: 'Jollibee', account_id: ACC.gcash, created_at: '' },
    { id: 'e2', user_id: USER, amount_centavos: 18500, category: 'Transport', entry_date: day(0), description: 'Grab', account_id: ACC.cash, created_at: '' },
    { id: 'e3', user_id: USER, amount_centavos: 145000, category: 'Bills', entry_date: day(-1), description: 'Meralco', account_id: ACC.gcash, created_at: '' },
    { id: 'e4', user_id: USER, amount_centavos: 89900, category: 'Shopping', entry_date: day(-2), description: null, account_id: ACC.gcash, created_at: '' },
    { id: 'e5', user_id: USER, amount_centavos: 32000, category: 'Food', entry_date: day(-3), description: 'Groceries', account_id: null, created_at: '' },
  ],
  income_entries: [
    { id: 'i1', user_id: USER, amount_centavos: 3500000, source: 'Salary', entry_date: day(-4), note: null, account_id: ACC.bpi, created_at: '' },
    { id: 'i2', user_id: USER, amount_centavos: 850000, source: 'Freelance', entry_date: day(-1), note: 'Logo job', account_id: ACC.gcash, created_at: '' },
  ],
  transfers: [
    { id: 't1', user_id: USER, from_account_id: ACC.bpi, to_account_id: ACC.gcash, amount_centavos: 500000, entry_date: day(-1), note: 'rent money', created_at: '' },
    { id: 't2', user_id: USER, from_account_id: ACC.cash, to_account_id: ACC.bpi, amount_centavos: 200000, entry_date: day(-5), note: null, created_at: '' },
  ],
  budgets: [{ id: 'b1', user_id: USER, month: '2026-08', amount_centavos: 1500000 }],
  savings_categories: [
    { id: 's1', user_id: USER, name: 'Emergency Fund', goal_amount_centavos: 5000000, balance_centavos: 5000000, color: 'teal', icon: 'shield', account_id: ACC.bpi, archived: false, created_at: '' },
    { id: 's2', user_id: USER, name: 'New Laptop', goal_amount_centavos: 6500000, balance_centavos: 900000, color: 'indigo', icon: 'laptop', account_id: null, archived: false, created_at: '' },
    { id: 's3', user_id: USER, name: 'Old Phone Fund', goal_amount_centavos: 2000000, balance_centavos: 350000, color: 'amber', icon: 'phone', account_id: ACC.bpi, archived: true, created_at: '' },
  ],
  savings_transactions: [
    { id: 'st1', user_id: USER, category_id: 's1', type: 'deposit', amount_centavos: 500000, note: null, counter_account_id: ACC.gcash, entry_date: day(0), created_at: '2026-08-10T08:00:00Z' },
  ],
  debts: [
    { id: 'd1', user_id: USER, name: 'Phone Installment', original_amount_centavos: 2400000, balance_centavos: 1200000, paid_off: false, color: 'rose', icon: 'phone', created_at: '' },
  ],
  debt_payments: [
    { id: 'dp1', user_id: USER, debt_id: 'd1', amount_centavos: 200000, note: 'august', account_id: ACC.gcash, entry_date: day(-1), created_at: '2026-08-09T10:00:00Z' },
  ],
  finance_account_balances: [
    { id: ACC.gcash, user_id: USER, balance_centavos: 604100 },
    { id: ACC.bpi, user_id: USER, balance_centavos: 3700000 },
    { id: ACC.cash, user_id: USER, balance_centavos: -18500 },
  ],
  user_preferences: [{ user_id: USER, theme: 'system', default_budget_centavos: null, rest_seconds: 90, rest_timer_enabled: true }],
  programs: [{ id: 'pr1', user_id: USER, name: 'Push Pull Legs', notes: null, archived: false, sort_order: 0, created_at: '' }],
  routines: [
    { id: 'ro1', user_id: USER, program_id: 'pr1', name: 'Push Day', routine_note: 'Increase weight once all sets hit 10.', archived: false, sort_order: 0, created_at: '' },
    { id: 'ro2', user_id: USER, program_id: 'pr1', name: 'Leg Day', routine_note: null, archived: false, sort_order: 1, created_at: '' },
  ],
  /* Was empty, so the routine editor had nothing to photograph. */
  routine_exercises: [
    { id: 'rx1', user_id: USER, routine_id: 'ro1', name: 'Bench Press', measure: 'weight_reps', target_sets: 4, notes: null, sort_order: 0 },
    { id: 'rx2', user_id: USER, routine_id: 'ro1', name: 'Overhead Press', measure: 'weight_reps', target_sets: 3, notes: null, sort_order: 1 },
    { id: 'rx3', user_id: USER, routine_id: 'ro1', name: 'Plank', measure: 'duration', target_sets: null, notes: null, sort_order: 2 },
  ],
  workout_sets: [
    { id: 'ws1', user_id: USER, workout_exercise_id: 'wex1', set_number: 1, weight_grams: 80000, reps: 10, duration_seconds: null, distance_metres: null, completed: true, created_at: '' },
    { id: 'ws2', user_id: USER, workout_exercise_id: 'wex1', set_number: 2, weight_grams: 80000, reps: 10, duration_seconds: null, distance_metres: null, completed: true, created_at: '' },
    { id: 'ws3', user_id: USER, workout_exercise_id: 'wex1', set_number: 3, weight_grams: 75000, reps: 8, duration_seconds: null, distance_metres: null, completed: true, created_at: '' },
    { id: 'ws4', user_id: USER, workout_exercise_id: 'wex2', set_number: 1, weight_grams: null, reps: null, duration_seconds: 120, distance_metres: null, completed: true, created_at: '' },
    { id: 'ws5', user_id: USER, workout_exercise_id: 'wex2', set_number: 2, weight_grams: null, reps: null, duration_seconds: 90, distance_metres: null, completed: false, created_at: '' },
  ],
  workout_exercise_totals: [
    { workout_exercise_id: 'wex1', workout_id: 'w1', user_id: USER, name: 'Bench Press', measure: 'weight_reps', set_count: 3, total_reps: 28, volume_grams: 2200000, total_seconds: 0, total_metres: 0, best_weight_grams: 80000, best_reps: 10 },
    // Plank carries real minutes and a deliberate zero volume: weight × reps
    // does not apply, so it must not invent kilograms.
    { workout_exercise_id: 'wex2', workout_id: 'w1', user_id: USER, name: 'Plank', measure: 'duration', set_count: 1, total_reps: 0, volume_grams: 0, total_seconds: 120, total_metres: 0, best_weight_grams: null, best_reps: null },
  ],
  workout_totals: [
    { workout_id: 'w1', user_id: USER, workout_date: day(0), completed: true, exercise_count: 5, set_count: 16, total_reps: 142, volume_grams: 8420000, total_seconds: 120, total_metres: 0, duration_minutes: 78 },
  ],
  exercise_records: [
    { user_id: USER, key: 'bench press', name: 'Bench Press', best_weight_grams: 80000, best_reps: 10, best_volume_grams: 2200000, last_done: day(0) },
  ],
  workout_exercises: [
    { id: 'wex1', workout_id: 'w1', user_id: USER, name: 'Bench Press', sets: 3, reps: 10, weight_kg: 80, measure: 'weight_reps', routine_exercise_id: null, notes: null, order_index: 0 },
    { id: 'wex2', workout_id: 'w1', user_id: USER, name: 'Plank', sets: 2, reps: 0, weight_kg: 0, measure: 'duration', routine_exercise_id: null, notes: null, order_index: 1 },
  ],
  // PostgREST returns the embed inline, so the fixture has to as well: the page
  // reads workout.workout_exercises, and an absent key is not an empty list.
  workouts: [
    {
      id: 'w1',
      user_id: USER,
      occurrence_id: null,
      habit_id: null,
      routine_id: 'ro1',
      started_at: '2026-08-13T01:00:00Z',
      ended_at: null,
      workout_date: day(0),
      duration_minutes: 78,
      notes: null,
      completed: true,
      created_at: '',
      workout_exercises: [
        { id: 'wex1', workout_id: 'w1', user_id: USER, name: 'Bench Press', sets: 3, reps: 10, weight_kg: 80, measure: 'weight_reps', routine_exercise_id: null, notes: null, order_index: 0 },
        { id: 'wex2', workout_id: 'w1', user_id: USER, name: 'Plank', sets: 2, reps: 0, weight_kg: 0, measure: 'duration', routine_exercise_id: null, notes: null, order_index: 1 },
      ],
    },
  ],
  notification_preferences: [{ user_id: USER }],
  /*
    These were empty, which meant every schedule surface — Home's Today card,
    the Schedule screen, all three calendar views — rendered its empty state
    and nothing else. A harness that only ever photographs empty states cannot
    catch a layout bug in a full one.

    Four To Dos: a daily one, a weekday one, a weekend one, and an archived one
    that must appear only behind "Show archived".
  */
  habits: [
    { id: 'h1', user_id: USER, name: 'Drink Water', description: '8 glasses', icon: 'droplet', category: 'general', archived: false, created_at: '' },
    { id: 'h2', user_id: USER, name: 'Gym', description: null, icon: 'dumbbell', category: 'gym', archived: false, created_at: '' },
    { id: 'h3', user_id: USER, name: 'Read 20 Pages', description: 'Before bed', icon: 'book', category: 'general', archived: false, created_at: '' },
    { id: 'h4', user_id: USER, name: 'Old Morning Run', description: null, icon: 'star', category: 'general', archived: true, created_at: '' },
  ],
  habit_schedules: [
    { id: 'hs1', habit_id: 'h1', user_id: USER, recurrence: 'daily', weekdays: null, time: '08:00', start_date: day(-60), end_date: null, reminder_enabled: true, supersedes_schedule_id: null, created_at: '' },
    { id: 'hs2', habit_id: 'h2', user_id: USER, recurrence: 'weekly', weekdays: [1, 3, 5], time: '18:30', start_date: day(-60), end_date: null, reminder_enabled: true, supersedes_schedule_id: null, created_at: '' },
    { id: 'hs3', habit_id: 'h3', user_id: USER, recurrence: 'weekly', weekdays: [0, 6], time: null, start_date: day(-60), end_date: null, reminder_enabled: false, supersedes_schedule_id: null, created_at: '' },
    { id: 'hs4', habit_id: 'h4', user_id: USER, recurrence: 'daily', weekdays: null, time: '06:00', start_date: day(-90), end_date: null, reminder_enabled: false, supersedes_schedule_id: null, created_at: '' },
  ],
  /* One marked done today, so the progress bar is not sitting at zero. */
  habit_occurrences: [
    { id: 'ho1', habit_id: 'h1', schedule_id: 'hs1', user_id: USER, occurrence_date: day(0), scheduled_time: '08:00', status: 'done', completed_at: null, notes: null },
  ],
  category_budgets: [],
}

// Functions, not tables. Keyed by name so a screen that leans on one gets a
// realistic answer instead of null.
const RPC_FIXTURES = {
  previous_exercise_sets: (body) =>
    String(body?.p_name ?? '').toLowerCase() === 'plank'
      ? [
          { set_number: 1, weight_grams: null, reps: null, duration_seconds: 105, distance_metres: null, workout_date: day(-3) },
          { set_number: 2, weight_grams: null, reps: null, duration_seconds: 90, distance_metres: null, workout_date: day(-3) },
        ]
      : [
          { set_number: 1, weight_grams: 77500, reps: 10, duration_seconds: null, distance_metres: null, workout_date: day(-3) },
          { set_number: 2, weight_grams: 77500, reps: 9, duration_seconds: null, distance_metres: null, workout_date: day(-3) },
          { set_number: 3, weight_grams: 75000, reps: 8, duration_seconds: null, distance_metres: null, workout_date: day(-3) },
        ],
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const server = await serve(4599)
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

  const shots = []

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme,
    })

    // Answer PostgREST and auth without a network.
    await context.route(`${SUPA}/**`, async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/auth/v1')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
      }
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = url.pathname.replace('/rest/v1/rpc/', '')
        const rpc = RPC_FIXTURES[fn]
        let body = null
        if (typeof rpc === 'function') {
          let payload = {}
          try {
            payload = JSON.parse(route.request().postData() ?? '{}')
          } catch {
            payload = {}
          }
          body = rpc(payload)
        } else if (rpc) {
          body = rpc
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        })
      }
      const table = url.pathname.replace('/rest/v1/', '')
      const rows =
        table === 'user_preferences' ? [{ user_id: USER, theme }] : FIXTURES[table] ?? []
      const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(single ? rows[0] ?? null : rows),
      })
    })

    await context.addInitScript(
      ({ project, user, theme }) => {
        const token = {
          access_token: 'fake',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'fake',
          user: {
            id: user,
            aud: 'authenticated',
            role: 'authenticated',
            email: 'ehjay@betterme.local',
            app_metadata: {},
            user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
          },
        }
        localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify(token))
        localStorage.setItem('betterme:theme-preference', theme)
        // Skip the PIN gate so the harness lands on real screens.
        localStorage.setItem('bm-lock-unlocked', '1')
      },
      { project: PROJECT, user: USER, theme },
    )

    const page = await context.newPage()

    // Runtime errors are the thing this harness is really for. A screen can
    // look fine in a screenshot while a handler throws on every render.
    const problems = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`)
    })
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))

    const screens = [
      ['home', '/'],
      ['finance', '/finance'],
      ['expenses', '/finance/expenses'],
      ['transfers', '/finance/transfers'],
      ['edit-expenses', '/finance/expenses/edit'],
      ['add-transfer', '/finance/transfers/new'],
      ['savings-new', '/savings/new'],
      ['calendar', '/calendar'],
      ['schedule', '/habits'],
      ['savings', '/savings'],
      ['savings-goal', '/savings/s1'],
      ['savings-goal-edit', '/savings/s2/edit'],
      ['gym-workout', '/gym'],
      ['gym-programs', '/gym/programs'],
      ['gym-routine', '/gym/routines/ro1'],
      ['gym-summary', `/gym/${day(0)}/summary`],
      ['gym-share', `/gym/${day(0)}/share`],
      ['profile', '/profile'],
      ['profile-motivation', '/profile/motivation'],
      ['profile-home-screen', '/profile/home-screen'],
      ['profile-appearance', '/profile/appearance'],
      ['profile-data', '/profile/data'],
      ['profile-notifications', '/profile/notifications'],
      ['profile-security', '/profile/security'],
    ]

    const shoot = async (name, file) => {
      await page.screenshot({ path: file, fullPage: true })
      shots.push(file)
      if (problems.length) {
        console.error(`\n!! ${theme}/${name}`)
        for (const p of problems) console.error(`   ${p}`)
        problems.length = 0
      }
    }

    for (const [name, route] of screens) {
      await page.goto(`http://localhost:4599${route}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(900)
      await shoot(name, path.join(OUT, `${theme}-${name}.png`))
    }

    /*
      Week, Year and the To Dos tab are states rather than routes. Drive them
      the way a person would, so a regression in any of the three shows up in
      a picture instead of only in a type error.
    */
    await page.goto('http://localhost:4599/calendar', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.getByRole('tab', { name: 'Week' }).click()
    await page.waitForTimeout(700)
    await shoot('calendar-week', path.join(OUT, `${theme}-calendar-week.png`))

    await page.getByRole('tab', { name: 'Year' }).click()
    await page.waitForTimeout(700)
    await shoot('calendar-year', path.join(OUT, `${theme}-calendar-year.png`))

    await page.goto('http://localhost:4599/habits', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.getByRole('tab', { name: 'To Dos' }).click()
    await page.waitForTimeout(500)
    await shoot('schedule-todos', path.join(OUT, `${theme}-schedule-todos.png`))

    // The Add transaction sheet has no route of its own: it opens from the nav
    // plus while inside Finance. Drive it the way a person would.
    await page.goto('http://localhost:4599/finance', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForTimeout(600)
    // A few taps so the amount is not sitting at zero in the shot.
    for (const key of ['1', '2', '3', '4', '5']) {
      await page.getByRole('button', { name: key, exact: true }).click()
    }
    await page.waitForTimeout(300)
    await shoot('tx-expense', path.join(OUT, `${theme}-tx-expense.png`))

    await page.getByRole('tab', { name: 'Transfer' }).click()
    await page.waitForTimeout(400)
    await shoot('tx-transfer', path.join(OUT, `${theme}-tx-transfer.png`))

    await context.close()
  }

  await browser.close()
  server.close()
  console.log(shots.join('\n'))
}

main()
