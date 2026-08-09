import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { LogoMark } from '@/components/Logo'
import { logout } from '@/services/auth'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useState } from 'react'
import './profile.css'

export function ProfilePage() {
  const { username } = useAuth()
  const navigate = useNavigate()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const onLogout = async () => {
    await logout()
    navigate('/splash')
  }

  return (
    <div>
      <div className="bm-profile-header">
        <LogoMark size={56} />
        <h1>{username ?? '...'}</h1>
        <p>Asia/Manila (Philippine Time)</p>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <button className="bm-profile-row" onClick={() => navigate('/profile/appearance')}>
          <span>Appearance</span>
          <ChevronIcon />
        </button>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <button className="bm-profile-row" onClick={() => navigate('/profile/notifications')}>
          <span>Notification Settings</span>
          <ChevronIcon />
        </button>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <button className="bm-profile-row" onClick={() => navigate('/profile/app-lock')}>
          <span>App Lock (PIN / Face ID)</span>
          <ChevronIcon />
        </button>
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <button className="bm-profile-row" onClick={() => navigate('/profile/security')}>
          <span>Security / Account</span>
          <ChevronIcon />
        </button>
      </Card>

      <button className="bm-btn bm-btn-danger bm-btn-full" onClick={() => setConfirmLogout(true)}>
        Log Out
      </button>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You'll need your username and password to log back in."
        confirmLabel="Log Out"
        danger
        onConfirm={onLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
