import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PasswordInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { validatePassword } from '@/lib/supabase'
import './profile.css'

export function SecuritySettingsPage() {
  const { show } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const check = validatePassword(newPassword)
    if (!check.valid) {
      setError(check.error ?? 'Invalid password.')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      show('Password updated.', 'success')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Security" />
      <form className="bm-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <PasswordInput label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <PasswordInput label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" fullWidth loading={saving}>
          Update Password
        </Button>
      </form>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 16 }}>
        Your account is private to you. Better Me never shares your data with other users.
      </p>
    </div>
  )
}
