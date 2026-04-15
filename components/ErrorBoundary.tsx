// components/ErrorBoundary.tsx

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import React from 'react';
import { Sentry } from '../lib/sentry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.moduleName ? `: ${this.props.moduleName}` : ''}]`,
      error,
      errorInfo,
    );
    Sentry.captureException(error, {
      tags: { module: this.props.moduleName ?? 'unknown' },
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState((prev) => ({ hasError: false, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const name = this.props.moduleName || 'ce module';

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-amber-500" size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Une erreur est survenue dans {name}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Veuillez réessayer ou revenir au tableau de bord.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Réessayer
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition-all flex items-center gap-2"
              >
                <Home size={14} />
                Tableau de bord
              </a>
            </div>
          </div>
        </div>
      );
    }

    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
