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
      // The onAuthStateChange listener in App.tsx will handle the session update
    } catch (error: any) { // FIX: Replaced invalid 'aistudio-safeguard:' with a proper catch block opening brace.
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
        // The user will need to confirm their email, but for testing, you can disable "Confirm email" in Supabase Auth settings.
        alert('Signup successful! Please check your email for a confirmation link.');
    } catch (error: any) { // FIX: Replaced invalid 'aistudio-safeguard:' with a proper catch block opening brace.
        setError(error.error_description || error.message);
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-lg shadow-xl p-8">
        <div className="text-center">
            <div className="flex justify-center mb-6">
                <LogoIcon className="h-12 w-12 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to SignalFlow</h1>
            <p className="text-slate-400 mb-8">Sign in or create an account to continue.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
           {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-white bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 disabled:opacity-50"
            >
              {loading ? '...' : 'Sign Up'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
         <p className="text-xs text-slate-500 mt-6 text-center">
          You can turn off "Confirm email" in Supabase settings for easier testing.
        </p>
      </div>
    </div>
  );
};
