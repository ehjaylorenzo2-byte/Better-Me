import { useNavigate } from 'react-router-dom'
import { LogoWordmark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'

export function SplashPage() {
  const navigate = useNavigate()
  return (
    <div className="bm-splash" data-theme="dark">
      <div className="bm-splash-center">
        <LogoWordmark size={96} />
        <p className="bm-splash-tagline">Build better habits.
          <br />
          Live a better life.
        </p>
      </div>
      <div className="bm-splash-actions">
        <Button fullWidth onClick={() => navigate('/register')}>
          Create your account
        </Button>
        <Button fullWidth variant="secondary" onClick={() => navigate('/login')}>
          Log in
        </Button>
      </div>
    </div>
  )
}
