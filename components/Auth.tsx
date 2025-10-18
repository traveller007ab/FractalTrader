import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogoIcon } from './icons';

export const Auth: React.FC = () => {

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
    });
    if (error) {
      console.error('Error logging in:', error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center">
      <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-lg shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
            <LogoIcon className="h-12 w-12 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to SignalFlow</h1>
        <p className="text-slate-400 mb-8">Sign in to access your trading signal dashboard.</p>
        <button
          onClick={handleLogin}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500"
        >
          Sign In with GitHub
        </button>
         <p className="text-xs text-slate-500 mt-6">
          By signing in, you agree to our imaginary Terms of Service.
        </p>
      </div>
    </div>
  );
};
