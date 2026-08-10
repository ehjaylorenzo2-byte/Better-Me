import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { logout } from '@/services/auth'
import { getAvatarUrl, removeAvatar, uploadAvatar } from '@/services/avatar'
import './profile.css'

export function ProfilePage() {
  const { username, userId } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState(false)

  useEffect(() => {
    if (!userId) return
    getAvatarUrl(userId).then(setAvatarUrl)
  }, [userId])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file || !userId) return

    setUploading(true)
    try {
      const url = await uploadAvatar(userId, file)
      setAvatarUrl(url)
      show('Photo updated.', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not upload that photo.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const onRemovePhoto = async () => {
    if (!userId) return
    setConfirmRemovePhoto(false)
    try {
      await removeAvatar(userId)
      setAvatarUrl(null)
      show('Photo removed.', 'success')
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not remove the photo.', 'error')
    }
  }

  const onLogout = async () => {
    await logout()
    navigate('/splash')
  }

  return (
    <div className="bm-enter">
      <div className="bm-profile-header">
        <div className="bm-avatar-edit">
          <Avatar url={avatarUrl} username={username} size={96} />
          {uploading ? (
            <span className="bm-avatar-uploading">
              <span className="bm-loading-spinner" style={{ width: 22, height: 22 }} />
            </span>
          ) : null}
          <button
            className="bm-avatar-edit-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile photo"
            disabled={uploading}
          >
            <CameraIcon />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPick}
          className="visually-hidden"
        />

        <h1>{username ?? '...'}</h1>
        <p>Asia/Manila (Philippine Time)</p>

        {avatarUrl ? (
          <button className="bm-link" onClick={() => setConfirmRemovePhoto(true)} style={{ fontSize: 12 }}>
            Remove photo
          </button>
        ) : (
          <button className="bm-link" onClick={() => fileRef.current?.click()} style={{ fontSize: 12 }}>
            Add a photo
          </button>
        )}
      </div>

      <div className="bm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card className="bm-press">
          <button className="bm-profile-row" onClick={() => navigate('/profile/appearance')}>
            <span>Appearance</span>
            <ChevronIcon />
          </button>
        </Card>
        <Card className="bm-press">
          <button className="bm-profile-row" onClick={() => navigate('/profile/app-lock')}>
            <span>App Lock (PIN / Face ID)</span>
            <ChevronIcon />
          </button>
        </Card>
        <Card className="bm-press">
          <button className="bm-profile-row" onClick={() => navigate('/profile/notifications')}>
            <span>Notification Settings</span>
            <ChevronIcon />
          </button>
        </Card>
        <Card className="bm-press">
          <button className="bm-profile-row" onClick={() => navigate('/profile/security')}>
            <span>Security / Account</span>
            <ChevronIcon />
          </button>
        </Card>
      </div>

      <button
        className="bm-btn bm-btn-danger bm-btn-full bm-press"
        onClick={() => setConfirmLogout(true)}
        style={{ marginTop: 20 }}
      >
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

      <ConfirmDialog
        open={confirmRemovePhoto}
        title="Remove your photo?"
        message="Your avatar goes back to your initials. You can add a new photo any time."
        confirmLabel="Remove"
        danger
        onConfirm={onRemovePhoto}
        onCancel={() => setConfirmRemovePhoto(false)}
      />
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h3.5L8 5.5h8L17.5 8H21v12H3V8z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
