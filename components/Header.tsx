import React from 'react';
import type { Session } from '@supabase/supabase-js';
// Fix: Add .tsx extension to icons import
import { LogoIcon } from './icons.tsx';

interface HeaderProps {
  session: Session | null;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({ session, onSignOut }) => {
  return (
    <header className="bg-container-bg sticky top-0 z-40 border-b border-border-color">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center group">
            <LogoIcon className="h-8 w-8 text-brand-accent transition-transform duration-200 ease-in-out group-hover:rotate-[-12deg]" />
            <span className="ml-3 text-xl font-semibold text-slate-100 tracking-tight transition-colors group-hover:text-white">SignalFlow</span>
          </div>
          <div className="flex items-center">
            {session?.user && (
              <>
                <span className="text-sm text-slate-400 mr-4 hidden sm:block">{session.user.email}</span>
                <button
                  onClick={onSignOut}
                  className="px-3 py-1.5 text-sm font-medium text-slate-200 bg-slate-800 rounded-md hover:bg-slate-700 border border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent"
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