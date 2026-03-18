import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  Code2,
  Bot,
  FileText,
  BarChart3,
  Calendar,
  ArrowRight,
  AlertCircle,
  Zap,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LaunchpadViewProps {
  userId: string;
  clientId: string | null;
  userEmail?: string;
  onDismiss: () => void;
  onDismissToTraffic?: () => void;
}

interface ClientData {
  name: string;
  brand_name: string;
  brand_domain?: string;
  industry?: string;
  competitors?: string[];
  target_region?: string;
}

// ─────────────────────────────────────────────
// Groq helper — calls the existing groq-proxy
// ─────────────────────────────────────────────
async function callGroq(prompt: string, system: string, maxTokens = 1200): Promise<string> {
  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    },
  });
  // Supabase wraps HTTP-level errors in `error`; function-level errors land in `data.error`
  if (error) throw new Error(`Function error: ${error.message}`);
  if (data?.error) throw new Error(`Groq error: ${data.error}`);
  if (!data?.response) throw new Error('Empty response from Groq');
  return data.response as string;
}

// ─────────────────────────────────────────────
// Download helper
// ─────────────────────────────────────────────
function downloadFile(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Animated dots for "querying LLMs"
// ─────────────────────────────────────────────
function ProcessingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 500);
    return () => clearInterval(t);
  }, []);
  return <span className="inline-block w-5 text-left">{dots}</span>;
}

function LLMPulse({ label, delay }: { label: string; delay: number }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
      style={{ background: 'rgba(3,114,255,0.06)', borderColor: 'rgba(3,114,255,0.2)', color: '#0372ff' }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ background: '#30d1ff', animationDelay: `${delay}ms` }}
        />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#0372ff' }} />
      </span>
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────
// Copy button
// ─────────────────────────────────────────────
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all',
        copied ? 'bg-emerald-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─────────────────────────────────────────────
