import React from 'react';
import type { Session } from '@supabase/supabase-js';
// Fix: Add .tsx extension to icons import
import { LogoIcon } from './icons.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

interface HeaderProps {
  session: Session | null;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({ session, onSignOut }) => {
  return (
    <header className="bg-bg-secondary sticky top-0 z-40 border-b border-border shadow-md shadow-black/20">
      <div className="container mx-auto px-4 sm:px-6 lg:p-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center group">
            <LogoIcon className="h-8 w-8 text-accent transition-all duration-300 ease-in-out group-hover:rotate-[-15deg] group-hover:scale-110 group-hover:[filter:drop-shadow(0_0_8px_hsl(var(--color-accent)))]" />
            <span className="ml-3 text-xl font-bold font-sans text-text-primary tracking-tight transition-colors group-hover:text-accent">SignalFlow</span>
          </div>
          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <span className="text-sm font-mono text-text-secondary mr-2 hidden sm:block">{session.user.email}</span>
                <ThemeToggle />
                <button
                  onClick={onSignOut}
                  className="px-3 py-1.5 text-sm font-medium text-text-primary bg-bg-secondary rounded-md hover:bg-border border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent"
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