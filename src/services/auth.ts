import { supabase, usernameToAuthAlias, normalizeUsername, validateUsername, validatePassword } from '@/lib/supabase'

export interface AuthResult {
  success: boolean
  error?: string
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
    return { success: false, error: 'That username is already taken.' }
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
    if (/already registered|already exists/i.test(error.message)) {
      return { success: false, error: 'That username is already taken.' }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function login(rawUsername: string, password: string): Promise<AuthResult> {
  if (!rawUsername.trim()) return { success: false, error: 'Enter your username.' }
  if (!password) return { success: false, error: 'Enter your password.' }

  const alias = usernameToAuthAlias(normalizeUsername(rawUsername))
  const { error } = await supabase.auth.signInWithPassword({ email: alias, password })

  if (error) {
    return { success: false, error: 'Incorrect username or password.' }
  }
  return { success: true }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getCurrentUsername(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('username').eq('id', userId).single()
  if (error || !data) return null
  return data.username
}