// Code block
// ─────────────────────────────────────────────
function CodeBlock({ code, filename }: { code: string; language?: string; filename?: string }) {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex gap-1.5">
        <CopyButton text={code} />
        {filename && (
          <button
            onClick={() => downloadFile(code, filename)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        )}
      </div>
      <pre
        className="text-xs p-4 pt-8 rounded-xl border overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto"
        style={{ background: 'rgba(5,10,48,0.04)', borderColor: 'rgba(3,114,255,0.12)', color: '#1e293b' }}
      >
        {code}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────
// Generate button
// ─────────────────────────────────────────────
function GenerateButton({
  onClick,
  loading,
  hasResult,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  hasResult: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all border',
        hasResult
          ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
          : 'text-white border-transparent hover:opacity-90'
      )}
      style={!hasResult ? { background: 'linear-gradient(135deg, #0372ff, #30d1ff)' } : {}}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hasResult ? (
        <RefreshCw className="h-4 w-4" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {loading ? 'Generating…' : hasResult ? 'Regenerate' : label}
    </button>
  );
}

// ─────────────────────────────────────────────
// Task definitions (static metadata only)
// ─────────────────────────────────────────────
const TASK_KEYS = ['schema_done', 'robots_done', 'llms_done', 'ga4_done', 'call_booked'] as const;
type TaskKey = (typeof TASK_KEYS)[number];

interface TaskMeta {
  key: TaskKey;
  title: string;
  urgency: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const TASKS: TaskMeta[] = [
  {
    key: 'schema_done',
    title: 'Schema.org Verification',
    urgency: "Without Schema, AI models may misattribute your brand's core facts.",
    icon: Code2,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
  },
  {
    key: 'robots_done',
    title: 'Robots.txt Optimization',
    urgency: 'Blocked crawlers lead to immediate AI invisibility.',
    icon: Bot,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  {
    key: 'llms_done',
    title: 'Generate llms.txt',
    urgency: 'Directly influence how models like Claude and Perplexity summarize you.',
    icon: FileText,
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50',
  },
  {
    key: 'ga4_done',
    title: 'GA4 Connection',
    urgency: 'Required to see if AI citations are actually driving your revenue.',
    icon: BarChart3,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
  },
  {
    key: 'call_booked',
    title: 'Book Onboarding Call',
    urgency: 'Expert guidance to fast-track your SOMV growth.',
    icon: Calendar,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50',
  },
];

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export function LaunchpadView({
  userId,
  clientId,
  userEmail,
  onDismiss,
  onDismissToTraffic,
}: LaunchpadViewProps) {
  const [tasks, setTasks] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<TaskKey | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditDone, setAuditDone] = useState(false);

  // Live audit status — Supabase Realtime subscription
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`audit_results_${clientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_results', filter: `client_id=eq.${clientId}` },
        () => { setAuditDone(true); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clientId]);

  // Per-task generated content
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  // Load client data and saved checklist
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (clientId) {
          const { data } = await supabase
            .from('clients')
            .select('name, brand_name, brand_domain, industry, competitors, target_region')
            .eq('id', clientId)
            .single();
          if (data) setClient(data);
        }

        // Check if audit has already produced results for this client
        if (clientId) {
          const { count } = await supabase
            .from('audit_results')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .limit(1);
          if (count && count > 0) setAuditDone(true);
        }

        // Check GA4 connection — auto-mark ga4_done if integration exists
        let ga4Connected = false;
        if (clientId) {
          const { data: ga4Data } = await supabase
            .from('ga4_integrations')
            .select('id')
            .eq('client_id', clientId)
            .limit(1);
          ga4Connected = !!(ga4Data && ga4Data.length > 0);
        }

        const { data: checklistData } = await supabase
          .from('onboarding_checklists')
          .select('task_key, is_completed')
          .eq('user_id', userId);

        const map: Record<string, boolean> = {};
        if (checklistData) {
          checklistData.forEach(r => { map[r.task_key] = r.is_completed; });
        }

        // GA4 auto-verify: override with live connection status
        if (ga4Connected && !map['ga4_done']) {
          map['ga4_done'] = true;
          // Persist the auto-verified state (fire-and-forget)
          void supabase.from('onboarding_checklists').upsert(
            { user_id: userId, task_key: 'ga4_done', is_completed: true, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,task_key' }
          );
        }

        setTasks(map);
      } catch {
        // Silently fall back to local state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, clientId]);

  const toggleTask = useCallback(async (key: string) => {
    const newValue = !tasks[key];
    setTasks(prev => ({ ...prev, [key]: newValue }));
    setSaving(key);
    try {
      await supabase.from('onboarding_checklists').upsert(
        { user_id: userId, task_key: key, is_completed: newValue, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,task_key' }
      );
    } finally {
      setSaving(null);
    }
    if (newValue) {
      const meta = TASKS.find(t => t.key === key);
      toast.success(`"${meta?.title}" marked complete`);
    }
  }, [tasks, userId]);

  // ── Groq generators ──────────────────────────
  async function generate(key: TaskKey) {
    if (!client) return;
    setGenerating(prev => ({ ...prev, [key]: true }));
    try {
      let result = '';
      const brand = client.brand_name || client.name;
      const site = client.brand_domain || '[website]';
      const competitors = client.competitors?.slice(0, 3).join(', ') || '';
      const industry = client.industry || 'Technology';

      if (key === 'schema_done') {
        result = await callGroq(
          `Brand name: ${brand}
Website: ${site}
Competitors: ${competitors || 'unknown'}
Industry: ${industry}

Generate complete Schema.org JSON-LD structured data including:
1. Organization schema with name, url, description, sameAs, contactPoint
2. WebSite schema with SearchAction
3. Product or Service schema if applicable

Return ONLY the complete <script type="application/ld+json"> block, ready to paste into the HTML <head>.`,
          'You are a Schema.org expert. Generate accurate, comprehensive JSON-LD structured data. Return only the script tag and JSON — no explanation, no markdown code fences.',
          1200
        );
      }

      if (key === 'robots_done') {
        result = await callGroq(
          `Website: ${site}
Brand: ${brand}

Generate an optimized robots.txt file that:
1. Allows all AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, CCBot, Googlebot, Bingbot, FacebookBot)
2. Blocks only known malicious scrapers and spam bots
3. Sets a crawl-delay of 10 for heavy crawlers
4. Specifies the sitemap URL

Return ONLY the complete robots.txt content, ready to upload.`,
          'You are a technical SEO expert specialising in AI crawler access. Return only the robots.txt file content — no explanation, no markdown.',
          600
        );
      }

      if (key === 'llms_done') {
        result = await callGroq(
          `Brand: ${brand}
Website: ${site}
Competitors: ${competitors || 'unknown'}
Industry: ${industry}

Write a comprehensive llms.txt file (markdown format) for this brand. Include:
- Core Identity section (brand, mission, website, founding year if known)
- What the brand does (2-3 bullet points)
- Key products or services (3-5 items)
- Primary audience
- Key differentiators / value props (3 bullets)
- Technical authority statement
- Verification footer

This file will be placed at ${site}/llms.txt so LLMs like Claude and Perplexity can accurately describe this brand.`,
          'You are an expert in LLM context files and GEO (Generative Engine Optimisation). Write a high-quality llms.txt that maximises AI brand visibility. Use clean markdown. Return only the file content.',
          900
        );
      }

      if (result) {
        setGenerated(prev => ({ ...prev, [key]: result.trim() }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Generation failed: ${msg}`);
    } finally {
      setGenerating(prev => ({ ...prev, [key]: false }));
    }
  }

  const completedCount = TASKS.filter(t => tasks[t.key]).length;
  const allTasksDone = completedCount === TASKS.length;
  const setupComplete = allTasksDone && auditDone;
  const progress = Math.round((completedCount / TASKS.length) * 100);

  const handleDismiss = useCallback(async () => {
    const remainingTasks = TASKS.filter(t => !tasks[t.key]).map(t => t.key);
    const completedTasks = TASKS.filter(t => tasks[t.key]).map(t => t.key);

    if (remainingTasks.length > 0 && userEmail) {
      supabase.functions.invoke('launchpad-abandon-email', {
        body: { userEmail, brandName: client?.brand_name ?? client?.name, completedTasks, remainingTasks },
      }).catch(() => {/* non-critical */});
    }
    onDismiss();
  }, [tasks, userEmail, client, onDismiss]);

  const handleGoToGA4 = useCallback(() => {
    if (onDismissToTraffic) onDismissToTraffic();
    else onDismiss();
  }, [onDismissToTraffic, onDismiss]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(160deg, #f5f9ff 0%, #ffffff 50%, #f0faff 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0372ff' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #f5f9ff 0%, #ffffff 50%, #f0faff 100%)' }}>
      {/* Brand accent bar */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #050a30 0%, #0372ff 50%, #30d1ff 100%)' }} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white/90 backdrop-blur-sm sticky top-0 z-10"
        style={{ borderColor: 'rgba(3,114,255,0.12)' }}>
        <img src="/forzeo-logo.svg" alt="Forzeo" className="h-8" />
        <button onClick={handleDismiss} className="text-sm text-slate-400 hover:text-slate-600 transition-colors font-medium">
          Skip for now →
        </button>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 pb-28">

        {/* Step progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: '#0372ff' }}>
              <Check className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-700">Onboarding Complete</span>
          </div>
          <div className="flex-1 max-w-16 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #0372ff, rgba(48,209,255,0.4))' }} />
          <div className="flex items-center gap-2">
            <div className={cn('h-7 w-7 rounded-full flex items-center justify-center transition-all duration-500', setupComplete ? '' : 'animate-pulse')}
              style={setupComplete
                ? { background: '#10b981' }
                : { background: 'rgba(3,114,255,0.15)', border: '2px solid #0372ff' }}>
              {setupComplete
                ? <Check className="h-4 w-4 text-white" />
                : <Zap className="h-3.5 w-3.5" style={{ color: '#0372ff' }} />}
            </div>
            <span className="text-sm font-semibold" style={{ color: setupComplete ? '#059669' : '#0372ff' }}>Technical Setup</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium transition-all duration-500"
              style={setupComplete
                ? { background: 'rgba(16,185,129,0.12)', color: '#059669' }
                : auditDone
                  ? { background: 'rgba(234,179,8,0.12)', color: '#92400e' }
                  : allTasksDone
                    ? { background: 'rgba(3,114,255,0.1)', color: '#0372ff' }
                    : { background: 'rgba(3,114,255,0.1)', color: '#0372ff' }}>
              {setupComplete ? 'Complete ✓' : auditDone ? 'Setup Pending' : allTasksDone ? 'Audit Running…' : 'In Progress'}
            </span>
          </div>
        </div>

        {/* Audit hero */}
        <div className="rounded-2xl p-5 mb-6 border"
          style={{ background: 'linear-gradient(135deg, rgba(5,10,48,0.97) 0%, rgba(3,50,120,0.95) 100%)', borderColor: auditDone ? 'rgba(16,185,129,0.4)' : 'rgba(48,209,255,0.2)' }}>
          <div className="flex items-start gap-3 mb-4">
            {auditDone
              ? <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              : <Loader2 className="h-5 w-5 animate-spin text-cyan-400 mt-0.5 flex-shrink-0" />
            }
            <div>
              <p className="text-white font-semibold text-sm">
                {auditDone ? 'Audit complete — results ready' : <>Audit engine running<ProcessingDots /></>}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {auditDone
                  ? <>Your AI visibility data for{' '}<span className="text-emerald-400 font-medium">{client?.brand_name ?? client?.name ?? 'your brand'}</span>{' '}is ready. Complete the setup below to maximise accuracy.</>
                  : <>Querying 5+ LLMs for{' '}<span className="text-cyan-400 font-medium">{client?.brand_name ?? client?.name ?? 'your brand'}</span>{' '}data. This takes 5–10 minutes.</>
                }
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {auditDone
              ? ['ChatGPT', 'Claude', 'Perplexity', 'Gemini', 'Google AI'].map(label => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                    style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                    <CheckCircle2 className="h-3 w-3" />{label}
                  </div>
                ))
              : <>
                  <LLMPulse label="ChatGPT" delay={0} />
                  <LLMPulse label="Claude" delay={400} />
                  <LLMPulse label="Perplexity" delay={800} />
                  <LLMPulse label="Gemini" delay={1200} />
                  <LLMPulse label="Google AI" delay={1600} />
                </>
            }
          </div>
        </div>

        {/* Urgency / status banner — changes based on state */}
        {setupComplete ? (
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 border"
            style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)' }}>
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-800 font-medium leading-snug">
              All done! Your AI visibility audit results are ready to review in the dashboard.
            </p>
          </div>
        ) : allTasksDone ? (
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 border"
            style={{ background: 'rgba(3,114,255,0.06)', borderColor: 'rgba(3,114,255,0.2)' }}>
            <Loader2 className="h-4 w-4 mt-0.5 flex-shrink-0 animate-spin" style={{ color: '#0372ff' }} />
            <p className="text-sm font-medium leading-snug" style={{ color: '#1e40af' }}>
              Tasks complete — audit is still processing. Results will appear automatically when ready.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 border"
            style={{ background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.3)' }}>
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800 font-medium leading-snug">
              Your first audit is in progress. To ensure 100% accuracy and maximum AI visibility, complete these critical technical setups now. Click Review Results if you want to come back to this page later.
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(3,114,255,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0372ff 0%, #30d1ff 100%)' }} />
          </div>
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: progress === 100 ? '#059669' : '#0372ff' }}>{completedCount} / {TASKS.length}</span>
        </div>

        {/* Checklist */}
        <div className="flex flex-col gap-3">
          {TASKS.map(task => {
            const isComplete = !!tasks[task.key];
            const isExpanded = expanded === task.key;
            const isSaving = saving === task.key;
            const isGenerating = generating[task.key];
            const generatedContent = generated[task.key];
            const Icon = task.icon;

            return (
              <div key={task.key}
                className={cn('rounded-xl border bg-white transition-all duration-200 shadow-sm',
                  isComplete ? 'border-emerald-200 bg-emerald-50/30' : '')}
                style={!isComplete ? { borderColor: 'rgba(3,114,255,0.15)' } : {}}>

                {/* Row header */}
                <div className="flex items-start gap-3 p-4">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    isComplete ? 'bg-emerald-100' : task.iconBg)}>
                    <Icon className={cn('h-4 w-4', isComplete ? 'text-emerald-600' : task.iconColor)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={cn('font-semibold text-sm',
                      isComplete ? 'text-emerald-700 line-through decoration-emerald-400' : 'text-slate-900')}>
                      {task.title}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{task.urgency}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : task.key)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100"
                    >
                      {task.key !== 'ga4_done' && task.key !== 'call_booked' ? 'Generate' : 'How-to'}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    <button
                      onClick={() => toggleTask(task.key)}
                      disabled={isSaving}
                      className={cn('flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200',
                        isComplete ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                        isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      {isComplete ? 'Done' : 'Mark Done'}
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-4">

                    {/* ── SCHEMA ── */}
                    {task.key === 'schema_done' && (
                      <>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          We'll generate <strong>JSON-LD structured data</strong> for{' '}
                          <span className="font-semibold text-slate-800">{client?.brand_name ?? client?.name ?? 'your brand'}</span>{' '}
                          using your brand details. Paste it into your website's <code className="bg-slate-100 px-1 rounded text-xs">&lt;head&gt;</code>.
                        </p>
                        <GenerateButton
                          onClick={() => generate('schema_done')}
                          loading={isGenerating}
                          hasResult={!!generatedContent}
                          label="Generate Schema.org JSON-LD"
                        />
                        {generatedContent && (
                          <>
                            <CodeBlock code={generatedContent} language="html" filename="schema.html" />
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                              <span>✅</span>
                              <span>Paste inside your <code className="bg-white px-1 rounded border">&lt;head&gt;</code> tag. Validate at{' '}
                                <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer"
                                  className="underline" style={{ color: '#0372ff' }}>
                                  Rich Results Test <ExternalLink className="inline h-3 w-3" />
                                </a>
                              </span>
                            </div>
                          </>
                        )}
                        {!generatedContent && (
                          <div className="text-xs text-slate-400 space-y-1">
                            <p className="font-semibold text-slate-500 uppercase tracking-wide">Manual steps</p>
                            <ol className="list-decimal list-inside space-y-1">
                              <li>Open your site source (Ctrl+U), search for "application/ld+json"</li>
                              <li>If missing, generate above and paste into your &lt;head&gt;</li>
                              <li>Validate at search.google.com/test/rich-results</li>
                            </ol>
                          </div>
                        )}
                      </>
                    )}

                    {/* ── ROBOTS.TXT ── */}
                    {task.key === 'robots_done' && (
                      <>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          We'll generate an <strong>AI-friendly robots.txt</strong> that allows GPTBot, ClaudeBot,
                          PerplexityBot and other AI crawlers to access{' '}
                          <span className="font-semibold text-slate-800">{client?.brand_domain ?? 'your site'}</span>.
                        </p>
                        <GenerateButton
                          onClick={() => generate('robots_done')}
                          loading={isGenerating}
                          hasResult={!!generatedContent}
                          label="Generate AI-Friendly robots.txt"
                        />
                        {generatedContent && (
                          <>
                            <CodeBlock code={generatedContent} language="text" filename="robots.txt" />
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                              <span>📤</span>
                              <span>Upload this file as <code className="bg-white px-1 rounded border">robots.txt</code> to your website root.
                                Verify at <span className="font-mono">{client?.brand_domain ?? 'yoursite.com'}/robots.txt</span>
                              </span>
                            </div>
                          </>
                        )}
                        {!generatedContent && (
                          <div className="text-xs text-slate-400 space-y-1">
                            <p className="font-semibold text-slate-500 uppercase tracking-wide">Manual check</p>
                            <ol className="list-decimal list-inside space-y-1">
                              <li>Visit <span className="font-mono">{client?.brand_domain ?? 'yoursite.com'}/robots.txt</span></li>
                              <li>Ensure GPTBot, ClaudeBot, PerplexityBot are not in "Disallow: /"</li>
                              <li>Generate the optimized version above and upload it</li>
                            </ol>
                          </div>
                        )}
                      </>
                    )}

                    {/* ── LLMS.TXT ── */}
                    {task.key === 'llms_done' && (
                      <>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Generate a <strong>custom llms.txt</strong> — a markdown file that tells AI models exactly
                          how to represent <span className="font-semibold text-slate-800">{client?.brand_name ?? client?.name ?? 'your brand'}</span>.
                          Upload it to <span className="font-mono text-xs bg-slate-100 px-1 rounded">{client?.brand_domain ?? 'yoursite.com'}/llms.txt</span>.
                        </p>
                        <GenerateButton
                          onClick={() => generate('llms_done')}
                          loading={isGenerating}
                          hasResult={!!generatedContent}
                          label="Generate llms.txt with AI"
                        />
                        {generatedContent && (
                          <>
                            <CodeBlock code={generatedContent} language="markdown" filename="llms.txt" />
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                              <span>📁</span>
                              <span>Save as <code className="bg-white px-1 rounded border">llms.txt</code> and upload to your website root directory.</span>
                            </div>
                          </>
                        )}
                        {!generatedContent && (
                          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 font-mono whitespace-pre-wrap">
{`# ${client?.brand_name ?? client?.name ?? '[Brand Name]'} - LLM Context File
## Purpose: Structured data for AI Agents and LLMs.

### Core Identity
- Brand: ${client?.brand_name ?? client?.name ?? '[Brand Name]'}
- Industry: ${client?.industry ?? '[Industry]'}
- Website: ${client?.brand_domain ?? '[https://yoursite.com]'}
…`}
                          </div>
                        )}
                      </>
                    )}

                    {/* ── GA4 ── */}
                    {task.key === 'ga4_done' && (
                      <>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Connect Google Analytics 4 to track which AI citations are driving real traffic and revenue.
                          This is handled inside your Forzeo dashboard.
                        </p>
                        <div className="space-y-2">
                          <div className="text-xs text-slate-500 space-y-1">
                            <p className="font-semibold text-slate-600 uppercase tracking-wide text-[11px]">Steps</p>
                            {['Go to the Traffic tab in your dashboard', 'Click "Connect Google Analytics 4"',
                              'Sign in with the Google account that owns your GA4 property',
                              'Select your GA4 property and confirm'].map((s, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="flex-shrink-0 h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                                  style={{ background: 'rgba(3,114,255,0.1)', color: '#0372ff' }}>{i + 1}</span>
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={handleGoToGA4}
                            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all mt-2"
                            style={{ background: 'rgba(3,114,255,0.08)', color: '#0372ff', border: '1px solid rgba(3,114,255,0.2)' }}
                          >
                            <BarChart3 className="h-4 w-4" />
                            Open Traffic Tab to Connect GA4
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}

                    {/* ── BOOK CALL ── */}
                    {task.key === 'call_booked' && (
                      <>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          15-minute strategy session with a Forzeo GEO specialist. Get personalised recommendations
                          to maximise <span className="font-semibold text-slate-800">{client?.brand_name ?? client?.name ?? 'your brand'}</span>'s
                          AI Share of Voice.
                        </p>
                        <div className="text-xs text-slate-500 space-y-1 mb-3">
                          {['We review your first audit results together',
                            'Identify your top 3 quick-win optimisations',
                            'Build a 30-day GEO action plan',
                            'Get your SOMV growth targets'].map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-emerald-500 font-bold">✓</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                        <a
                          href="https://calendar.app.google/pPwxuRRCQgfSVRu27"
                          target="_blank" rel="noopener noreferrer"
                          onClick={() => { if (!tasks['call_booked']) toggleTask('call_booked'); }}
                          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-all"
                          style={{ background: 'linear-gradient(135deg, #0372ff, #30d1ff)', color: 'white' }}
                        >
                          <Calendar className="h-4 w-4" />
                          Book your onboarding call
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                        </a>
                      </>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion celebration */}
        {completedCount === TASKS.length && (
          <div className="mt-6 rounded-xl p-5 border text-center"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))', borderColor: 'rgba(16,185,129,0.3)' }}>
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-emerald-800 text-sm">All technical setups complete!</p>
            <p className="text-xs text-emerald-600 mt-1">Your site is fully optimised for AI crawler discovery.</p>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm px-4 py-4 z-20"
        style={{ borderTop: '1px solid rgba(3,114,255,0.12)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {setupComplete ? 'Setup complete! Your AI visibility results are ready.' : `${TASKS.length - completedCount} task${TASKS.length - completedCount === 1 ? '' : 's'} remaining`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {setupComplete ? 'Click to view your first AI Visibility Audit' : 'Click Review Results if you want to come back to this page later'}
            </p>
          </div>

          <div className="flex-shrink-0">
            <Button onClick={handleDismiss}
              className="flex items-center gap-2 font-semibold px-5 py-2.5 h-auto text-sm text-white border-0"
              style={{ background: setupComplete ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #0372ff, #30d1ff)' }}>
              {setupComplete ? <><CheckCircle2 className="h-4 w-4" /> View Results</> : <>Review Results <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
