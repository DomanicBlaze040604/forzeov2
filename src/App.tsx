import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import ClientDashboard from './pages/ClientDashboard'
import { Toaster } from "sonner"
const OnboardingWizard = React.lazy(() => import('@/components/ui/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })))
import { AuthForm } from '@/components/AuthForm'
import { LaunchpadView } from '@/components/LaunchpadView'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showLaunchpad, setShowLaunchpad] = useState(false)
  const [launchpadClientId, setLaunchpadClientId] = useState<string | null>(null)
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
        return
      }

      const isAdmin = profile?.role === 'admin'

      if (isAdmin) {
        // Admins skip onboarding wizard — but still get Launchpad access via sidebar
        console.log('[Onboarding] User is admin - skipping onboarding wizard')
        setShowOnboarding(false)
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
        return
      }

      // If no clients, show onboarding wizard
      if (!userClients || userClients.length === 0) {
        console.log('[Onboarding] No brands found - showing onboarding wizard')
        setShowOnboarding(true)
      } else {
        // Has clients — check if Launchpad has already been dismissed for this user
        const launchpadKey = `forzeo_launchpad_seen_${userId}`
        const alreadySeen = localStorage.getItem(launchpadKey)

        if (!alreadySeen) {
          // Check if they have any completed checklist entries (partially completed = still show)
          const { data: checklist } = await supabase
            .from('onboarding_checklists')
            .select('task_key, is_completed')
            .eq('user_id', userId)

          const allDone = checklist && checklist.length >= 5 && checklist.every(r => r.is_completed)

          if (!allDone) {
            console.log('[Launchpad] Existing user with incomplete checklist - showing Launchpad')
            setLaunchpadClientId(userClients[0].client_id)
            setShowLaunchpad(true)
          } else {
            console.log('[Launchpad] Checklist already complete - skipping Launchpad')
            localStorage.setItem(launchpadKey, 'done')
          }
        } else {
          console.log('[Onboarding] User has brands + dismissed Launchpad - skipping')
        }
        setShowOnboarding(false)
      }
    } catch (error) {
      console.error('[Onboarding] Error:', error)
      setShowOnboarding(true)
    }
  }

  const handleOnboardingComplete = async (newClientId?: string) => {
    console.log("[Onboarding] Completed, showing Launchpad...", newClientId ? `Client: ${newClientId}` : '')
    setShowOnboarding(false)

    // If a new client was created, trigger auto-run of prompts and show Launchpad
    if (newClientId) {
      setAutoRunClientId(newClientId)
      setLaunchpadClientId(newClientId)
      setShowLaunchpad(true)
    } else {
      setDashboardKey(prev => prev + 1)
    }
  }

  const [launchpadInitialTab, setLaunchpadInitialTab] = useState<string | undefined>(undefined)

  const handleLaunchpadDismiss = (tab?: string) => {
    // Mark as seen so it won't auto-show again on next login
    if (session?.user?.id) {
      localStorage.setItem(`forzeo_launchpad_seen_${session.user.id}`, 'done')
    }
    setLaunchpadInitialTab(tab)
    setShowLaunchpad(false)
    setDashboardKey(prev => prev + 1)
  }

  // Called from dashboard sidebar button — opens Launchpad for any user
  const handleShowLaunchpad = async () => {
    if (!session?.user?.id) return
    // Fetch their first client if we don't have it already
    if (!launchpadClientId) {
      const { data } = await supabase
        .from('user_clients')
        .select('client_id')
        .eq('user_id', session.user.id)
        .limit(1)
      if (data?.[0]?.client_id) setLaunchpadClientId(data[0].client_id)
    }
    setShowLaunchpad(true)
  }

  // Only show loading spinner on initial page load (before any session is resolved)
  // NEVER flash a spinner for onboarding check — it happens silently in the background
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#0372ff' }}></div>
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
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse" style={{ background: 'rgba(48,209,255,0.18)' }}></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-pulse" style={{ background: 'rgba(3,114,255,0.15)', animationDelay: '2s' }}></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-emerald-100 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-[440px] px-4 relative z-10 flex flex-col items-center">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl w-full p-8 sm:p-10 flex flex-col gap-8 shadow-2xl border border-white/20">
            {/* Logo and Branding */}
            <div className="flex flex-col items-center gap-2">
              <img src="/forzeo-logo.svg" alt="Forzeo" className="h-12 mx-auto" />
              <p className="text-slate-500 text-sm font-medium">AI Visibility Analytics Platform</p>
            </div>

            {/* Auth Form */}
            <AuthForm />

            {/* Contact Sales */}
            <p className="text-center text-slate-600 text-sm">
              Need enterprise access?
              <a className="font-semibold transition-colors ml-1" style={{ color: '#0372ff' }} href="mailto:contact@forzeo.com">Contact Sales</a>
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

      {/* Launchpad: shown after onboarding, before first dashboard view */}
      {showLaunchpad && session?.user ? (
        <LaunchpadView
          userId={session.user.id}
          clientId={launchpadClientId}
          userEmail={session.user.email}
          onDismiss={handleLaunchpadDismiss}
          onDismissToTraffic={() => handleLaunchpadDismiss('traffic')}
        />
      ) : (
        <ClientDashboard key={dashboardKey} autoRunClientId={autoRunClientId} onAutoRunComplete={() => setAutoRunClientId(null)} onShowLaunchpad={handleShowLaunchpad} initialTab={launchpadInitialTab} />
      )}

      {/* Onboarding Wizard Popup */}
      {showOnboarding && session?.user && (
        <React.Suspense fallback={null}>
          <OnboardingWizard
            open={showOnboarding}
            onOpenChange={setShowOnboarding}
            onComplete={handleOnboardingComplete}
          />
        </React.Suspense>
      )}
    </>
  )
}

export default App
