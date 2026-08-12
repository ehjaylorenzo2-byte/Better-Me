import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TextSize, ThemePreference } from '@/types/models'
import { useAuth } from '@/features/auth/AuthContext'
import { getUserPreferences, updateAppPreferences, updateThemePreference } from '@/services/preferences'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setPreference: (pref: ThemePreference) => Promise<void>
  textSize: TextSize
  setTextSize: (size: TextSize) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const LOCAL_KEY = 'betterme:theme-preference'
/**
 * Mirrored into localStorage for the same reason the theme is: it has to be
 * right on the first paint, before the database has answered. Waiting would
 * show every screen visibly changing size a second after it appeared.
 */
const TEXT_SIZE_KEY = 'betterme:text-size'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => (localStorage.getItem(LOCAL_KEY) as ThemePreference) || 'system',
  )
  const [systemDark, setSystemDark] = useState(systemPrefersDark())
  const [textSize, setTextSizeState] = useState<TextSize>(
    () => (localStorage.getItem(TEXT_SIZE_KEY) as TextSize) || 'medium',
  )

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
      if (prefs?.textSize) {
        setTextSizeState(prefs.textSize)
        localStorage.setItem(TEXT_SIZE_KEY, prefs.textSize)
      }
    })
  }, [userId])

  const resolvedTheme: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', textSize)
  }, [textSize])

  const setPreference = async (pref: ThemePreference) => {
    setPreferenceState(pref)
    localStorage.setItem(LOCAL_KEY, pref)
    if (userId) await updateThemePreference(userId, pref)
  }

  const setTextSize = async (size: TextSize) => {
    setTextSizeState(size)
    localStorage.setItem(TEXT_SIZE_KEY, size)
    if (userId) await updateAppPreferences(userId, { textSize: size })
  }

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, textSize, setTextSize }),
    [preference, resolvedTheme, textSize, userId],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
