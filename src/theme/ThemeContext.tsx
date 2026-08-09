import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemePreference } from '@/types/models'
import { useAuth } from '@/features/auth/AuthContext'
import { getUserPreferences, updateThemePreference } from '@/services/preferences'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setPreference: (pref: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const LOCAL_KEY = 'betterme:theme-preference'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => (localStorage.getItem(LOCAL_KEY) as ThemePreference) || 'system',
  )
  const [systemDark, setSystemDark] = useState(systemPrefersDark())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!userId) return
    getUserPreferences(userId).then((prefs) => {
      if (prefs?.theme) {
        setPreferenceState(prefs.theme)
        localStorage.setItem(LOCAL_KEY, prefs.theme)
      }
    })
  }, [userId])

  const resolvedTheme: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  const setPreference = async (pref: ThemePreference) => {
    setPreferenceState(pref)
    localStorage.setItem(LOCAL_KEY, pref)
    if (userId) await updateThemePreference(userId, pref)
  }

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme, userId])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
