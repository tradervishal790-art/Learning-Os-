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

// A tab can retain old Vite chunk URLs after a deployment. If a lazy import
// fails, reload once to fetch the current index.html and asset manifest. The
// timestamp expires after 30 seconds so a later, unrelated deploy can recover
// too; a genuinely missing chunk cannot trigger an endless reload loop.
const CHUNK_RELOAD_KEY = 'learning_os_chunk_reload';
const CHUNK_RELOAD_WINDOW_MS = 30_000;

window.addEventListener('vite:preloadError', (event) => {
  try {
    const previousAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
    if (Number.isFinite(previousAttempt) && Date.now() - previousAttempt < CHUNK_RELOAD_WINDOW_MS) {
      return; // A retry already happened recently: let ErrorBoundary show the failure.
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return; // Storage unavailable: avoid an unguarded reload loop.
  }
  event.preventDefault();
  window.location.reload();
});

// Remove an expired retry marker on startup. This keeps recovery available
// for future deployments without clearing user data or other session state.
try {
  const previousAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
  if (!Number.isFinite(previousAttempt) || Date.now() - previousAttempt >= CHUNK_RELOAD_WINDOW_MS) {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }
} catch {
  // Session storage is optional; normal application startup must continue.
}

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
