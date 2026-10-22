import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getStaticTranslation } from './i18n/LanguageContext';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  confirmingClear: boolean;
}

// Root-level safety net. Without this, ANY uncaught render error anywhere
// in the tree (a bad cached localStorage shape, an unexpected API field,
// etc.) unmounts the whole app with no fallback — a totally black/blank
// screen and no way to recover except manually clearing storage. This
// catches that, shows a recoverable screen instead, and gives an easy way
// to clear local data (the most common actual cause — stale cached
// data from before a schema change) without needing devtools.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, confirmingClear: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Learning OS crashed:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  // Wiping is a two-step action (warn -> confirm): a crash screen is exactly when a
  // student is stressed and most likely to tap the wrong button, and localStorage holds
  // things that exist nowhere else (daily-test bank, notes index, revision progress).
  handleAskClear = () => this.setState({ confirmingClear: true });
  handleCancelClear = () => this.setState({ confirmingClear: false });

  /** Downloads every localStorage entry as a JSON file, so nothing is lost for good. */
  handleSaveCopy = () => {
    try {
      const dump: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) dump[k] = localStorage.getItem(k);
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `learning-os-local-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Could not save a copy of local data:', err);
    }
  };

  handleClearData = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const t = getStaticTranslation();
      return (
        <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold mb-2">{t.errorBoundary.title}</h1>
            <p className="text-sm text-gray-500 dark:text-white/60 mb-6">
              {t.errorBoundary.body}
            </p>
            {this.state.confirmingClear ? (
              <div className="flex flex-col gap-2 text-left">
                <p className="text-sm text-black/70 dark:text-white/70 mb-1">{t.errorBoundary.clearWarn}</p>
                <button
                  onClick={this.handleSaveCopy}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium"
                >
                  {t.errorBoundary.saveCopyCta}
                </button>
                <button
                  onClick={this.handleClearData}
                  className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium"
                >
                  {t.errorBoundary.clearConfirmCta}
                </button>
                <button
                  onClick={this.handleCancelClear}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60"
                >
                  {t.errorBoundary.cancelCta}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white text-sm font-medium"
                >
                  {t.errorBoundary.reloadCta}
                </button>
                <button
                  onClick={this.handleAskClear}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium text-gray-500 dark:text-white/60"
                >
                  {t.errorBoundary.clearDataCta}
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
