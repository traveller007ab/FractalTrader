import React, { createContext, useState, useContext, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { ToastMessage } from '../types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

interface AppContextType {
    session: Session | null;
    user: User | null;
    addToast: (message: string, type?: ToastMessage['type']) => void;
    connectionStatus: ConnectionStatus;
    setConnectionStatus: (status: ConnectionStatus) => void;
    setSession: (session: Session | null) => void;
    setUser: (user: User | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

    const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);
    
    // This will be rendered in App.tsx to provide the toast container
    const ToastContainerComponent = React.lazy(() => import('../components/Toast.tsx').then(module => ({ default: module.ToastContainer })));
    const ToastComponent = React.lazy(() => import('../components/Toast.tsx').then(module => ({ default: module.Toast })));

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    return (
        <AppContext.Provider value={{ session, user, addToast, connectionStatus, setConnectionStatus, setSession, setUser }}>
            {children}
            <React.Suspense fallback={null}>
                <ToastContainerComponent>
                    {toasts.map(toast => (
                        <ToastComponent
                            key={toast.id}
                            message={toast.message}
                            type={toast.type}
                            onClose={() => removeToast(toast.id)}
                        />
                    ))}
                </ToastContainerComponent>
            </React.Suspense>
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppContextProvider');
    }
    return context;
};
