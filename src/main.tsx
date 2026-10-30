import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import AuthGate from './AuthGate.tsx'
import { LanguageProvider } from './i18n/LanguageContext.tsx'
import { AuthPromptProvider } from './AuthPrompt.tsx'
import CacheWarmup from './cacheWarmup.tsx'
import { AppDialogHost } from './appDialogs.tsx'
import { syncServerClock } from './serverClock.ts'

// Live Test join page is public (participants have no account) — it must
// render outside the login gate and the dashboard app.
const LiveJoin = lazy(() => import('./LiveJoin.tsx'))
// Focus Player: standalone distraction-free player (sits inside AuthGate, which gives visitors a guest session if they have none).
const FocusPlayer = lazy(() => import('./FocusPlayer.tsx'))

// After a new deploy, a tab that was already open still points at old hashed chunk
// files that no longer exist, so the next lazy screen (note editor, live test, focus
// player...) fails to load. Vite fires `vite:preloadError` for that. Reload ONCE to pick
// up the new version instead of showing the student a crash screen; the sessionStorage
// guard stops a reload loop if the file is genuinely missing.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('learning_os_chunk_reload')) return;
    sessionStorage.setItem('learning_os_chunk_reload', String(Date.now()));
  } catch {
    return; // can't guard against a loop -> let the error boundary handle it
  }
  event.preventDefault();
  window.location.reload();
});

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

// Correct the notes' "newest wins" timestamps for a wrong device clock (measured against our own server).
void syncServerClock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          {/* Guest -> account prompt (sign-in modal). Wraps everything, including the public /live page. */}
          <AuthPromptProvider>
            <Root />
            {/* In-app confirm / prompt boxes (replace the browser's native ones). */}
            <AppDialogHost />
          </AuthPromptProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
