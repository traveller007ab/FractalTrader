import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogoIcon } from './icons';

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
    <div className="min-h-screen bg-dark-bg flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-container-bg border border-border-color rounded-lg shadow-xl p-8">
        <div className="text-center">
            <div className="flex justify-center mb-6">
                <LogoIcon className="h-12 w-12 text-brand-accent" />
            </div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Welcome to SignalFlow</h1>
            <p className="text-slate-400 mb-8">Sign in or create an account to continue.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              required
            />
          </div>
           {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent disabled:opacity-50"
            >
              {loading ? '...' : 'Sign Up'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
         <p className="text-xs text-slate-500 mt-6 text-center">
          Turn off "Confirm email" in Supabase Auth settings for easier testing.
        </p>
      </div>
    </div>
  );
};