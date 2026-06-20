import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { LogoIcon } from './Logo';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Production: send to error tracking service here (Sentry, LogRocket, etc.)
    console.error('PropMaster error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, resetKey: this.state.resetKey + 1 });
  };

  handleGoHome = () => {
    window.location.href = '/app';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <LogoIcon size={48} className="mx-auto mb-4" />
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-ink-900 mb-2">Something went wrong</h1>
              <p className="text-sm text-ink-500 leading-relaxed">
                PropMaster ran into an unexpected error. Your data is safe — please try again or return home.
              </p>
            </div>

            {isDev && this.state.error && (
              <details className="card p-4 mb-4 text-left">
                <summary className="text-xs font-semibold text-ink-600 cursor-pointer">
                  Error details (dev only)
                </summary>
                <pre className="text-2xs text-red-600 mt-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {this.state.error.toString()}
                  {this.state.error.stack && '\n\n' + this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button onClick={this.handleReset} className="btn-primary flex-1">
                <RotateCcw size={15} /> Try again
              </button>
              <button onClick={this.handleGoHome} className="btn-secondary flex-1">
                <Home size={15} /> Go home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}
