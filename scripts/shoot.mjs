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
    { id: 's1', user_id: USER, name: 'Emergency Fund', goal_amount_centavos: 5000000, balance_centavos: 1850000, color: 'teal', icon: 'shield', account_id: ACC.bpi, created_at: '' },
    { id: 's2', user_id: USER, name: 'New Laptop', goal_amount_centavos: 6500000, balance_centavos: 900000, color: 'indigo', icon: 'laptop', account_id: null, created_at: '' },
  ],
  savings_transactions: [
    { id: 'st1', user_id: USER, category_id: 's1', type: 'deposit', amount_centavos: 500000, note: null, counter_account_id: ACC.gcash, created_at: '2026-08-10T08:00:00Z' },
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
  user_preferences: [{ user_id: USER, theme: 'system' }],
  notification_preferences: [{ user_id: USER }],
  habits: [],
  habit_schedules: [],
  habit_occurrences: [],
  category_budgets: [],
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
        return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
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
      ['savings', '/savings'],
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
