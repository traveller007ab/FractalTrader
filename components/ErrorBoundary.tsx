import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // State is initialized as a public field, which is a modern and correct approach,
  // avoiding potential issues with constructors in some build configurations.
  public state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Fix: Converted to an arrow function property to ensure `this` is correctly bound, resolving a TypeScript error where `this.setState` was not recognized.
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

  // Fix: Converted to an arrow function property to ensure `this` is correctly bound, resolving a TypeScript error where `this.props` was not recognized.
  public render = () => {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary text-text-secondary flex items-center justify-center text-center p-4">
            <div className="bg-bg-secondary border border-border rounded-lg shadow-xl p-8 max-w-lg animate-fade-in-up">
                 <svg className="h-16 w-16 text-red-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <h1 className="text-2xl font-semibold text-text-primary mt-4">Something went wrong.</h1>
                <p className="text-text-secondary mt-2">
                    An unexpected error occurred. Please try reloading the page. If the problem persists, contact support.
                </p>
                <div className="mt-6 flex gap-3 justify-center">
                    <button
                        onClick={this.handleReload}
                        className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent"
                    >
                        Reload Page
                    </button>
                     <button
                        onClick={this.handleCopy}
                        className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-secondary hover:bg-border border border-border rounded-md"
                    >
                        Copy Details
                    </button>
                </div>
                 {this.state.error && (
                    <details className="mt-4 text-left">
                        <summary className="text-xs text-text-muted cursor-pointer">Show Error Details</summary>
                        <pre className="mt-2 bg-bg-primary p-3 rounded-md text-xs text-red-400 max-h-40 overflow-auto">
                           <strong>{this.state.error.name}:</strong> {this.state.error.message}
                           <hr className="my-2 border-border" />
                           {this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                )}
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}