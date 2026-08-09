import { supabase, usernameToAuthAlias, normalizeUsername, validateUsername, validatePassword } from '@/lib/supabase'

export interface AuthResult {
  success: boolean
  error?: string
  /** Populated when the chosen username is taken, so the UI can offer close alternatives. */
  suggestions?: string[]
}

/**
 * Builds candidate usernames close to what the user typed. Usernames must stay
 * unique because each one maps to a distinct Supabase auth alias, so when one
 * is taken we offer near-misses rather than allowing a duplicate.
 */
export function buildUsernameCandidates(rawUsername: string): string[] {
  const base = normalizeUsername(rawUsername).replace(/[^a-z0-9_.]/g, '')
  if (!base) return []

  const trimmed = base.slice(0, 17) // leave room for a short suffix within the 20-char cap
  const candidates = [
    `${trimmed}1`,
    `${trimmed}2`,
    `${trimmed}_1`,
    `${trimmed}.ph`,
    `${trimmed}x`,
    `${trimmed}07`,
    `the${trimmed}`.slice(0, 20),
    `${trimmed}99`,
    `${trimmed}_me`,
    `real${trimmed}`.slice(0, 20),
  ]

  // De-duplicate, drop anything that fails our own validation rules.
  return [...new Set(candidates)].filter((c) => validateUsername(c).valid)
}

/** Returns up to `count` genuinely-available usernames close to the one requested. */
export async function suggestUsernames(rawUsername: string, count = 3): Promise<string[]> {
  const candidates = buildUsernameCandidates(rawUsername)
  if (candidates.length === 0) return []

  const results = await Promise.all(
    candidates.map(async (c) => ({ name: c, free: await checkUsernameAvailable(c) })),
  )
  return results.filter((r) => r.free).map((r) => r.name).slice(0, count)
}

export async function checkUsernameAvailable(rawUsername: string): Promise<boolean> {
  const normalized = normalizeUsername(rawUsername)
  const { data, error } = await supabase.rpc('is_username_available', { p_username: normalized })
  if (error) return false
  return Boolean(data)
}

export async function registerAccount(
  rawUsername: string,
  password: string,
  confirmPassword: string,
): Promise<AuthResult> {
  const usernameCheck = validateUsername(rawUsername)
  if (!usernameCheck.valid) return { success: false, error: usernameCheck.error }

  const passwordCheck = validatePassword(password)
  if (!passwordCheck.valid) return { success: false, error: passwordCheck.error }

  if (password !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' }
  }

  const normalized = normalizeUsername(rawUsername)
  const available = await checkUsernameAvailable(normalized)
  if (!available) {
    return {
      success: false,
      error: 'That username is already taken.',
      suggestions: await suggestUsernames(normalized),
    }
  }

  const alias = usernameToAuthAlias(normalized)
  const { error } = await supabase.auth.signUp({
    email: alias,
    password,
    options: {
      data: { username: rawUsername.trim() },
    },
  })

  if (error) {
    if (/already registered|already exists|user already/i.test(error.message)) {
      return {
        success: false,
        error: 'That username is already taken.',
        suggestions: await suggestUsernames(normalized),
      }
    }
    return { success: false, error: describeAuthError(error.message) }
  }

  return { success: true }
}

export async function login(rawUsername: string, password: string): Promise<AuthResult> {
  if (!rawUsername.trim()) return { success: false, error: 'Enter your username.' }
  if (!password) return { success: false, error: 'Enter your password.' }

  const alias = usernameToAuthAlias(normalizeUsername(rawUsername))
  const { error } = await supabase.auth.signInWithPassword({ email: alias, password })

  if (error) {
    return { success: false, error: describeAuthError(error.message) }
  }
  return { success: true }
}

/**
 * Surfaces the actual reason a sign-in failed instead of collapsing every
 * failure into one generic string. Hiding the cause makes real setup problems
 * (unconfirmed email, offline, misconfigured project) impossible to diagnose.
 */
export function describeAuthError(message: string): string {
  const m = message.toLowerCase()

  if (m.includes('email not confirmed') || m.includes('not confirmed')) {
    return 'This account still needs email confirmation, which this app does not use. Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > User Signups), then try again.'
  }
  if (m.includes('invalid login credentials')) {
    return 'Incorrect username or password. If you have not registered yet, tap Sign up.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (m.includes('invalid api key') || m.includes('no api key')) {
    return 'The app is misconfigured (bad Supabase key). Check VITE_SUPABASE_ANON_KEY and redeploy.'
  }
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  return message
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getCurrentUsername(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('username').eq('id', userId).single()
  if (error || !data) return null
  return data.username
}
