import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { OfflineBanner } from '@/components/ui/States'

export function AppLayout() {
  const online = useOnlineStatus()
  return (
    <div>
      <div className="app-scroll-area">
        <OfflineBanner visible={!online} />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
