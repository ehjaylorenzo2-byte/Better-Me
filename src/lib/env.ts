function readEnv(key: string, fallback = ''): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value ?? fallback
}

export const env = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  authAliasDomain: readEnv('VITE_AUTH_ALIAS_DOMAIN', 'betterme.local'),
  vapidPublicKey: readEnv('VITE_VAPID_PUBLIC_KEY'),
  appTimezone: readEnv('VITE_APP_TIMEZONE', 'Asia/Manila'),
}

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
