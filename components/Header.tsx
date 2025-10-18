import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogoIcon } from './icons';

interface HeaderProps {
  session: Session | null;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({ session, onSignOut }) => {
  return (
    <header className="bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40 border-b border-slate-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <LogoIcon className="h-8 w-8 text-emerald-400" />
            <span className="ml-3 text-2xl font-bold text-white tracking-tight">SignalFlow</span>
          </div>
          <div className="flex items-center">
            {session?.user && (
              <>
                <span className="text-sm text-slate-400 mr-4 hidden sm:block">{session.user.email}</span>
                <button
                  onClick={onSignOut}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
