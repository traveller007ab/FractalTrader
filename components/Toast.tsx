import React, { useState, useEffect } from 'react';
// Fix: Add .tsx extension to icons import
import { CopyIcon, ChartIcon } from './icons.tsx';

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
    success: <CopyIcon className="w-5 h-5 text-emerald-400" />,
    error: <ErrorIcon className="w-5 h-5 text-red-400" />,
    info: <ChartIcon className="w-5 h-5 text-sky-400" />,
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Duration of the fade-out animation
  };

  useEffect(() => {
    // Automatically close after some time
    const timer = setTimeout(handleClose, 4700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`flex items-center justify-between max-w-xs p-4 bg-slate-800 text-slate-200 rounded-lg shadow-lg border border-border-color ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <div className="ml-3 text-sm font-normal">{message}</div>
      </div>
       <button onClick={handleClose} className="ml-4 -mx-1.5 -my-1.5 bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg focus:ring-2 focus:ring-slate-600 p-1.5 inline-flex h-8 w-8" aria-label="Close">
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
      </button>
    </div>
  );
};