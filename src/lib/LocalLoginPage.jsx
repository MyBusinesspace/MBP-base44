import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { http } from '@/api/http';

export default function LocalLoginPage({ googleEnabled, authError, onDevLogin, onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { email, password, full_name: fullName }
          : { email, password };

      const result = await http.post(endpoint, body);

      if (result?.token) {
        localStorage.setItem('mpb_access_token', result.token);
        sessionStorage.removeItem('mpb_logged_out');
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        } else {
          window.location.href = '/';
        }
        return;
      }

      setFormError('Login failed. Please try again.');
    } catch (err) {
      setFormError(err.data?.error || err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = formError || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">MyBusinessPace</h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        {displayError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {displayError}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={mode === 'register' ? 6 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in with Email'
                : 'Create account'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400 uppercase">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {googleEnabled ? (
          <Button
            type="button"
            className="w-full h-11 gap-3 bg-white text-slate-800 border border-slate-300 hover:bg-slate-50"
            variant="outline"
            onClick={handleGoogleLogin}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Google login is not enabled. On Vercel add{' '}
            <code className="text-xs">GOOGLE_OAUTH_CLIENT_ID</code> and{' '}
            <code className="text-xs">VITE_GOOGLE_OAUTH_CLIENT_ID</code> (same value) in
            Environment Variables, then <strong>Redeploy</strong>.
          </div>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button
                type="button"
                className="font-medium text-slate-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setMode('register');
                  setFormError(null);
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="font-medium text-slate-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setMode('login');
                  setFormError(null);
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>

        {!googleEnabled && onDevLogin && (
          <Button type="button" variant="secondary" className="mt-4 w-full" onClick={onDevLogin}>
            Continue as local admin (dev)
          </Button>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          New accounts are created with the <strong>user</strong> role.
        </p>
      </div>
    </div>
  );
}
