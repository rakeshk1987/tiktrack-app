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

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 h-screen w-screen flex flex-col items-center justify-center bg-red-50 text-red-800">
          <h1 className="text-2xl font-bold mb-4">React Application Crashed</h1>
          <p className="bg-white p-4 rounded-xl border border-red-200 shadow-sm font-mono text-sm max-w-2xl w-full">
            {this.state.errorMsg}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
