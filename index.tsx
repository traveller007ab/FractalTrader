import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AppContextProvider } from './contexts/AppContext.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Hide splash screen after app mounts
const splashScreen = document.getElementById('splash-screen');
if (splashScreen) {
    // Wait for a moment to ensure content is ready to be displayed and animation is smooth
    setTimeout(() => {
        splashScreen.classList.add('fade-out');
        splashScreen.addEventListener('transitionend', () => {
            splashScreen.remove();
        });
    }, 1200); // Delay for a better perceived performance
}

// --- Global Error Handling for Non-Blocking Notifications ---
const createErrorToast = (message: string) => {
  const toastId = `global-error-toast-${Date.now()}`;
  const toast = document.createElement('div');
  toast.id = toastId;
  // Using inline styles to be self-contained and avoid dependency on Tailwind or CSS classes
  // that might not be available if the app is in a broken state.
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    align-items: center;
    max-width: 350px;
    padding: 1rem;
    background-color: hsl(222 47% 11%);
    color: hsl(210 40% 98%);
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1);
    border: 1px solid hsl(222 47% 15%);
    font-family: 'Inter', sans-serif;
    transform: translateY(100%);
    opacity: 0;
    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
  `;
  
  toast.innerHTML = `
    <svg style="width: 1.25rem; height: 1.25rem; color: hsl(0 84% 60%); flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"></path></svg>
    <div style="margin-left: 0.75rem; font-size: 0.875rem; line-height: 1.25rem; font-weight: 400;">${message}</div>
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 50);

  // Animate out and remove
  setTimeout(() => {
    toast.style.transform = 'translateY(100%)';
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove());
  }, 5000);
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  // Prevent the browser's default action which can be disruptive.
  event.preventDefault();

  let message = 'An unexpected background error occurred.';
  if (event.reason instanceof Error) {
      // Avoid showing overly technical messages like "Failed to fetch"
      if (!event.reason.message.toLowerCase().includes('failed to fetch')) {
        message = event.reason.message;
      }
  } else if (typeof event.reason === 'string') {
      message = event.reason;
  }
  
  createErrorToast(`${message} See console for details.`);
});