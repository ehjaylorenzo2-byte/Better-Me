import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from '@/features/auth/AuthContext'
import { LockProvider } from '@/features/lock/LockContext'
import { ThemeProvider } from '@/theme/ThemeContext'
import { ToastProvider } from '@/components/ui/Toast'
import './styles/global.css'

// Register the PWA service worker (installable app + push notification support).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LockProvider>
          <ThemeProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ThemeProvider>
        </LockProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
