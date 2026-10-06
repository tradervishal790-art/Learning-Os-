import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import AuthGate from './AuthGate.tsx'
import { LanguageProvider } from './i18n/LanguageContext.tsx'
import CacheWarmup from './cacheWarmup.tsx'

// Live Test join page is public (participants have no account) — it must
// render outside the login gate and the dashboard app.
const LiveJoin = lazy(() => import('./LiveJoin.tsx'))
// Focus Player: standalone distraction-free player (login required, so it sits inside AuthGate).
const FocusPlayer = lazy(() => import('./FocusPlayer.tsx'))

function Root() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/live/')) {
    return (
      <Suspense fallback={null}>
        <LiveJoin />
      </Suspense>
    )
  }
  if (pathname.startsWith('/focus')) {
    return (
      <AuthGate>
        <Suspense fallback={null}>
          <FocusPlayer />
        </Suspense>
      </AuthGate>
    )
  }
  return (
    <AuthGate>
      <CacheWarmup />
      <App />
    </AuthGate>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <Root />
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
