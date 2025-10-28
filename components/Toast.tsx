import React, { useState, useEffect, useCallback } from 'react';
// Fix: Add .tsx extension to icons import
import { CopyIcon, ChartIcon, XMarkIcon } from './icons.tsx';

export const ToastContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div aria-live="assertive" className="fixed bottom-5 right-5 z-50 space-y-3">
    {children}
  </div>
);

const ErrorIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);


interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const icons = {
    success: <CopyIcon className="w-5 h-5 text-emerald-500" />,
    error: <ErrorIcon className="w-5 h-5 text-red-500" />,
    info: <ChartIcon className="w-5 h-5 text-sky-500" />,
  };

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Duration of the fade-out animation
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(handleClose, 4700);
    return () => clearTimeout(timer);
  }, [handleClose]);

  return (
    <div className={`flex items-center justify-between max-w-xs p-4 bg-bg-secondary text-text-primary rounded-lg shadow-lg border border-border ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <div className="ml-3 text-sm font-normal">{message}</div>
      </div>
       <button onClick={handleClose} className="ml-4 -mx-1.5 -my-1.5 bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-border rounded-lg focus:ring-2 focus:ring-border p-1.5 inline-flex h-8 w-8" aria-label="Close">
        <span className="sr-only">Close</span>
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
};
