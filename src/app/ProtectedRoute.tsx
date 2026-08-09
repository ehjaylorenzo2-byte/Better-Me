import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState } from '@/components/ui/States'
import { useLock } from '@/features/lock/LockContext'
import { LockScreen } from '@/features/lock/LockScreen'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const { locked } = useLock()
  if (loading) return <LoadingState label="Loading Better Me..." />
  if (!session) return <Navigate to="/splash" replace />
  // A PIN/biometric gate in front of an already-authenticated session.
  if (locked) return <LockScreen />
  return <>{children}</>
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState label="Loading Better Me..." />
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}
