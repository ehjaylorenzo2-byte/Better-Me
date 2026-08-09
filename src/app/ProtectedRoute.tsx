import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LoadingState } from '@/components/ui/States'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState label="Loading Better Me..." />
  if (!session) return <Navigate to="/splash" replace />
  return <>{children}</>
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState label="Loading Better Me..." />
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}
