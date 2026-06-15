import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Something went wrong</h3>
            <p className="text-sm text-gray-500">{this.state.message}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="btn-primary"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
