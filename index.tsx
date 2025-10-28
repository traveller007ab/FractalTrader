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
