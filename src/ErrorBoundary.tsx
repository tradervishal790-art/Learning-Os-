import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Root-level safety net. Without this, ANY uncaught render error anywhere
// in the tree (a bad cached localStorage shape, an unexpected API field,
// etc.) unmounts the whole app with no fallback — a totally black/blank
// screen and no way to recover except manually clearing storage. This
// catches that, shows a recoverable screen instead, and gives an easy way
// to clear local data (the most common actual cause — stale cached
// data from before a schema change) without needing devtools.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Learning OS crashed:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  handleClearData = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold mb-2">Kuch galat ho gaya</h1>
            <p className="text-sm text-gray-500 dark:text-white/60 mb-6">
              App mein ek error aa gaya. Reload try karo — agar problem rahe toh local data clear karke reload karo (progress/roadmap wapas nahi milega, isliye pehle sirf reload try karo).
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-medium"
              >
                Reload
              </button>
              <button
                onClick={this.handleClearData}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium text-gray-500 dark:text-white/60"
              >
                Local data clear karke reload karo
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
