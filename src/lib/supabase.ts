import { createClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from './env'
import type { Database } from '@/types/database'

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Better Me] Supabase is not configured. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY before using the app.',
  )
}

export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)

/**
 * Builds the deterministic internal auth alias Supabase Auth uses under the
 * hood, from a normalized username. Never displayed to the user.
 */
export function usernameToAuthAlias(normalizedUsername: string): string {
  return `${normalizedUsername}@${env.authAliasDomain}`
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/

export function validateUsername(raw: string): { valid: boolean; error?: string } {
  const normalized = normalizeUsername(raw)
  if (!normalized) return { valid: false, error: 'Username is required.' }
  if (normalized.length < 3) return { valid: false, error: 'Username must be at least 3 characters.' }
  if (normalized.length > 20) return { valid: false, error: 'Username must be 20 characters or fewer.' }
  if (!USERNAME_PATTERN.test(normalized)) {
    return { valid: false, error: 'Use only letters, numbers, dots, and underscores.' }
  }
  return { valid: true }
}

export function validatePassword(raw: string): { valid: boolean; error?: string } {
  if (!raw) return { valid: false, error: 'Password is required.' }
  if (raw.length < 8) return { valid: false, error: 'Password must be at least 8 characters.' }
  return { valid: true }
}
