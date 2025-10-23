import React, { useState } from 'react';
// Fix: Add file extension to import to ensure the typed supabase client is loaded.
import { supabase } from '../lib/supabaseClient.ts';
// Fix: Add .tsx extension to icons import
import { LogoIcon } from './icons.tsx';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Signup successful! Please check your email for a confirmation link.');
    } catch (error: any) {
        setError(error.error_description || error.message);
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-bg-secondary border border-border rounded-lg p-8 shadow-[0_0_25px_-5px_hsl(var(--color-accent)/0.15)] transition-shadow hover:shadow-[0_0_30px_-5px_hsl(var(--color-accent)/0.25)]">
        <div className="text-center">
            <div className="flex justify-center mb-6">
                <LogoIcon className="h-12 w-12 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">Welcome to SignalFlow</h1>
            <p className="text-text-secondary mb-8">Sign in or create an account to continue.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
           {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-border text-sm font-medium rounded-md shadow-sm text-text-primary bg-bg-secondary hover:bg-border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent disabled:opacity-50"
            >
              {loading ? '...' : 'Sign Up'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
         <p className="text-xs text-text-muted mt-6 text-center">
          Turn off "Confirm email" in Supabase Auth settings for easier testing.
        </p>
      </div>
    </div>
  );
};