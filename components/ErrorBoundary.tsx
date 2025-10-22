import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center text-center p-4">
            <div className="bg-container-bg border border-border-color rounded-lg shadow-xl p-8 max-w-lg animate-fade-in-up">
                 <svg className="h-16 w-16 text-red-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <h1 className="text-2xl font-semibold text-slate-100 mt-4">Something went wrong.</h1>
                <p className="text-slate-400 mt-2">
                    An unexpected error occurred. Please try reloading the page. If the problem persists, contact support.
                </p>
                <button
                    onClick={this.handleReload}
                    className="mt-6 px-4 py-2 text-sm font-medium text-white bg-brand-accent/80 rounded-md hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent"
                >
                    Reload Page
                </button>
                 {this.state.error && (
                    <pre className="mt-4 text-left bg-slate-900/50 p-3 rounded-md text-xs text-red-400 max-h-40 overflow-auto">
                        {this.state.error.name}: {this.state.error.message}
                    </pre>
                )}
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
