import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'
import { Input, PasswordInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { login } from '@/services/auth'
import './auth.css'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await login(username, password)
      if (!result.success) {
        setError(result.error ?? 'Could not log in.')
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
        <h1>Welcome back!</h1>
        <p>Log in to continue your journey.</p>
      </div>

      <form className="bm-auth-form" onSubmit={onSubmit}>
        {error ? <div className="bm-auth-error">{error}</div> : null}
        <Input
          label="Username"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
        <PasswordInput
          label="Password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" fullWidth loading={loading}>
          Log In
        </Button>
      </form>

      <div className="bm-auth-footer">
        Don't have an account? <Link to="/register">Sign up</Link>
      </div>
    </div>
  )
}
