import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, PasswordInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase, validatePassword } from '@/lib/supabase'
import { changeUsername } from '@/services/auth'
import './profile.css'
import '../auth/auth.css'

export function SecuritySettingsPage() {
  const { show } = useToast()
  const { userId, username, refreshUsername } = useAuth()

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

  return (
    <div className="bm-enter">
      <PageHeader title="Security / Account" />

      {/* ---------------- Username ---------------- */}
      <Card style={{ marginBottom: 16 }}>
        <h2 className="bm-section-title">Username</h2>
        <p className="bm-settings-note">
          You currently log in as <strong>{username ?? '...'}</strong>. Changing this changes what you type to
          log in, on every device.
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

      <p className="bm-settings-footnote">
        Your account is private to you. Better Me never shares your data with other users, and every other
        account is blocked from reading it at the database level.
      </p>
    </div>
  )
}
