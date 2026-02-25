import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import ClientDashboard from './pages/ClientDashboard'
import { Toaster } from "sonner"
import { OnboardingWizard } from '@/components/ui/OnboardingWizard'
import { AuthForm } from '@/components/AuthForm'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)
  const [dashboardKey, setDashboardKey] = useState(0)
  const [autoRunClientId, setAutoRunClientId] = useState<string | null>(null)
  const sessionUserRef = useRef<string | null>(null)
  const onboardingCheckedRef = useRef(false)

  useEffect(() => {
    // Single unified auth listener — handles INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT
    // No separate getSession() call needed — INITIAL_SESSION provides the session on mount
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED fires on every browser tab switch — skip if same user
      if (event === 'TOKEN_REFRESHED') {
        if ((session?.user?.id || null) === sessionUserRef.current) {
          return // Same user, just a token refresh — no re-render needed
        }
      }

      // Update ref and state
      sessionUserRef.current = session?.user?.id || null
      setSession(session)
      setLoading(false)

      // Check onboarding only on actual sign-in events
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        // Prevent duplicate onboarding checks (StrictMode double-mount + INITIAL_SESSION)
        if (event === 'INITIAL_SESSION' && onboardingCheckedRef.current) return
        onboardingCheckedRef.current = true

        const delay = event === 'SIGNED_IN' ? 1500 : 0
        setTimeout(() => {
          checkUserOnboarding(session.user.id)
        }, delay)
      }

      if (event === 'SIGNED_OUT') {
        onboardingCheckedRef.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkUserOnboarding = async (userId: string) => {
    console.log('[Onboarding] Checking onboarding for user:', userId)
    setCheckingOnboarding(true)
    try {
      // Check if user is admin first (profile may not exist for new OAuth users)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      // If profile doesn't exist yet (new OAuth user), they definitely need onboarding
      if (profileError) {
        console.log('[Onboarding] No profile found (new user) - showing onboarding')
        setShowOnboarding(true)
        setCheckingOnboarding(false)
        return
      }

      const isAdmin = profile?.role === 'admin'

      if (isAdmin) {
        // Admins don't need onboarding
        console.log('[Onboarding] User is admin - skipping onboarding')
        setShowOnboarding(false)
        setCheckingOnboarding(false)
        return
      }

      // Check if user has any clients assigned
      const { data: userClients, error } = await supabase
        .from('user_clients')
        .select('client_id')
        .eq('user_id', userId)
        .limit(1)

      if (error) {
        console.error('[Onboarding] Error checking clients:', error)
        // On error, show onboarding to be safe
        setShowOnboarding(true)
        setCheckingOnboarding(false)
        return
      }

      // If no clients, show onboarding
      if (!userClients || userClients.length === 0) {
        console.log('[Onboarding] No brands found - showing onboarding wizard')
        setShowOnboarding(true)
      } else {
        console.log('[Onboarding] User has brands - skipping onboarding')
        setShowOnboarding(false)
      }
    } catch (error) {
      console.error('[Onboarding] Error:', error)
      // On any error, show onboarding to be safe
      setShowOnboarding(true)
    } finally {
      setCheckingOnboarding(false)
    }
  }

  const handleOnboardingComplete = async (newClientId?: string) => {
    console.log("[Onboarding] Completed, refreshing dashboard...", newClientId ? `Auto-run client: ${newClientId}` : '')
    setShowOnboarding(false)

    // If a new client was created, trigger auto-run of prompts
    if (newClientId) {
      setAutoRunClientId(newClientId)
    }

    // Trigger soft refresh of dashboard component
    setDashboardKey(prev => prev + 1)
  }

  // Only show loading spinner on initial page load (before any session is resolved)
  // NEVER flash a spinner for onboarding check — it happens silently in the background
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-gradient-to-br from-slate-50 via-white to-blue-50">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-emerald-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-[440px] px-4 relative z-10 flex flex-col items-center">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl w-full p-8 sm:p-10 flex flex-col gap-8 shadow-2xl border border-white/20">
            {/* Logo and Branding */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mb-2 shadow-xl shadow-blue-600/25 ring-4 ring-white">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-center">
                <h1 className="text-slate-900 tracking-tight text-3xl font-bold mb-1">Forzeo GEO</h1>
                <p className="text-slate-600 text-sm font-medium">AI Visibility Analytics Platform</p>
              </div>
            </div>

            {/* Auth Form */}
            <AuthForm />

            {/* Contact Sales */}
            <p className="text-center text-slate-600 text-sm">
              Need enterprise access?
              <a className="text-blue-600 hover:text-blue-700 font-semibold transition-colors ml-1" href="mailto:contact@forzeo.com">Contact Sales</a>
            </p>
          </div>

          {/* Status Indicator */}
          <div className="mt-8">
            <div className="flex items-center gap-3 px-5 py-3 bg-white/80 backdrop-blur-md rounded-full border border-white/60 shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-700 text-xs font-semibold tracking-wide">All systems operational</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-slate-500 text-xs font-medium">© 2026 Forzeo Analytics. All rights reserved.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" />
      <ClientDashboard key={dashboardKey} autoRunClientId={autoRunClientId} onAutoRunComplete={() => setAutoRunClientId(null)} />

      {/* Onboarding Wizard Popup */}
      {showOnboarding && session?.user && (
        <OnboardingWizard
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
          onComplete={handleOnboardingComplete}
        />
      )}
    </>
  )
}

export default App
