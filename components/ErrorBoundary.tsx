import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  isDismissed: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
    isDismissed: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };
  
  private handleCopy = () => {
    const errorDetails = `Error: ${this.state.error?.name}\nMessage: ${this.state.error?.message}\n\nStack Trace:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorDetails).then(() => {
        alert('Error details copied to clipboard!');
    }, (err) => {
        console.error('Failed to copy error details: ', err);
    });
  };

  private handleDismiss = () => {
    this.setState({ isDismissed: true });
  }

  public render = () => {
    if (this.state.hasError && !this.state.isDismissed) {
      return (
        <div className="min-h-screen bg-bg-primary text-text-secondary flex flex-col p-4">
            <div className="w-full max-w-4xl mx-auto my-auto bg-bg-secondary border border-danger/50 rounded-lg shadow-xl p-6 animate-fade-in-up">
                 <div className="flex items-start gap-4">
                    <svg className="h-8 w-8 text-danger flex-shrink-0 mt-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                        <h1 className="text-xl font-semibold text-text-primary">An Application Error Occurred</h1>
                        <p className="text-text-secondary mt-1 text-sm">
                            SignalFlow encountered a problem that it can't recover from. Reloading the page is the recommended action.
                        </p>
                    </div>
                 </div>
                 
                 {this.state.error && (
                    <details className="mt-4">
                        <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">Show Error Details</summary>
                        <pre className="mt-2 bg-bg-primary p-3 rounded-md text-xs text-danger/80 max-h-40 overflow-auto font-mono">
                           <strong>{this.state.error.name}:</strong> {this.state.error.message}
                           <hr className="my-2 border-border" />
                           {this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                )}

                <div className="mt-6 flex flex-wrap gap-3 justify-end">
                    <button
                        onClick={this.handleCopy}
                        className="px-4 py-2 text-xs font-medium text-text-primary bg-bg-secondary hover:bg-border border border-border rounded-md"
                    >
                        Copy Details
                    </button>
                    <button
                        onClick={this.handleDismiss}
                        className="px-4 py-2 text-xs font-medium text-amber-300 bg-amber-900/50 hover:bg-amber-900/80 border border-amber-500/30 rounded-md"
                    >
                        Dismiss (Unsafe)
                    </button>
                    <button
                        onClick={this.handleReload}
                        className="px-5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        </div>
      );
    }

    // Render children if there's no error, or if the user dismissed the error
    return this.props.children;
  }
}