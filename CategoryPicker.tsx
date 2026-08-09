import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'
import { Input, PasswordInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { registerAccount, login } from '@/services/auth'
import './auth.css'

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuggestions([])
    setLoading(true)
    try {
      const result = await registerAccount(username, password, confirm)
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.')
        setSuggestions(result.suggestions ?? [])
        return
      }
      // Private app, no email confirmation flow: log the user straight in.
      const loginResult = await login(username, password)
      if (!loginResult.success) {
        setError('Account created. Please log in.')
        navigate('/login')
        return
      }
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bm-auth-page" data-theme="dark">
      <div className="bm-auth-header">
        <LogoMark size={64} />
        <h1>Create your account</h1>
        <p>Start your journey to a better you.</p>
      </div>

      <form className="bm-auth-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <Input
          label="Choose a username"
          placeholder="Enter username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (suggestions.length) setSuggestions([])
          }}
          autoCapitalize="none"
          autoCorrect="off"
          required
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
                    setUsername(s)
                    setSuggestions([])
                    setError(null)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <PasswordInput
          label="Password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordInput
          label="Confirm Password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" fullWidth loading={loading}>
          Create Account
        </Button>
      </form>

      <div className="bm-auth-footer">
        Already have an account? <Link to="/login">Log In</Link>
      </div>
    </div>
  )
}
