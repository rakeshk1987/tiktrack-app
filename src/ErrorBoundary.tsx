import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, errorMsg: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMsg: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 p-8 text-slate-100">
          <h1 className="mb-4 text-center text-2xl font-bold">Something went wrong</h1>
          <p className="mb-4 max-w-2xl rounded-xl border border-rose-300/25 bg-rose-500/10 p-4 font-mono text-sm text-rose-100">
            {this.state.errorMsg}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="min-h-[44px] rounded-lg border border-sky-300/35 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100"
            >
              Retry screen
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
