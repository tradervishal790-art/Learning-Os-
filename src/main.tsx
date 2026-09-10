import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import AuthGate from './AuthGate.tsx'
import { LanguageProvider } from './i18n/LanguageContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)
