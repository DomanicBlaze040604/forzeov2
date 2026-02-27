import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

type AuthMode = 'sign_in' | 'sign_up' | 'forgot_password'

const RETRY_DELAYS = [1000, 2000, 4000] // exponential backoff

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true
  if (error instanceof DOMException && error.name === 'AbortError') return true
  const msg = String(error && typeof error === 'object' && 'message' in error ? (error as any).message : error)
  return /failed to fetch|network|timeout|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_INTERNET|ECONNREFUSED|Load failed/i.test(msg)
}

async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isNetworkError(err) || attempt === RETRY_DELAYS.length) throw err
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]))
    }
  }
  throw lastError
}

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorIsNetwork, setErrorIsNetwork] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => { setOnline(false); setError('You appear to be offline. Please check your internet connection.') }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  const friendlyError = useCallback((err: unknown): string => {
    if (!navigator.onLine) return 'You appear to be offline. Please check your internet connection and try again.'
    if (isNetworkError(err)) return 'Unable to connect to the server. Please check your internet connection and try again.'
    const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)
    if (/invalid login/i.test(msg)) return 'Invalid email or password. Please try again.'
    if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Try signing in instead.'
    if (/email not confirmed/i.test(msg)) return 'Please check your email to confirm your account before signing in.'
    if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.'
    if (/password.*short|password.*least/i.test(msg)) return 'Password must be at least 6 characters.'
    return msg || 'Something went wrong. Please try again.'
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrorIsNetwork(false)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'forgot_password') {
        const { error } = await withRetry(() =>
          supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}` })
        )
        if (error) throw error
        setSuccess('Password reset email sent! Check your inbox.')
        setLoading(false)
        return
      }

      if (mode === 'sign_in') {
        const { error } = await withRetry(() =>
          supabase.auth.signInWithPassword({ email, password })
        )
        if (error) throw error
      } else {
        const { error } = await withRetry(() =>
          supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}` } })
        )
        if (error) throw error
        setSuccess('Check your email for a confirmation link!')
      }
    } catch (err) {
      setErrorIsNetwork(isNetworkError(err))
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setErrorIsNetwork(false)
    setLoading(true)
    try {
      const { error } = await withRetry(() =>
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}` },
        })
      )
      if (error) throw error
    } catch (err) {
      setErrorIsNetwork(isNetworkError(err))
      setError(friendlyError(err))
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Offline banner */}
      {!online && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M18.364 5.636a9 9 0 11-12.728 0" /></svg>
          You're offline. Please check your connection.
        </div>
      )}

      {/* Google OAuth */}
      {mode !== 'forgot_password' && (
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center justify-center gap-3 w-full h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors shadow-sm disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      )}

      {mode !== 'forgot_password' && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs text-slate-400 font-medium">or</span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            {mode === 'forgot_password' ? 'Email Address' : 'Work Email'}
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white/90 px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
          />
        </div>

        {mode !== 'forgot_password' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">
              {mode === 'sign_up' ? 'Create Password' : 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/90 px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="flex-1">
              <p>{error}</p>
              {errorIsNetwork && (
                <button type="button" onClick={handleSubmit as any} className="mt-1 text-red-800 underline font-medium text-xs">
                  Tap to retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p>{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          )}
          {mode === 'sign_in' ? 'Sign In to Dashboard' : mode === 'sign_up' ? 'Create Account' : 'Send Reset Link'}
        </button>
      </form>

      {/* Links */}
      <div className="flex flex-col items-center gap-2 text-sm">
        {mode === 'sign_in' && (
          <>
            <button type="button" onClick={() => { setMode('forgot_password'); setError(null); setSuccess(null) }} className="text-blue-600 hover:text-blue-700 font-medium underline-offset-2 hover:underline transition-colors">
              Forgot your password?
            </button>
            <button type="button" onClick={() => { setMode('sign_up'); setError(null); setSuccess(null) }} className="text-slate-600 hover:text-slate-800 transition-colors">
              Don't have an account? <span className="font-semibold text-blue-600">Sign Up</span>
            </button>
          </>
        )}
        {mode === 'sign_up' && (
          <button type="button" onClick={() => { setMode('sign_in'); setError(null); setSuccess(null) }} className="text-slate-600 hover:text-slate-800 transition-colors">
            Already have an account? <span className="font-semibold text-blue-600">Sign In</span>
          </button>
        )}
        {mode === 'forgot_password' && (
          <button type="button" onClick={() => { setMode('sign_in'); setError(null); setSuccess(null) }} className="text-slate-600 hover:text-slate-800 transition-colors">
            Back to <span className="font-semibold text-blue-600">Sign In</span>
          </button>
        )}
      </div>
    </div>
  )
}
