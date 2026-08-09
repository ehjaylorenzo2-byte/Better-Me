import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/Sheet'
import { useAuth } from '@/features/auth/AuthContext'
import { useLock } from '@/features/lock/LockContext'
import {
  clearBiometric,
  clearPin,
  isBiometricEnabled,
  isBiometricSupported,
  isPinSet,
  registerBiometric,
  setPin as savePin,
  validatePinFormat,
} from '@/features/lock/appLock'
import './profile.css'

export function AppLockSettingsPage() {
  const { username } = useAuth()
  const { refreshLockConfig } = useLock()
  const { show } = useToast()

  const [pinExists, setPinExists] = useState(isPinSet())
  const [bioSupported, setBioSupported] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(isBiometricEnabled())

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    isBiometricSupported().then(setBioSupported)
  }, [])

  const onSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    const check = validatePinFormat(pin)
    if (!check.valid) {
      setError(check.error ?? 'Invalid PIN.')
      return
    }
    if (pin !== confirmPin) {
      setError('The two PINs do not match.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await savePin(pin)
      setPin('')
      setConfirmPin('')
      setPinExists(true)
      refreshLockConfig()
      show('PIN set. You will use it next time you open the app.', 'success')
    } catch {
      setError('Could not save the PIN on this device.')
    } finally {
      setSaving(false)
    }
  }

  const onRemove = () => {
    clearPin()
    setPinExists(false)
    setBioEnabled(false)
    refreshLockConfig()
    setConfirmRemove(false)
    show('App lock removed.', 'success')
  }

  const onEnableBiometric = async () => {
    const result = await registerBiometric(username ?? 'Better Me user')
    if (result.success) {
      setBioEnabled(true)
      show('Biometric unlock enabled on this device.', 'success')
    } else {
      show(result.error ?? 'Could not enable biometrics.', 'error')
    }
  }

  const onDisableBiometric = () => {
    clearBiometric()
    setBioEnabled(false)
    show('Biometric unlock turned off on this device.', 'success')
  }

  return (
    <div>
      <PageHeader title="App Lock" />

      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Set a PIN so you can open Better Me without typing your password every time. You stay signed in;
          the PIN just unlocks the app on this device.
        </p>
      </Card>

      {!pinExists ? (
        <form className="bm-form" onSubmit={onSavePin}>
          {error ? <div className="bm-auth-error">{error}</div> : null}
          <Input
            label="New PIN (4 to 6 digits)"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Input
            label="Confirm PIN"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Button type="submit" fullWidth loading={saving}>
            Set PIN
          </Button>
        </form>
      ) : (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div className="bm-toggle-row">
              <span>PIN unlock</span>
              <span className="bm-badge bm-badge-done">On</span>
            </div>
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <div className="bm-toggle-row" style={{ borderBottom: 'none' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>Face ID / Fingerprint</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {bioSupported ? 'Unlock without typing your PIN.' : 'Not available on this device or browser.'}
                </p>
              </div>
            </div>
            {bioSupported ? (
              bioEnabled ? (
                <Button variant="secondary" fullWidth onClick={onDisableBiometric} style={{ marginTop: 10 }}>
                  Turn off on this device
                </Button>
              ) : (
                <Button fullWidth onClick={onEnableBiometric} style={{ marginTop: 10 }}>
                  Enable Face ID / Fingerprint
                </Button>
              )
            ) : null}
          </Card>

          <button className="bm-btn bm-btn-danger bm-btn-full" onClick={() => setConfirmRemove(true)}>
            Remove App Lock
          </button>
        </>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 18, lineHeight: 1.6 }}>
        Your PIN is never stored, only a salted hash of it, and it never leaves this device. This lock stops
        someone casually picking up your phone. It is not a replacement for your password, and it does not
        change how your data is protected from other users on the server.
      </p>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove app lock?"
        message="You will go back to signing in with your username and password each time."
        confirmLabel="Remove"
        danger
        onConfirm={onRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}
