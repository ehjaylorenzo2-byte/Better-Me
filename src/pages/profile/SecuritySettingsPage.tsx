import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, PasswordInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase, validatePassword } from '@/lib/supabase'
import { changeUsername, getRecoveryEmail, updateRecoveryEmail } from '@/services/auth'
import { deleteMyAccount } from '@/services/reset'
import './profile.css'
import '../auth/auth.css'

export function SecuritySettingsPage() {
  const { show } = useToast()
  const { userId, username, refreshUsername } = useAuth()
  const navigate = useNavigate()

  // --- recovery email ---
  const [recovery, setRecovery] = useState('')
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [savingRecovery, setSavingRecovery] = useState(false)

  // --- delete account ---
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [typedDelete, setTypedDelete] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!userId) return
    getRecoveryEmail(userId).then(setRecovery)
  }, [userId])

  // --- username ---
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [savingUsername, setSavingUsername] = useState(false)

  // --- password ---
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const onChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setUsernameError(null)
    setSuggestions([])
    setSavingUsername(true)
    try {
      const result = await changeUsername(userId, newUsername)
      if (!result.success) {
        setUsernameError(result.error ?? 'Could not change your username.')
        setSuggestions(result.suggestions ?? [])
        return
      }
      await refreshUsername()
      setNewUsername('')
      show('Username updated. Use it next time you log in.', 'success')
    } finally {
      setSavingUsername(false)
    }
  }

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const check = validatePassword(newPassword)
    if (!check.valid) {
      setPasswordError(check.error ?? 'Invalid password.')
      return
    }
    if (newPassword !== confirm) {
      setPasswordError('Passwords do not match.')
      return
    }
    setSavingPassword(true)
    setPasswordError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      show('Password updated.', 'success')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setSavingPassword(false)
    }
  }

  const onSaveRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSavingRecovery(true)
    setRecoveryError(null)
    try {
      const result = await updateRecoveryEmail(userId, recovery)
      if (!result.success) {
        setRecoveryError(result.error ?? 'Could not save that.')
        return
      }
      show(recovery.trim() ? 'Recovery email saved.' : 'Recovery email removed.', 'success')
    } finally {
      setSavingRecovery(false)
    }
  }

  const onDeleteAccount = async () => {
    setDeleting(true)
    try {
      await deleteMyAccount()
      navigate('/splash')
    } catch (err) {
      setDeleting(false)
      show(err instanceof Error ? err.message : 'Could not delete the account.', 'error')
    }
  }

  return (
    <div className="bm-enter">
      <PageHeader title="Security / Account" />

      {/* ---------------- Username ---------------- */}
      <Card style={{ marginBottom: 16 }}>
        <h2 className="bm-section-title">Login username</h2>
        <p className="bm-settings-note">
          You log in as <strong>{username ?? '...'}</strong>. Changing this changes what you type to log in,
          on every device. To change the name the app displays instead, use Edit Name on your profile.
        </p>

        <form className="bm-form" onSubmit={onChangeUsername} style={{ marginTop: 14 }}>
          {usernameError ? <div className="bm-auth-error">{usernameError}</div> : null}

          <Input
            label="New username"
            placeholder="Enter a new username"
            value={newUsername}
            onChange={(e) => {
              setNewUsername(e.target.value)
              if (suggestions.length) setSuggestions([])
            }}
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={20}
          />

          {suggestions.length > 0 ? (
            <div className="bm-suggestions">
              <p className="bm-suggestions-label">These are free. Tap one to use it:</p>
              <div className="bm-suggestions-row">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="bm-suggestion-chip"
                    onClick={() => {
                      setNewUsername(s)
                      setSuggestions([])
                      setUsernameError(null)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Button type="submit" fullWidth loading={savingUsername} disabled={!newUsername.trim()}>
            Change Username
          </Button>
        </form>
      </Card>

      {/* ---------------- Password ---------------- */}
      <Card style={{ marginBottom: 16 }}>
        <h2 className="bm-section-title">Password</h2>
        <form className="bm-form" onSubmit={onChangePassword}>
          {passwordError ? <div className="bm-auth-error">{passwordError}</div> : null}
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <Button type="submit" fullWidth loading={savingPassword}>
            Update Password
          </Button>
        </form>
      </Card>

      {/* ---------------- Recovery email ---------------- */}
      <Card style={{ marginBottom: 16 }}>
        <h2 className="bm-section-title">Recovery email</h2>
        <p className="bm-settings-note">
          Optional. Better Me signs you in with a username and password, so there is nothing to verify
          here. Adding an address just means there is a way to identify your account if you ever forget
          your password. Leave it blank to keep it off.
        </p>
        <form className="bm-form" onSubmit={onSaveRecovery} style={{ marginTop: 14 }}>
          {recoveryError ? <div className="bm-auth-error">{recoveryError}</div> : null}
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={recovery}
            onChange={(e) => setRecovery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={254}
          />
          <Button type="submit" fullWidth variant="secondary" loading={savingRecovery}>
            Save Recovery Email
          </Button>
        </form>
      </Card>

      {/* ---------------- Delete account ---------------- */}
      <Card style={{ marginBottom: 16 }}>
        <h2 className="bm-section-title">Delete account</h2>
        <p className="bm-settings-note">
          Closes the account for good and removes everything with it, including your login. This is not
          the same as Reset Everything, which clears your records but keeps you signed up. There is no
          way to bring a deleted account back.
        </p>
        <button
          className="bm-btn bm-btn-danger bm-btn-full bm-press"
          onClick={() => {
            setTypedDelete('')
            setDeleteOpen(true)
          }}
          style={{ marginTop: 12 }}
        >
          Delete My Account
        </button>
      </Card>

      <p className="bm-settings-footnote">
        Your account is private to you. Better Me never shares your data with other users, and every other
        account is blocked from reading it at the database level.
      </p>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account?">
        <p className="bm-confirm-message">
          Your habits, workouts, wallets, savings, debts and history all go, and so does your login.
          Type <strong>DELETE</strong> to confirm.
        </p>
        <Input
          label="Type DELETE"
          value={typedDelete}
          onChange={(e) => setTypedDelete(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder="DELETE"
        />
        <div className="bm-confirm-actions" style={{ marginTop: 12 }}>
          <button className="bm-btn bm-btn-secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </button>
          <Button
            variant="danger"
            loading={deleting}
            disabled={typedDelete.trim() !== 'DELETE'}
            onClick={onDeleteAccount}
          >
            Delete Account
          </Button>
        </div>
      </Modal>
    </div>
  )
}
