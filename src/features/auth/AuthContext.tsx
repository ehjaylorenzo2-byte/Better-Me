import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getProfileIdentity } from '@/services/auth'

interface AuthContextValue {
  session: Session | null
  userId: string | null
  /** Login identifier. Unique, lowercase-normalised. */
  username: string | null
  /** Free-form name shown in the UI. Falls back to the username. */
  displayName: string | null
  loading: boolean
  refreshUsername: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setUsername(null)
        setDisplayName(null)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    let mounted = true
    getProfileIdentity(session.user.id).then((identity) => {
      if (!mounted || !identity) return
      setUsername(identity.username)
      setDisplayName(identity.displayName)
    })
    return () => {
      mounted = false
    }
  }, [session?.user?.id])

  const refreshUsername = async () => {
    if (!session?.user?.id) return
    const identity = await getProfileIdentity(session.user.id)
    if (!identity) return
    setUsername(identity.username)
    setDisplayName(identity.displayName)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      username,
      displayName,
      loading,
      refreshUsername,
    }),
    [session, username, displayName, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
