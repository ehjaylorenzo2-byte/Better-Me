import { useEffect, useState } from 'react'
import { LogoMark } from '@/components/Logo'
import { useAuth } from '@/features/auth/AuthContext'
import { logout } from '@/services/auth'
import { useLock } from './LockContext'
import { isBiometricEnabled, verifyBiometric, verifyPin } from './appLock'
import './lock.css'

const MAX_ATTEMPTS = 5

export function LockScreen() {
  const { username } = useAuth()
  const { unlock } = useLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [checking, setChecking] = useState(false)
  const biometricAvailable = isBiometricEnabled()

  const tryBiometric = async () => {
    setError(null)
    const result = await verifyBiometric()
    if (result.success) {
      unlock()
    } else {
      setError(result.error ?? 'Biometric unlock failed.')
    }
  }

  // Offer the biometric prompt immediately on open when it's set up.
  useEffect(() => {
    if (biometricAvailable) void tryBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitPin = async (candidate: string) => {
    setChecking(true)
    setError(null)
    try {
      if (await verifyPin(candidate)) {
        unlock()
        return
      }
      const next = attempts + 1
      setAttempts(next)
      setPin('')
      setError(
        next >= MAX_ATTEMPTS
          ? 'Too many wrong attempts. Log in with your password instead.'
          : `Wrong PIN. ${MAX_ATTEMPTS - next} ${MAX_ATTEMPTS - next === 1 ? 'try' : 'tries'} left.`,
      )
    } finally {
      setChecking(false)
    }
  }

  const press = (digit: string) => {
    if (checking || attempts >= MAX_ATTEMPTS) return
    const next = pin + digit
    if (next.length > 6) return
    setPin(next)
    if (next.length >= 4) {
      // Auto-submit at 4; longer PINs still work via the confirm key.
      if (next.length === 6) void submitPin(next)
    }
  }

  const onSignOut = async () => {
    await logout()
    window.location.href = '/login'
  }

  return (
    <div className="bm-lock" data-theme="dark">
      <div className="bm-lock-head">
        <LogoMark size={56} />
        <h1>Welcome back{username ? `, ${username}` : ''}</h1>
        <p>Enter your PIN to unlock.</p>
      </div>

      <div className="bm-lock-dots" aria-label={`${pin.length} of up to 6 digits entered`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`bm-lock-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>

      {error ? (
        <p className="bm-lock-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="bm-lock-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="bm-lock-key" onClick={() => press(d)} disabled={checking}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="bm-lock-key bm-lock-key-soft"
          onClick={() => biometricAvailable && tryBiometric()}
          disabled={!biometricAvailable}
          aria-label="Unlock with biometrics"
        >
          {biometricAvailable ? <FaceIcon /> : ''}
        </button>
        <button type="button" className="bm-lock-key" onClick={() => press('0')} disabled={checking}>
          0
        </button>
        <button
          type="button"
          className="bm-lock-key bm-lock-key-soft"
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label="Delete last digit"
        >
          ⌫
        </button>
      </div>

      <button
        type="button"
        className="bm-lock-confirm"
        onClick={() => void submitPin(pin)}
        disabled={pin.length < 4 || checking || attempts >= MAX_ATTEMPTS}
      >
        {checking ? 'Checking...' : 'Unlock'}
      </button>

      <button type="button" className="bm-lock-signout" onClick={onSignOut}>
        Use password instead
      </button>
    </div>
  )
}

function FaceIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" strokeLinecap="round" />
      <path d="M9 10v1M15 10v1M9.5 15c.7.7 1.6 1 2.5 1s1.8-.3 2.5-1" strokeLinecap="round" />
    </svg>
  )
}
