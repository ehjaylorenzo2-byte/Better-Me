import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isPinSet } from './appLock'

/** Re-lock after this long in the background (ms). */
const BACKGROUND_LOCK_AFTER = 5 * 60 * 1000

interface LockContextValue {
  /** True when a PIN exists and the user has not unlocked this session yet. */
  locked: boolean
  pinConfigured: boolean
  unlock: () => void
  lockNow: () => void
  refreshLockConfig: () => void
}

const LockContext = createContext<LockContextValue | undefined>(undefined)

export function LockProvider({ children }: { children: ReactNode }) {
  const [pinConfigured, setPinConfigured] = useState(() => isPinSet())
  // Start locked whenever a PIN exists, so a fresh page load always challenges.
  const [unlocked, setUnlocked] = useState(() => !isPinSet())
  const [hiddenSince, setHiddenSince] = useState<number | null>(null)

  const unlock = useCallback(() => setUnlocked(true), [])
  const lockNow = useCallback(() => setUnlocked(false), [])

  const refreshLockConfig = useCallback(() => {
    const configured = isPinSet()
    setPinConfigured(configured)
    if (!configured) setUnlocked(true)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setHiddenSince(Date.now())
        return
      }
      setHiddenSince((since) => {
        if (since !== null && Date.now() - since > BACKGROUND_LOCK_AFTER && isPinSet()) {
          setUnlocked(false)
        }
        return null
      })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const value = useMemo<LockContextValue>(
    () => ({
      locked: pinConfigured && !unlocked,
      pinConfigured,
      unlock,
      lockNow,
      refreshLockConfig,
    }),
    [pinConfigured, unlocked, unlock, lockNow, refreshLockConfig],
  )

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext)
  if (!ctx) throw new Error('useLock must be used within LockProvider')
  return ctx
}
