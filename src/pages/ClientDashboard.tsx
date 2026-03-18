/**
 * FORZEO GEO DASHBOARD - Redesigned UI v6.0
 */
import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronLeft, Search, Plus, Trash2, Play, AlertTriangle, Archive, RotateCcw, Copy, ExternalLink, Link2, Download, Filter, Eye, Settings, Clock, CheckCircle, X, ChevronRight, TrendingUp, TrendingDown, Minus, ArrowUpDown, Loader2, FileText, Globe, Zap, Lightbulb, Target, Layers, Wand2, Briefcase, LogOut, Home, MessageSquare, Building2, Users, HelpCircle, PanelLeft, PanelLeftClose, Calendar, Upload, BarChart3, RefreshCw, Circle, Shield, History, Sparkles, Tag, Info, Bell, DollarSign } from 'lucide-react';
import { SOVLineChart, CLIENT_COLOR, COMPETITOR_COLORS } from "@/components/SOVLineChart";
import { AgencyOverview } from "@/components/AgencyOverview";
import { AgencyBrandsManager } from "@/components/AgencyBrandsManager";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
const UserManagement = React.lazy(() => import("@/components/UserManagement").then(m => ({ default: m.UserManagement })));
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useClientDashboard, AI_MODELS, cleanAndAnalyzeResponse, PromptInsightResult } from "@/hooks/useClientDashboard";
import { MODEL_LOGOS } from "@/components/ModelLogos";
import { ScheduleManager } from "@/components/ScheduleManager";
import { UniversalImport } from "@/components/UniversalImport";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { PromptsTab } from "@/components/tabs/PromptsTab";
import { TopicsTab } from "@/components/tabs/TopicsTab";
import SourcesTab from "@/components/tabs/SourcesTab";
import { CitationsTab } from "@/components/tabs/CitationsTab";
import { ContentTab } from "@/components/tabs/ContentTab";
const MultiAccountScheduler = React.lazy(() => import("@/components/MultiAccountScheduler"));
const SignalsDashboard = React.lazy(() => import("@/components/SignalsDashboard").then(m => ({ default: m.SignalsDashboard })));
const TrafficTab = React.lazy(() => import("@/components/tabs/TrafficTab").then(m => ({ default: m.TrafficTab })));
import { CostTab } from "@/components/tabs/CostTab";
import { CitationPreview } from "@/components/CitationPreview";
import { InsightsTab, type AiInsights } from "@/components/tabs/InsightsTab";
import { GA4ConnectorPanel } from "@/components/GA4ConnectorPanel";
import { useGA4Connector } from "@/hooks/useGA4Connector";

import { toast } from "sonner";

/**
 * Normalize a brand name for fuzzy matching.
 * Strips TLDs (.com, .io, etc.), common suffixes (CRM, App, Software...),
 * punctuation, and extra whitespace so that "monday.com", "Monday CRM",
 * and "Monday" all reduce to the same core token for comparison.
 */
function normalizeBrandToken(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(com|io|ai|co|org|net|app|dev|me|us|uk|de|fr|in|ca|au|xyz|info|biz|so|gg)$/gi, '')
    .replace(/\b(crm|app|software|platform|tool|cloud|hq|labs|inc|llc|ltd|corp|suite|hub|pro|studio|agency|group|saas|erp)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Check if two brand names refer to the same entity using normalized tokens.
 * E.g. "monday.com" matches "Monday CRM", "Monday" matches "monday.com"
 */
// Common English words that cause false positive brand matches
const COMMON_WORD_SKIP = new Set([
  "able", "also", "area", "back", "been", "best", "both", "call", "came", "case",
  "come", "could", "data", "days", "does", "done", "down", "each", "even", "fact",
  "find", "first", "form", "from", "full", "gave", "gets", "give", "goes", "good",
  "great", "hack", "half", "hand", "hard", "have", "head", "help", "here", "high",
  "home", "idea", "info", "into", "just", "keep", "kind", "know", "last", "lead",
  "left", "less", "life", "like", "line", "link", "list", "live", "long", "look",
  "made", "main", "make", "many", "meet", "mind", "more", "most", "much", "must",
  "name", "near", "need", "next", "note", "once", "only", "open", "over", "page",
  "part", "past", "plan", "play", "plus", "post", "push", "read", "real", "rest",
  "rich", "role", "rule", "runs", "safe", "said", "same", "save", "seen", "send",
  "show", "side", "sign", "site", "size", "some", "sort", "step", "stop", "sure",
  "take", "talk", "team", "tell", "test", "text", "that", "them", "then", "they",
  "this", "time", "tool", "turn", "type", "unit", "upon", "used", "user", "uses",
  "very", "view", "want", "wave", "well", "went", "were", "what", "when", "will",
  "with", "word", "work", "year", "your", "zero"
]);

function brandNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeBrandToken(a);
  const nb = normalizeBrandToken(b);
  if (!na || !nb) return false;
  if (COMMON_WORD_SKIP.has(na) || COMMON_WORD_SKIP.has(nb)) return false;
  // Exact normalized match or one contains the other (for partial names)
  return na === nb || (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na)));
}

/**
 * Check if a brand name (or any of its aliases) appears in a response text.
 * Uses both exact substring and normalized token matching.
 */
function brandMentionedInText(response: string, brandName: string, aliases: string[] = []): boolean {
  if (!response) return false;
  const lower = response.toLowerCase();
  const allTerms = [brandName, ...aliases].filter(Boolean);
  // Direct substring match (original behavior)
  for (const term of allTerms) {
    if (lower.includes(term.toLowerCase())) return true;
  }
  // Normalized token match: extract potential brand tokens from response
  // and compare against normalized brand name
  const brandToken = normalizeBrandToken(brandName);
  if (brandToken.length >= 4 && !COMMON_WORD_SKIP.has(brandToken)) {
    // Check if the normalized token appears as a word in the response
    const responseClean = lower.replace(/[^a-z0-9\s]/g, '');
    if (responseClean.includes(brandToken)) return true;
  }
  return false;
}

/**
 * Compute position for an audit result using multi-layer fallbacks:
 * 1. summary.average_rank (from backend)
 * 2. Average of model_results brand_rank fields
 * 3. Parse from raw_response using cleanAndAnalyzeResponse
 * 4. Extracted brands position (DataForSEO)
 */
function computePositionForResult(
  r: any,
  selectedClient: any
): number | null {
  if (!r) return null;

  // 1. Use summary.average_rank if available
  let pos = r.summary?.average_rank;
  if (pos) return pos;

  // Check visibility
  const visibleCount = r.model_results.filter((mr: any) => {
    if (mr.brand_mentioned) return true;
    if (selectedClient && mr.raw_response) {
      return brandMentionedInText(mr.raw_response, selectedClient.brand_name, selectedClient.brand_tags || []);
    }
    return false;
  }).length;

  if (visibleCount === 0) return null;

  // 2. Average of model_results brand_rank fields
  const ranksFromModels = r.model_results
    .filter((mr: any) => mr.brand_mentioned && mr.brand_rank != null)
    .map((mr: any) => mr.brand_rank as number);
  if (ranksFromModels.length > 0) {
    return Math.round(ranksFromModels.reduce((a: number, b: number) => a + b, 0) / ranksFromModels.length * 10) / 10;
  }

  // 3. Parse rank from raw_response text using cleanAndAnalyzeResponse
  if (selectedClient?.brand_name) {
    const parsedRanks: number[] = [];
    r.model_results.forEach((mr: any) => {
      if (mr.raw_response) {
        const { brandRank } = cleanAndAnalyzeResponse(
          mr.raw_response,
          selectedClient.brand_name,
          selectedClient.competitors || [],
          selectedClient.brand_tags || []
        );
        if (brandRank) parsedRanks.push(brandRank);
      }
    });
    if (parsedRanks.length > 0) {
      return Math.round(parsedRanks.reduce((a, b) => a + b, 0) / parsedRanks.length * 10) / 10;
    }
  }

  // 4. Use extracted_brands position from DataForSEO brand entities API
  const ebPositions: number[] = [];
  r.model_results.forEach((mr: any) => {
    if (mr.extracted_brands) {
      const ownBrand = mr.extracted_brands.find((eb: any) => eb.is_own_brand && eb.position);
      if (ownBrand) ebPositions.push(ownBrand.position);
    }
  });
  if (ebPositions.length > 0) {
    return Math.round(ebPositions.reduce((a, b) => a + b, 0) / ebPositions.length * 10) / 10;
  }

  // 5. Final fallback: derive position from mention order in text
  if (selectedClient?.brand_name) {
    const mentionOrderRanks: number[] = [];
    r.model_results.forEach((mr: any) => {
      if (!mr.raw_response) return;
      const text = mr.raw_response.toLowerCase();
      const brandIdx = text.indexOf(selectedClient.brand_name.toLowerCase());
      if (brandIdx === -1) return;
      let rank = 1;
      (selectedClient.competitors || []).forEach((comp: string) => {
        const compIdx = text.indexOf(comp.toLowerCase());
        if (compIdx !== -1 && compIdx < brandIdx) rank++;
      });
      mentionOrderRanks.push(rank);
    });
    if (mentionOrderRanks.length > 0) {
      return Math.round(mentionOrderRanks.reduce((a, b) => a + b, 0) / mentionOrderRanks.length * 10) / 10;
    }
  }

  return null;
}

/**
 * Format Google AI Overview text for display.
 * DataForSEO returns AI Overview as plain text without line breaks.
 * This detects structured patterns and adds markdown formatting.
 */
function formatAIOverviewForDisplay(text: string): string {
  if (!text) return '';

  let formatted = text;

  // Clean DataForSEO artifacts: {Link: BrandName } â†’ BrandName
  formatted = formatted.replace(/\{Link:\s*([^}]+?)\s*\}/g, '$1');

  // Remove floating citation count markers (e.g., "CrowdStrike +2" before list items)
  formatted = formatted.replace(/([.!?])\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+\+\d+\s+/g, '$1\n\n');

  // Format "Product Name (Category): description" as markdown bullet list items
  formatted = formatted.replace(
    /([.!?])\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Za-z0-9]+){0,6})\s*\(([^)]{3,60})\)\s*:/g,
    '$1\n\n- **$2** ($3):'
  );

  // Format "Product Name :" or "Product Name:" description as bullet list 
  // (handles spaces before colons and up to 5 word brand names)
  formatted = formatted.replace(
    /([.!?])\s+([A-Z][A-Za-z0-9]+(?:[\s-][A-Za-z0-9]+){0,5})\s*:/g,
    '$1\n\n- **$2**:'
  );

  // Format standalone section headers after sentence end: "Key Considerations:" "Ease of Deployment:"
  formatted = formatted.replace(
    /([.!?])\s+((?!For\s)(?:[A-Z][a-z]+\s+){1,3}(?:\([A-Z]+\)\s*)?[A-Za-z]*)\s*:/g,
    '$1\n\n### $2\n\n'
  );

  // Format "For [Reason]:" lines as bullet points
  formatted = formatted.replace(
    /([.!?])\s+(For\s+[^:]+)\s*:/g,
    '$1\n\n- **$2**:'
  );

  return formatted.trim();
}

const DOMAIN_TYPES: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  owned: { label: "Owned", color: "text-emerald-700", bg: "bg-emerald-100", dot: "#10b981" },
  competitor: { label: "Competitor", color: "text-red-700", bg: "bg-red-100", dot: "#ef4444" },
  ugc: { label: "UGC", color: "text-cyan-700", bg: "bg-cyan-100", dot: "#06b6d4" },
  editorial: { label: "Editorial", color: "text-purple-700", bg: "bg-purple-100", dot: "#a855f7" },
  review: { label: "Review", color: "text-yellow-700", bg: "bg-yellow-100", dot: "#eab308" },
  reference: { label: "Reference", color: "text-green-700", bg: "bg-green-100", dot: "#22c55e" },
  institutional: { label: "Institutional", color: "text-blue-700", bg: "bg-blue-100", dot: "#3b82f6" },
  social: { label: "Social", color: "text-pink-700", bg: "bg-pink-100", dot: "#ec4899" },
  ecommerce: { label: "E-commerce", color: "text-orange-700", bg: "bg-orange-100", dot: "#f97316" },
  other: { label: "Other", color: "text-gray-700", bg: "bg-gray-100", dot: "#6b7280" },
};

// Map old/mismatched AI category names to valid DOMAIN_TYPES keys
const normalizeCitationCategory = (cat?: string): string => {
  if (!cat) return 'other';
  const map: Record<string, string> = {
    review_sites: 'review', comparison_sites: 'review', blogs: 'editorial',
    marketplaces: 'ecommerce', directories: 'ecommerce', reference_authority: 'reference',
  };
  return map[cat] || (DOMAIN_TYPES[cat] ? cat : 'other');
};

function classifyDomain(domain: string, clientDomain?: string, competitors?: string[], brandName?: string): string {
  const d = domain.toLowerCase().replace(/^www\./, '');

  // Check if it's the client's own domain
  if (clientDomain && d.includes(clientDomain.toLowerCase().replace(/^www\./, ''))) return "owned";
  // Fallback: Check if brand name is in the domain (e.g. "nike" in "nike.com")
  if (brandName) {
    const normalizedBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedBrand.length > 2 && d.includes(normalizedBrand)) return "owned";
  }

  // Check configured competitors first (exact + normalized matching)
  if (competitors) {
    for (const comp of competitors) {
      if (!comp) continue;
      if (d.includes(comp.toLowerCase().replace(/^www\./, ''))) return "competitor";
      // Normalized: strip TLDs and suffixes from competitor name and check domain
      const compToken = normalizeBrandToken(comp);
      if (compToken.length >= 3 && d.includes(compToken)) return "competitor";
    }
  }

  // E-commerce/Retail
  if (d.includes('amazon') || d.includes('ebay') || d.includes('walmart') || d.includes('flipkart') ||
    d.includes('zappos') || d.includes('footlocker') || d.includes('finishline') || d.includes('dickssporting')) return "ecommerce";

  // Social Media
  if (d.includes('youtube') || d.includes('twitter') || d.includes('x.com') || d.includes('facebook') ||
    d.includes('instagram') || d.includes('tiktok') || d.includes('linkedin') || d.includes('pinterest')) return "social";

  // UGC / Forums
  if (d.includes('reddit') || d.includes('quora') || d.includes('discord') || d.includes('stackoverflow') ||
    d.includes('stackexchange')) return "ugc";

  // Editorial/News/Publishing
  if (d.includes('forbes') || d.includes('techcrunch') || d.includes('wired') || d.includes('nytimes') ||
    d.includes('bbc') || d.includes('cnn') || d.includes('reuters') || d.includes('bloomberg') ||
    d.includes('medium.com')) return "editorial";

  // Review/Directory
  if (d.includes('g2.com') || d.includes('capterra') || d.includes('trustpilot') || d.includes('yelp') ||
    d.includes('tripadvisor') || d.includes('glassdoor') || d.includes('runrepeat')) return "review";

  // Reference/Wiki
  if (d.includes('wikipedia') || d.includes('wiki')) return "reference";

  // Institutional (only .gov and .edu are reliably institutional; .org is too broad)
  if (d.includes('.gov') || d.includes('.edu')) return "institutional";

  return "other";
}


function roundToHundred(items: { key: string; value: number }[]): Map<string, number> {
  const total = items.reduce((sum, it) => sum + it.value, 0);
  if (total === 0) return new Map(items.map(it => [it.key, 0]));
  const rawPcts = items.map(it => ({
    key: it.key,
    raw: (it.value / total) * 100,
    floored: Math.floor((it.value / total) * 100),
    remainder: ((it.value / total) * 100) % 1,
  }));
  const flooredSum = rawPcts.reduce((sum, p) => sum + p.floored, 0);
  let deficit = 100 - flooredSum;
  const sorted = [...rawPcts].sort((a, b) => b.remainder - a.remainder);
  for (const item of sorted) {
    if (deficit <= 0) break;
    item.floored += 1;
    deficit--;
  }
  return new Map(rawPcts.map(p => [p.key, p.floored]));
}

function DonutChart({ value, size = 120, label = "Citations", segments = [] }: { value: number; size?: number; label?: string; segments?: { type: string; count: number }[] }) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.count, 0) || value || 1;

  // Build arcs for each segment
  let currentOffset = 0;
  const arcs = segments.length > 0 ? segments.map(s => {
    const pct = s.count / total;
    const dash = circumference * pct;
    const offset = circumference * currentOffset;
    currentOffset += pct;
    const typeColor = (DOMAIN_TYPES as any)[s.type]?.dot || "#6b7280";
    return { dash, offset, color: typeColor, type: s.type, count: s.count, pct: Math.round(pct * 100) };
  }) : [{ dash: circumference * 0.75, offset: 0, color: "#3b82f6", type: "default", count: value, pct: 100 }];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        {arcs.map((arc, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={arc.color} strokeWidth={strokeWidth} strokeDasharray={`${arc.dash} ${circumference}`} strokeDashoffset={-arc.offset} strokeLinecap="round" className="transition-all duration-500" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </div>
  );
}

function TrendIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0) return <span className="flex items-center gap-0.5 text-green-600 text-xs"><TrendingUp className="h-3 w-3" />+{value}{suffix}</span>;
  if (value < 0) return <span className="flex items-center gap-0.5 text-red-600 text-xs"><TrendingDown className="h-3 w-3" />{value}{suffix}</span>;
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus className="h-3 w-3" />0{suffix}</span>;
}

interface ClientDashboardProps {
  autoRunClientId?: string | null;
  onAutoRunComplete?: () => void;
  onShowLaunchpad?: () => void;
  initialTab?: string;
}

export default function ClientDashboard({ autoRunClientId, onAutoRunComplete, onShowLaunchpad, initialTab }: ClientDashboardProps = {}) {
  const { clients, selectedClient, prompts, auditResults, selectedModels, loading, loadingPromptIds, error, includeTavily, tavilyResults, addClient, updateClient, deleteClient, switchClient, setSelectedModels, setIncludeTavily, runFullAudit, runSinglePrompt, runCampaign, clearResults, addCustomPrompt, addMultiplePrompts, deletePrompt, bulkArchivePrompts, bulkDeletePrompts, reactivatePrompt, clearAllPrompts, updatePrompt, updateBrandTags, updateCompetitors, fetchCompetitors, exportToCSV, exportFullReport, importData, generatePromptsFromKeywords, generateContent, generateVisibilityContent, generateRecommendations, generateOverallRecommendations, fetchSearchVolumes, auditProgress, INDUSTRY_PRESETS: industries, LOCATION_CODES: locations, refreshData, citationMeta, categorizeCitations, verifyCitations, categorizationProgress, setCategorizationProgress, getAIOpportunity } = useClientDashboard();
  const { isAdmin, isAgency, user, role } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "prompts" | "citations" | "sources" | "content" | "schedules" | "future-citations" | "topics" | "insights" | "brands" | "bulk_scheduler" | "traffic" | "cost">(() => {
    // initialTab prop takes priority (e.g. deep-link from Launchpad GA4 button)
    const validTabs = ["overview", "prompts", "citations", "sources", "content", "schedules", "future-citations", "topics", "insights", "brands", "bulk_scheduler", "traffic"];
    if (initialTab && validTabs.includes(initialTab)) return initialTab as any;
    // Restore from localStorage on mount
    try {
      const saved = localStorage.getItem('forzeo_activeTab');
      return (saved && validTabs.includes(saved)) ? saved as any : "overview";
    } catch { return "overview"; }
  });

  // Persist activeTab to localStorage
  useEffect(() => {
    try { localStorage.setItem('forzeo_activeTab', activeTab); } catch { /* quota exceeded — non-critical */ }
  }, [activeTab]);
  // selectedCampaignId removed - Topics tab replaced Campaigns
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [manageBrandsOpen, setManageBrandsOpen] = useState(false);
  const [selectedPromptDetail, setSelectedPromptDetail] = useState<string | null>(null);
  const [editPromptOpen, setEditPromptOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptText, setEditingPromptText] = useState("");
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editingLocationPromptId, setEditingLocationPromptId] = useState<string | null>(null);
  const [editingLocationValue, setEditingLocationValue] = useState<string>("");
  const [sourcesView, setSourcesView] = useState<"domains" | "urls">("domains");
  // categorizationProgress is now provided by the hook (shared between auto-categorize and manual button)
  const [verificationProgress, setVerificationProgress] = useState<{ completed: number; total: number; currentBatch: number; totalBatches: number; running: boolean } | null>(null);
  const [hoveredCitation, setHoveredCitation] = useState<{ domain: string; url: string; mouseX: number; mouseY: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [newTag, setNewTag] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [bulkPromptsOpen, setBulkPromptsOpen] = useState(false);
  const [bulkPrompts, setBulkPrompts] = useState("");
  const [bulkRunProgress, setBulkRunProgress] = useState<{ current: number, total: number } | null>(null);
  const [promptLocation, setPromptLocation] = useState<string>(""); // Empty means use client default
  const [genTone, setGenTone] = useState<string>("neutral");
  const [genFocus, setGenFocus] = useState<string>("general");
  const [seedKeywords, setSeedKeywords] = useState("");
  const [promptTopic, setPromptTopic] = useState("");
  const [inlineEditTopicId, setInlineEditTopicId] = useState<string | null>(null);
  const [inlineEditTopicValue, setInlineEditTopicValue] = useState("");
  const [editingPromptTopic, setEditingPromptTopic] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [runCampaignOpen, setRunCampaignOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contentType, setContentType] = useState<string>("article");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentKeywords, setContentKeywords] = useState("");
  const [contentTopic, setContentTopic] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatingContent, setGeneratingContent] = useState(false);

  // Content history — persisted per client in localStorage
  const [generatedContentHistory, setGeneratedContentHistory] = useState<import('@/components/tabs/ContentTab').GeneratedContentHistoryItem[]>(() => {
    try {
      const key = `forzeo_content_history_${selectedClient?.id || 'default'}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const ga4 = useGA4Connector(selectedClient?.id);
  const { integration, totalLLMSessionsLast7, trafficData } = ga4;

  // Reload history when client changes
  useEffect(() => {
    try {
      const key = `forzeo_content_history_${selectedClient?.id || 'default'}`;
      const saved = localStorage.getItem(key);
      setGeneratedContentHistory(saved ? JSON.parse(saved) : []);
    } catch { setGeneratedContentHistory([]); }
  }, [selectedClient?.id]);

  const saveToContentHistory = (item: import('@/components/tabs/ContentTab').GeneratedContentHistoryItem) => {
    setGeneratedContentHistory(prev => {
      const updated = [item, ...prev].slice(0, 50); // cap at 50 items
      try {
        const key = `forzeo_content_history_${selectedClient?.id || 'default'}`;
        localStorage.setItem(key, JSON.stringify(updated));
      } catch { /* quota */ }
      return updated;
    });
  };

  const deleteContentHistoryItem = (id: string) => {
    setGeneratedContentHistory(prev => {
      const updated = prev.filter(x => x.id !== id);
      try {
        const key = `forzeo_content_history_${selectedClient?.id || 'default'}`;
        localStorage.setItem(key, JSON.stringify(updated));
      } catch { /* quota */ }
      return updated;
    });
  };
  const [showBrandOnly, setShowBrandOnly] = useState(false);
  const [sovTimeRange, setSovTimeRange] = useState<"week" | "month" | "year">("week");
  const [dateRangeFilter, setDateRangeFilter] = useState<"7d" | "30d" | "90d" | "all" | "custom">("all");
  const [customDateStart, setCustomDateStart] = useState<string>("");
  const [customDateEnd, setCustomDateEnd] = useState<string>("");
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [promptsTabView, setPromptsTabView] = useState<"active" | "suggested" | "inactive">("active");
  const [sourcesGapView, setSourcesGapView] = useState<"all" | "gap">("all");
  const [sourcesTypeFilter, setSourcesTypeFilter] = useState<string>("all");
  const [sourcesModelFilter, setSourcesModelFilter] = useState<string[]>([]);
  const [sourcesModelFilterOpen, setSourcesModelFilterOpen] = useState(false);
  const [sourcesPage, setSourcesPage] = useState(0);
  const SOURCES_PAGE_SIZE = 25;
  const [newClientForm, setNewClientForm] = useState({ name: "", brand_name: "", target_region: "United States", industry: "Custom", customIndustry: "", competitors: "", primary_color: "#0372ff", logo_url: "", website: "" });
  const [editClientForm, setEditClientForm] = useState({ name: "", brand_name: "", target_region: "United States", industry: "Custom", customIndustry: "", primary_color: "#0372ff", logo_url: "", competitors: "", website: "" });
  const [isAutoFinding, setIsAutoFinding] = useState(false);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [generatingAiInsights, setGeneratingAiInsights] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);


  // Recommendations modal state
  const [recsModalOpen, setRecsModalOpen] = useState(false);
  const [recsModalPromptId, setRecsModalPromptId] = useState<string | null>(null);
  const [recsModalLoading, setRecsModalLoading] = useState(false);
  const [recsModalData, setRecsModalData] = useState<import('@/hooks/useClientDashboard').PromptInsightRecommendation[] | null>(null);

  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Prompts Tab Filters
  const [promptsFilterModel, setPromptsFilterModel] = useState<string>("all");
  const [promptsFilterVisibility, setPromptsFilterVisibility] = useState<"all" | "visible" | "not_visible">("all");
  const [promptsFilterCompetitor, setPromptsFilterCompetitor] = useState<string>("all");
  const [promptSortField, setPromptSortField] = useState<string | null>(null);

  // Prompt multi-select for bulk actions
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());

  // Brand Visibility View All modal
  const [showBrandVisibilityModal, setShowBrandVisibilityModal] = useState(false);

  // Auto-run prompts after onboarding creates a new brand
  const autoRunTriggeredRef = useRef(false);
  useEffect(() => {
    if (!autoRunClientId || autoRunTriggeredRef.current) return;

    // If we haven't loaded the right client yet, switch to it
    if (selectedClient?.id !== autoRunClientId) {
      const targetClient = clients.find(c => c.id === autoRunClientId);
      if (targetClient) {
        switchClient(targetClient);
      } else {
        // Client not in list yet — dashboard may still be loading. 
        // Refresh to pick up the new client.
        refreshData();
      }
      return; // Wait for next render when selectedClient matches
    }

    // Now the right client is selected — wait for prompts to load
    if (prompts.length > 0 && !loading) {
      console.log('[AutoRun] Triggering runFullAudit for new brand:', autoRunClientId, `(${prompts.length} prompts)`);
      toast.info(`Auto-starting audit for ${prompts.length} prompts...`);
      autoRunTriggeredRef.current = true;
      // Small delay to let UI render first
      setTimeout(() => {
        runFullAudit();
        onAutoRunComplete?.();
      }, 1500);
    }
  }, [autoRunClientId, selectedClient?.id, clients, prompts.length, loading]);


  const filteredAuditResults = useMemo(() => {
    let results = auditResults;
    if (dateRangeFilter === "custom") {
      // Auto-swap if start > end
      let effectiveStart = customDateStart;
      let effectiveEnd = customDateEnd;
      if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
        [effectiveStart, effectiveEnd] = [effectiveEnd, effectiveStart];
      }
      if (effectiveStart) { const start = new Date(effectiveStart); results = results.filter(r => new Date(r.created_at) >= start); }
      if (effectiveEnd) { const end = new Date(effectiveEnd); end.setHours(23, 59, 59, 999); results = results.filter(r => new Date(r.created_at) <= end); }
    } else if (dateRangeFilter !== "all") { const now = new Date(); const days = dateRangeFilter === "7d" ? 7 : dateRangeFilter === "30d" ? 30 : 90; const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000); results = results.filter(r => new Date(r.created_at) >= cutoff); }
    if (modelFilter.length > 0) { results = results.map(r => ({ ...r, model_results: r.model_results.filter(mr => modelFilter.includes(mr.model)) })).filter(r => r.model_results.length > 0); }
    return results;
  }, [auditResults, dateRangeFilter, modelFilter, customDateStart, customDateEnd]);

  const allCitations = useMemo(() => {
    const citationMap = new Map<string, { url: string; title: string; domain: string; count: number; prompts: string[]; models: Set<string> }>();
    for (const result of filteredAuditResults) { for (const mr of result.model_results) { for (const c of mr.citations) { const key = c.url; if (citationMap.has(key)) { const existing = citationMap.get(key)!; existing.count++; existing.models.add(mr.model); if (!existing.prompts.includes(result.prompt_text)) existing.prompts.push(result.prompt_text); } else { citationMap.set(key, { ...c, count: 1, prompts: [result.prompt_text], models: new Set([mr.model]) }); } } } }
    return Array.from(citationMap.values()).map(c => ({ ...c, models: Array.from(c.models) })).sort((a, b) => b.count - a.count);
  }, [filteredAuditResults]);

  const modelStats = useMemo(() => {
    const stats: Record<string, { visible: number; total: number; cost: number }> = {};
    AI_MODELS.forEach(model => { stats[model.id] = { visible: 0, total: 0, cost: 0 }; });
    filteredAuditResults.forEach(result => { result.model_results.forEach(mr => { if (stats[mr.model]) { stats[mr.model].total++; if (mr.brand_mentioned) stats[mr.model].visible++; stats[mr.model].cost += mr.api_cost; } }); });
    return stats;
  }, [filteredAuditResults]);

  // Fetch notifications for admin users
  useEffect(() => {
    if (!user || role !== 'admin') return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();
  }, [user, role]);

  const markNotificationsAsRead = async () => {
    if (unreadCount === 0 || !user) return;

    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  };

  const competitorGap = useMemo(() => {
    if (!selectedClient) return [];
    const mentions: Record<string, number> = {}; mentions[selectedClient.brand_name] = 0; selectedClient.competitors.forEach(c => { mentions[c] = 0; });
    filteredAuditResults.forEach(result => { result.model_results.forEach(mr => { const response = mr.raw_response?.toLowerCase() || ""; if (mr.brand_mentioned) mentions[selectedClient.brand_name] += mr.brand_mention_count; selectedClient.competitors.forEach(comp => { const regex = new RegExp(comp.toLowerCase(), "gi"); const matches = response.match(regex); if (matches) mentions[comp] += matches.length; }); }); });
    const total = Object.values(mentions).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(mentions).map(([name, count]) => ({ name, mentions: count, percentage: Math.round((count / total) * 100) })).sort((a, b) => b.mentions - a.mentions);
  }, [selectedClient, filteredAuditResults]);

  const sovTimeSeries = useMemo(() => {
    if (!selectedClient) return { labels: [] as string[], series: [] as Array<{ name: string; isClient: boolean; domain: string; data: (number | null)[] }> };

    const brandName = selectedClient.brand_name;
    const brandDomain = selectedClient.brand_domain || `${brandName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    const competitors = selectedClient.competitors || [];
    const allBrands = [brandName, ...competitors];

    const now = new Date();

    // Use LOCAL date key (not UTC) to avoid timezone shift for IST (+5:30) users
    const localDateKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const localMonthKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    };

    let cutoff: Date;
    let bucketFn: (d: Date) => string;
    let labelFn: (k: string) => string;

    if (sovTimeRange === "week") {
      cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      bucketFn = localDateKey;
      labelFn = (k) => new Date(k + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (sovTimeRange === "month") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      bucketFn = localDateKey;
      labelFn = (k) => new Date(k + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else {
      cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      bucketFn = localMonthKey;
      labelFn = (k) => { const [y, m] = k.split("-"); return new Date(+y, +m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }); };
    }

    let results = auditResults.filter(r => new Date(r.created_at) >= cutoff);
    // Apply model filter if active (SOV chart uses its own time range but should respect model filter)
    if (modelFilter.length > 0) {
      results = results.map(r => ({ ...r, model_results: r.model_results.filter(mr => modelFilter.includes(mr.model)) })).filter(r => r.model_results.length > 0);
    }
    // Count mentions per bucket using actual mention counts (matching KPI card / competitorGap logic)
    const buckets: Record<string, Record<string, number>> = {};

    results.forEach(result => {
      const bucket = bucketFn(new Date(result.created_at));
      if (!buckets[bucket]) {
        buckets[bucket] = {};
        allBrands.forEach(b => { buckets[bucket][b] = 0; });
      }
      result.model_results.forEach(mr => {
        // Use actual mention count (matches competitorGap / detailedBrandStats boxes)
        if (mr.brand_mentioned) {
          buckets[bucket][brandName] = (buckets[bucket][brandName] || 0) + (mr.brand_mention_count || 1);
        }
        // Count actual competitor mentions (not binary)
        const response = mr.raw_response?.toLowerCase() || "";
        competitors.forEach(comp => {
          const regex = new RegExp(comp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase(), "gi");
          const matches = response.match(regex);
          if (matches) {
            buckets[bucket][comp] = (buckets[bucket][comp] || 0) + matches.length;
          }
        });
      });
    });

    // Use only dates that have data, plus fill any gaps between first and last
    const dataKeys = Object.keys(buckets).sort();
    if (dataKeys.length === 0) return { labels: [] as string[], series: [] as Array<{ name: string; isClient: boolean; domain: string; data: (number | null)[] }> };

    const allKeys: string[] = [];
    const todayKey = localDateKey(now);
    const currentMonthKey = localMonthKey(now);

    if (sovTimeRange === "year") {
      const first = dataKeys[0];
      const [fy, fm] = first.split("-").map(Number);
      const [cy, cm] = currentMonthKey.split("-").map(Number);
      const cur = new Date(fy, fm - 1, 1);
      const end = new Date(cy, cm - 1, 1); // Always end at current month
      while (cur <= end) {
        allKeys.push(localMonthKey(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      // Always start from the earliest data point but extend to TODAY (in local time)
      const startKey = dataKeys[0];
      const cur = new Date(startKey + "T00:00:00");
      const end = new Date(todayKey + "T00:00:00"); // Always today, not last data point
      while (cur <= end) {
        allKeys.push(localDateKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    const labels = allKeys.map(labelFn);

    const competitorTotals = competitors
      .map(c => ({ name: c, total: allKeys.reduce((sum, k) => sum + (buckets[k]?.[c] || 0), 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const trackedBrands = [brandName, ...competitorTotals.map(c => c.name)];

    const series = trackedBrands.map(brand => ({
      name: brand,
      isClient: brand === brandName,
      domain: brand === brandName ? brandDomain : `${brand.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      data: (() => {
        let lastVal: number = 0;
        return allKeys.map(k => {
          const bucket = buckets[k];
          if (bucket) {
            const total = Object.values(bucket).reduce((a, b) => a + b, 0);
            if (total > 0) {
              lastVal = Math.round(((bucket[brand] || 0) / total) * 100);
            }
          }
          return lastVal;
        });
      })(),
    }));


    return { labels, series };
  }, [selectedClient, auditResults, sovTimeRange, modelFilter]);

  const detailedBrandStats = useMemo(() => {
    if (!selectedClient) return [];

    // Initialize stats for client brand and competitors
    const stats: Record<string, {
      mentions: number;
      totalRank: number;
      rankCount: number;
      auditsWithMentions: number;
    }> = {};

    const allBrands = [selectedClient.brand_name, ...selectedClient.competitors];
    allBrands.forEach(b => {
      stats[b] = { mentions: 0, totalRank: 0, rankCount: 0, auditsWithMentions: 0 };
    });

    let totalMentionsAllBrands = 0;

    filteredAuditResults.forEach(result => {
      const brandsFoundInThisAudit = new Set<string>();

      result.model_results.forEach(mr => {
        const response = mr.raw_response?.toLowerCase() || "";

        // Client Brand Stats
        if (mr.brand_mentioned) {
          if (stats[selectedClient.brand_name]) {
            stats[selectedClient.brand_name].mentions += mr.brand_mention_count;
            totalMentionsAllBrands += mr.brand_mention_count;
            brandsFoundInThisAudit.add(selectedClient.brand_name);

            // Try to get rank
            let rank = mr.brand_rank;
            if (!rank && mr.raw_response) {
              const { brandRank } = cleanAndAnalyzeResponse(mr.raw_response, selectedClient.brand_name, selectedClient.competitors, selectedClient.brand_tags);
              rank = brandRank;
            }
            if (rank) {
              stats[selectedClient.brand_name].totalRank += rank;
              stats[selectedClient.brand_name].rankCount++;
            }
          }
        }

        // Competitor Stats
        selectedClient.competitors.forEach(comp => {
          if (!stats[comp]) return;

          // Check mentions using normalized matching (handles "monday.com" vs "Monday" etc.)
          const mentioned = brandMentionedInText(mr.raw_response || '', comp);
          if (mentioned) {
            // Count exact mentions
            const regex = new RegExp(`(?:^|[^a-z0-9])${comp.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`, "gi");
            const matches = response.match(regex);
            const mentionCount = matches ? matches.length : 1; // At least 1 since brandMentionedInText matched
            stats[comp].mentions += mentionCount;
            totalMentionsAllBrands += mentionCount;
            brandsFoundInThisAudit.add(comp);

            // Check rank (from competitors_found or parse new)
            let rank: number | null = null;
            if (mr.competitors_found) {
              // Use normalized matching to find the competitor in competitors_found
              const cf = mr.competitors_found.find(c => brandNamesMatch(c.name, comp));
              if (cf && cf.rank) rank = cf.rank;
            }

            if (!rank) {
              // Parse rank from text if not in metadata
              const { competitorStats } = cleanAndAnalyzeResponse(mr.raw_response || "", selectedClient.brand_name, selectedClient.competitors, selectedClient.brand_tags);
              const cs = competitorStats.find(c => brandNamesMatch(c.name, comp));
              if (cs && cs.rank) rank = cs.rank;
            }

            if (rank) {
              stats[comp].totalRank += rank;
              stats[comp].rankCount++;
            }
          }
        });
      });

      // Increment audit presence for brands found in this audit
      brandsFoundInThisAudit.forEach(brand => {
        if (stats[brand]) {
          stats[brand].auditsWithMentions++;
        }
      });
    });

    // Format final array
    return Object.entries(stats).map(([name, data]) => ({
      name,
      mentions: data.mentions,
      percentage: totalMentionsAllBrands > 0 ? Math.round((data.mentions / totalMentionsAllBrands) * 100) : 0,
      avgRank: data.rankCount > 0 ? Math.round((data.totalRank / data.rankCount) * 10) / 10 : null,
      auditPresence: data.auditsWithMentions
    })).sort((a, b) => b.percentage - a.percentage);
  }, [selectedClient, filteredAuditResults]);

  const filteredPromptsByTab = useMemo(() => {
    const activePrompts = prompts.filter(p => p.is_active !== false);
    const inactivePrompts = prompts.filter(p => p.is_active === false);
    const runPromptIds = new Set(auditResults.map(r => r.prompt_id));
    const suggestedPrompts = activePrompts.filter(p => !runPromptIds.has(p.id));
    switch (promptsTabView) { case "active": return activePrompts; case "suggested": return suggestedPrompts; case "inactive": return inactivePrompts; default: return activePrompts; }
  }, [prompts, auditResults, promptsTabView]);

  const filteredPrompts = useMemo(() => {
    let result = !searchQuery ? filteredPromptsByTab : filteredPromptsByTab.filter(p => p.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()));

    // Apply filters
    if (promptsFilterModel !== "all") {
      result = result.filter(p => {
        const r = auditResults.find(ar => ar.prompt_id === p.id);
        return r?.model_results.some(mr => mr.model === promptsFilterModel) ?? false;
      });
    }

    if (promptsFilterVisibility !== "all") {
      result = result.filter(p => {
        const r = auditResults.find(ar => ar.prompt_id === p.id);
        if (!r) return false;
        // Check if brand mentioned in ANY model
        const isVisible = r.model_results.some(mr => {
          if (mr.brand_mentioned) return true;
          if (selectedClient && mr.raw_response) {
            return brandMentionedInText(mr.raw_response, selectedClient.brand_name, selectedClient.brand_tags || []);
          }
          return false;
        });
        return promptsFilterVisibility === "visible" ? isVisible : !isVisible;
      });
    }

    if (promptsFilterCompetitor !== "all") {
      result = result.filter(p => {
        const r = auditResults.find(ar => ar.prompt_id === p.id);
        if (!r) return false;
        // Also check competitors_found array in addition to text search
        return r.model_results.some(mr => {
          if (mr.competitors_found?.some(c => c.name.toLowerCase() === promptsFilterCompetitor.toLowerCase() && c.count > 0)) return true;
          return mr.raw_response && brandMentionedInText(mr.raw_response, promptsFilterCompetitor);
        });
      });
    }

    // Apply AI Opportunity sorting if active
    if (promptSortField === 'ai_opportunity') {
      result = [...result].sort((a, b) => getAIOpportunity(b.id).score - getAIOpportunity(a.id).score);
    }

    return result;
  }, [filteredPromptsByTab, searchQuery, promptsFilterModel, promptsFilterVisibility, promptsFilterCompetitor, auditResults, promptSortField, getAIOpportunity]);
  const pendingPrompts = prompts.filter(p => p.is_active !== false && !auditResults.find(r => r.prompt_id === p.id)).length;

  const getPromptResult = (promptId: string) => filteredAuditResults.find(r => r.prompt_id === promptId);

  // Topics aggregation (must be at top level, not inside conditional TopicsTab)
  const topicData = useMemo(() => {
    const grouped: Record<string, typeof prompts> = {};
    prompts.filter(p => p.is_active !== false && p.topic).forEach(p => {
      const key = p.topic!;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const topicEntries = Object.entries(grouped).map(([topic, topicPrompts]) => {
      let totalVisible = 0, totalModels = 0, totalCitations = 0;
      const allPositions: number[] = [];
      const brandFreqMap = new Map<string, number>();
      let totalSearchVolume = 0;
      let hasSearchVolume = false;

      topicPrompts.forEach(p => {
        const r = getPromptResult(p.id);
        if (!r) return;
        const visibleCount = r.model_results.filter(mr => mr.brand_mentioned).length;
        totalVisible += visibleCount;
        totalModels += r.model_results.length;
        totalCitations += r.summary.total_citations;
        const pos = computePositionForResult(r, selectedClient);
        if (pos) allPositions.push(pos);
        r.model_results.forEach(mr => {
          const response = (mr.raw_response || '').toLowerCase();
          (selectedClient?.competitors || []).forEach(comp => {
            if (response.includes(comp.toLowerCase())) brandFreqMap.set(comp, (brandFreqMap.get(comp) || 0) + 1);
          });
        });
        if (p.estimated_search_volume != null) { totalSearchVolume += p.estimated_search_volume; hasSearchVolume = true; }
      });

      const avgPosition = allPositions.length > 0
        ? Math.round(allPositions.reduce((a, b) => a + b, 0) / allPositions.length * 10) / 10 : null;

      // Compute best AI Opportunity tier for this topic group
      const topicOpScores = topicPrompts.map(p => getAIOpportunity(p.id));
      const bestOpScore = topicOpScores.length > 0 ? Math.max(...topicOpScores.map(o => o.score)) : 0;
      const bestOp = topicOpScores.find(o => o.score === bestOpScore) || { score: 0, tier: 'Minimal', color: '#9ca3af' };

      return {
        topic, promptCount: topicPrompts.length, prompts: topicPrompts,
        visibility: totalModels > 0 ? `${totalVisible}/${totalModels}` : "—",
        visibilityPct: totalModels > 0 ? Math.round((totalVisible / totalModels) * 100) : 0,
        avgPosition, citations: totalCitations,
        brands: Array.from(brandFreqMap.keys()),
        brandFrequencies: Object.fromEntries(brandFreqMap),
        searchVolume: hasSearchVolume ? totalSearchVolume : null,
        aiOpportunity: bestOp,
      };
    }).sort((a, b) => b.promptCount - a.promptCount);

    const sorted = [...topicEntries];

    // Add "Others" group for prompts without topics
    const othersPrompts = prompts.filter(p => p.is_active !== false && !p.topic);
    if (othersPrompts.length > 0) {
      let totalVisible = 0, totalModels = 0, totalCitations = 0;
      const allPositions: number[] = [];
      const brandFreqMap = new Map<string, number>();
      let totalSearchVolume = 0;
      let hasSearchVolume = false;

      othersPrompts.forEach(p => {
        const r = getPromptResult(p.id);
        if (!r) return;
        const visibleCount = r.model_results.filter(mr => mr.brand_mentioned).length;
        totalVisible += visibleCount;
        totalModels += r.model_results.length;
        totalCitations += r.summary.total_citations;
        const pos = computePositionForResult(r, selectedClient);
        if (pos) allPositions.push(pos);
        r.model_results.forEach(mr => {
          const response = (mr.raw_response || '').toLowerCase();
          (selectedClient?.competitors || []).forEach(comp => {
            if (response.includes(comp.toLowerCase())) brandFreqMap.set(comp, (brandFreqMap.get(comp) || 0) + 1);
          });
        });
        if (p.estimated_search_volume != null) { totalSearchVolume += p.estimated_search_volume; hasSearchVolume = true; }
      });

      const avgPosition = allPositions.length > 0
        ? Math.round(allPositions.reduce((a, b) => a + b, 0) / allPositions.length * 10) / 10 : null;

      const othersOpScores = othersPrompts.map(p => getAIOpportunity(p.id));
      const othersBestScore = othersOpScores.length > 0 ? Math.max(...othersOpScores.map(o => o.score)) : 0;
      const othersBestOp = othersOpScores.find(o => o.score === othersBestScore) || { score: 0, tier: 'Minimal', color: '#9ca3af' };

      sorted.push({
        topic: "Others", promptCount: othersPrompts.length, prompts: othersPrompts,
        visibility: totalModels > 0 ? `${totalVisible}/${totalModels}` : "—",
        visibilityPct: totalModels > 0 ? Math.round((totalVisible / totalModels) * 100) : 0,
        avgPosition, citations: totalCitations,
        brands: Array.from(brandFreqMap.keys()),
        brandFrequencies: Object.fromEntries(brandFreqMap),
        searchVolume: hasSearchVolume ? totalSearchVolume : null,
        aiOpportunity: othersBestOp,
      });
    }

    return sorted;
  }, [prompts, auditResults, selectedClient]);

  const unassignedPrompts = prompts.filter(p => p.is_active !== false && !p.topic);

  const domainStats = useMemo(() => {
    const stats: Record<string, { count: number; type: string; avg: number; models: Set<string>; prompts: Map<string, { text: string; visible: boolean; competitors: Set<string> }> }> = {};
    filteredAuditResults.forEach(result => {
      const pText = result.prompt_text;
      result.model_results.forEach(mr => {
        const response = mr.raw_response?.toLowerCase() || "";
        const mentionedComps = selectedClient?.competitors.filter(c => response.includes(c.toLowerCase())) || [];

        mr.citations.forEach(c => {
          // Use AI category if available, else fallback to static
          const aiType = normalizeCitationCategory(citationMeta?.[c.domain]?.category);
          const staticType = classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name);
          const finalType = (aiType && aiType !== 'other') ? aiType : staticType;

          if (!stats[c.domain]) stats[c.domain] = { count: 0, type: finalType, avg: 0, models: new Set(), prompts: new Map() };
          stats[c.domain].count++;
          stats[c.domain].models.add(mr.model);

          // If AI type is newly available, update existing entry
          if (stats[c.domain].type !== finalType) {
            stats[c.domain].type = finalType;
          }

          if (!stats[c.domain].prompts.has(pText)) {
            stats[c.domain].prompts.set(pText, { text: pText, visible: false, competitors: new Set() });
          }
          const pInfo = stats[c.domain].prompts.get(pText)!;
          if (mr.brand_mentioned) pInfo.visible = true;
          mentionedComps.forEach(comp => pInfo.competitors.add(comp));
        });
      });
    });
    const total = filteredAuditResults.length || 1;
    Object.keys(stats).forEach(d => { stats[d].avg = Math.round((stats[d].count / total) * 10) / 10; });
    return Object.entries(stats).map(([domain, data]) => ({
      domain,
      count: data.count,
      type: data.type,
      avg: data.avg,
      models: Array.from(data.models),
      promptCount: data.prompts.size,
      prompts: Array.from(data.prompts.values()).map(p => ({
        text: p.text,
        visible: p.visible,
        competitors: Array.from(p.competitors)
      }))
    })).sort((a, b) => b.count - a.count);
  }, [filteredAuditResults, selectedClient, citationMeta]);

  // Group citations by domain type for pie chart
  const typeSegments = useMemo(() => {
    const typeMap: Record<string, number> = {};
    domainStats.forEach(d => {
      if (!typeMap[d.type]) typeMap[d.type] = 0;
      typeMap[d.type] += d.count;
    });
    return Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [domainStats]);

  const recentPrompts = useMemo(() => filteredAuditResults.slice(0, 9).map(r => { const p = prompts.find(x => x.id === r.prompt_id); return { ...r, prompt_text: p?.prompt_text || r.prompt_text }; }), [filteredAuditResults, prompts]);

  // Sources Tab State & Logic (Lifted to fix hooks)
  const [sourceSearch, setSourceSearch] = useState("");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const modelFilteredDomainStats = useMemo(() => sourcesModelFilter.length === 0 ? domainStats : domainStats.filter(s => s.models.some(m => sourcesModelFilter.includes(m))), [domainStats, sourcesModelFilter]);
  const modelFilteredCitations = useMemo(() => sourcesModelFilter.length === 0 ? allCitations : allCitations.filter(c => c.models.some(m => sourcesModelFilter.includes(m))), [allCitations, sourcesModelFilter]);
  const filteredDomainStats = useMemo(() => !sourceSearch ? modelFilteredDomainStats : modelFilteredDomainStats.filter(s => s.domain.toLowerCase().includes(sourceSearch.toLowerCase())), [modelFilteredDomainStats, sourceSearch]);
  const filteredUrlCitations = useMemo(() => !sourceSearch ? modelFilteredCitations : modelFilteredCitations.filter(c => c.url.toLowerCase().includes(sourceSearch.toLowerCase()) || c.domain.toLowerCase().includes(sourceSearch.toLowerCase()) || c.title?.toLowerCase().includes(sourceSearch.toLowerCase())), [modelFilteredCitations, sourceSearch]);
  const gapDomains = useMemo(() => { if (!selectedClient) return []; const brandDomains = new Set<string>(); const competitorDomains = new Map<string, Set<string>>(); filteredAuditResults.forEach(result => { result.model_results.forEach(mr => { if (sourcesModelFilter.length > 0 && !sourcesModelFilter.includes(mr.model)) return; const response = mr.raw_response?.toLowerCase() || ""; const hasBrand = mr.brand_mentioned; mr.citations.forEach(c => { if (hasBrand) brandDomains.add(c.domain); selectedClient.competitors.forEach(comp => { if (response.includes(comp.toLowerCase())) { if (!competitorDomains.has(c.domain)) competitorDomains.set(c.domain, new Set()); competitorDomains.get(c.domain)!.add(comp); } }); }); }); }); return Array.from(competitorDomains.entries()).filter(([domain]) => !brandDomains.has(domain)).map(([domain, competitors]) => ({ domain, competitors: Array.from(competitors) })).slice(0, 20); }, [selectedClient, filteredAuditResults, sourcesModelFilter]);
  const displayedStats = sourcesGapView === "gap" ? gapDomains.map(g => { const stat = modelFilteredDomainStats.find(s => s.domain === g.domain); return stat ? { ...stat, gapCompetitors: g.competitors } : null; }).filter(Boolean) : filteredDomainStats;
  const exportSources = () => { if (sourcesView === "domains") { if (domainStats.length === 0) return; const rows = [["Domain", "Type", "Citations", "Prompts"]]; for (const s of domainStats) { rows.push([s.domain, s.type, s.count.toString(), s.promptCount.toString()]); } const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `sources-domains-${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url); } else { if (allCitations.length === 0) return; const rows = [["URL", "Title", "Domain", "Type", "Count", "Prompts"]]; for (const c of allCitations) { rows.push([c.url, c.title || "", c.domain, classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name), c.count.toString(), c.prompts.join("; ")]); } const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `sources-urls-${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url); } };

  // Citations Tab State & Logic (Lifted to fix hooks)
  const [citationSearch, setCitationSearch] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const filteredCitations = useMemo(() => !citationSearch ? allCitations : allCitations.filter(c => c.url.toLowerCase().includes(citationSearch.toLowerCase()) || c.domain.toLowerCase().includes(citationSearch.toLowerCase()) || c.title?.toLowerCase().includes(citationSearch.toLowerCase())), [allCitations, citationSearch]);
  const citationsByPrompt = useMemo(() => { const map: Record<string, typeof allCitations> = {}; filteredAuditResults.forEach(r => { const promptCitations: typeof allCitations = []; r.model_results.forEach(mr => { mr.citations.forEach(c => { promptCitations.push({ ...c, count: 1, prompts: [r.prompt_text], models: [mr.model] }); }); }); if (promptCitations.length > 0) map[r.prompt_id] = promptCitations; }); return map; }, [filteredAuditResults]);
  const exportCitations = () => { if (allCitations.length === 0) return; const rows = [["URL", "Title", "Domain", "Type", "Count", "Prompts"]]; for (const c of allCitations) { rows.push([c.url, c.title || "", c.domain, classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name), c.count.toString(), c.prompts.join("; ")]); } const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `citations-${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url); };

  const handleAddPrompt = async () => {
    if (newPrompt.trim()) {
      try {
        const locationCode = promptLocation ? locations[promptLocation] : undefined;
        const locationName = promptLocation || undefined;
        const newPromptObj = await addCustomPrompt(newPrompt.trim(), undefined, locationCode, locationName, promptTopic.trim() || undefined);
        setNewPrompt("");
        setPromptLocation(""); // Reset location after adding

        // Auto-run audit for all users (admin or not)
        if (newPromptObj) {
          toast.info("🚀 Prompt added! Running audit automatically...");
          setTimeout(() => runSinglePrompt(newPromptObj), 500); // Pass object directly
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to add prompt.");
        // Keep input value so user can retry
      }
    }
  };
  // Helper function to parse bulk prompts with proper handling of quoted multi-line strings
  const parseBulkPrompts = (input: string): string[] => {
    const results: string[] = [];
    const text = input.trim();
    if (!text) return results;

    let i = 0;
    let currentPrompt = '';
    let inQuote = false;
    let quoteChar = '';

    while (i < text.length) {
      const char = text[i];

      // Check for quote start/end
      if ((char === '"' || char === "'") && !inQuote) {
        // Starting a quoted prompt - save any current unquoted prompt first
        if (currentPrompt.trim().length > 0) {
          results.push(currentPrompt.replace(/\s+/g, ' ').trim());
        }
        currentPrompt = '';
        inQuote = true;
        quoteChar = char;
        i++;
        continue;
      }

      if (inQuote && char === quoteChar) {
        // Ending a quoted prompt
        if (currentPrompt.trim().length > 0) {
          results.push(currentPrompt.replace(/\s+/g, ' ').trim());
        }
        currentPrompt = '';
        inQuote = false;
        quoteChar = '';
        i++;
        continue;
      }

      // Handle newlines
      if (char === '\n' && !inQuote) {
        // Not in a quote - newline ends the current prompt
        if (currentPrompt.trim().length > 0) {
          results.push(currentPrompt.replace(/\s+/g, ' ').trim());
        }
        currentPrompt = '';
        i++;
        continue;
      }

      // Add character to current prompt (convert newlines in quotes to spaces)
      if (char === '\n' && inQuote) {
        currentPrompt += ' ';
      } else {
        currentPrompt += char;
      }
      i++;
    }

    // Don't forget the last prompt
    if (currentPrompt.trim().length > 0) {
      results.push(currentPrompt.replace(/\s+/g, ' ').trim());
    }

    return results;
  };

  const handleBulkAdd = async () => {
    if (bulkPrompts.trim()) {
      try {
        const promptTexts = parseBulkPrompts(bulkPrompts);
        const locationCode = promptLocation ? locations[promptLocation] : undefined;
        const locationName = promptLocation || undefined;
        await addMultiplePrompts(promptTexts, undefined, locationCode, locationName, promptTopic.trim() || undefined);
        setBulkPrompts("");
        setBulkPromptsOpen(false);
        setPromptLocation(""); // Reset location after adding
        setPromptTopic(""); // Reset topic after adding

        // Auto-run full audit for non-admin users after bulk add
        if (!isAdmin && promptTexts.length > 0) {
          toast.info(`🚀 ${promptTexts.length} prompts added! Running audits automatically...`);
          setTimeout(() => runFullAudit(), 500);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to add prompts.");
      }
    }
  };
  const handleSaveLocation = async () => {
    if (!editingLocationPromptId) return;
    try {
      const locationCode = editingLocationValue && editingLocationValue !== "__default__" ? locations[editingLocationValue] : undefined;
      const locationName = editingLocationValue && editingLocationValue !== "__default__" ? editingLocationValue : undefined;
      await updatePrompt(editingLocationPromptId, { location_code: locationCode, location_name: locationName });
      setEditLocationOpen(false);
      setEditingLocationPromptId(null);
      setEditingLocationValue("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update location.");
    }
  };
  const handleGeneratePrompts = async () => {
    if (!seedKeywords.trim()) return;
    setGeneratingPrompts(true);
    try {
      const g = await generatePromptsFromKeywords(seedKeywords, {
        sentiment: genTone,
        focus: genFocus,
        competitors: (selectedClient?.competitors || []) // auto-include client competitors if any, or empty array
      });
      if (g?.length) {
        const locationCode = promptLocation ? locations[promptLocation] : undefined;
        const locationName = promptLocation || undefined;
        // Auto-assign seed keyword as topic for AI-generated prompts
        const topicForGenerated = promptTopic.trim() || seedKeywords.trim();
        const newPrompts = await addMultiplePrompts(g, undefined, locationCode, locationName, topicForGenerated || undefined);
        setSeedKeywords("");
        setPromptTopic(""); // Reset topic after generating

        if (newPrompts && newPrompts.length > 0) {
          toast.info(`Running audit for ${newPrompts.length} new prompts...`);
          setTimeout(() => runFullAudit(newPrompts), 500);
        }
      }
    } finally {
      setGeneratingPrompts(false);
    }
  };
  const handleGenerateContent = async (documentContext?: string) => { if (!contentTopic.trim()) return; setGeneratingContent(true); setGeneratedContent(""); try { const c = await generateContent(contentTopic, contentType, toneOfVoice, targetAudience, contentKeywords, documentContext); if (c) { setGeneratedContent(c); saveToContentHistory({ id: Date.now().toString(), title: contentTopic, content: c, createdAt: new Date().toISOString(), source: 'content_tab' }); } } finally { setGeneratingContent(false); } };

  const handleAddCompetitor = async (competitorName: string) => {
    if (!selectedClient) return;
    // Check using normalized matching to prevent duplicates like "monday.com" + "Monday CRM"
    if (selectedClient.competitors.some(c => brandNamesMatch(c, competitorName))) return;
    // Also don't add if it matches the client's own brand
    if (brandNamesMatch(competitorName, selectedClient.brand_name)) return;
    if (selectedClient.brand_tags.some(t => brandNamesMatch(competitorName, t))) return;

    const updatedCompetitors = [...selectedClient.competitors, competitorName];

    // Use the hook's updateCompetitors function which handles both state and Supabase
    await updateCompetitors(updatedCompetitors);
  };
  const handleImport = () => { if (importText.trim()) { importData(importText); setImportText(""); setImportDialogOpen(false); } };
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => importData(ev.target?.result as string); r.readAsText(f); } };
  const handleCreateClient = async () => {
    if (!newClientForm.name.trim()) return;
    setIsCreatingClient(true);
    try {
      const comps = newClientForm.competitors.split(",").map(c => c.trim()).filter(Boolean);
      const finalIndustry = newClientForm.industry === "Custom" && newClientForm.customIndustry.trim() ? newClientForm.customIndustry.trim() : newClientForm.industry;
      await addClient({
        name: newClientForm.name,
        brand_name: newClientForm.brand_name || newClientForm.name,
        brand_domain: newClientForm.website.trim() || undefined,
        target_region: newClientForm.target_region,
        location_code: locations[newClientForm.target_region] || 2840,
        industry: finalIndustry,
        competitors: comps.length > 0 ? comps : industries[newClientForm.industry]?.competitors || [],
        primary_color: newClientForm.primary_color
      });
      setNewClientForm({ name: "", brand_name: "", target_region: "United States", industry: "Custom", customIndustry: "", competitors: "", primary_color: "#0372ff", logo_url: "", website: "" });
      setAddClientOpen(false);
    } catch (err: any) {
      console.error("Failed to create client:", err);
      toast.error(err.message || "Failed to create brand. Please check if you have reached your limit.");
    } finally {
      setIsCreatingClient(false);
    }
  };
  const handleUpdateClient = async () => { if (!selectedClient || !editClientForm.name.trim()) return; const comps = editClientForm.competitors.split(",").map(c => c.trim()).filter(Boolean); const finalIndustry = editClientForm.industry === "Custom" && editClientForm.customIndustry.trim() ? editClientForm.customIndustry.trim() : editClientForm.industry; await updateClient(selectedClient.id, { name: editClientForm.name, brand_name: editClientForm.brand_name || editClientForm.name, brand_domain: editClientForm.website.trim() || undefined, target_region: editClientForm.target_region, location_code: locations[editClientForm.target_region] || selectedClient.location_code, industry: finalIndustry, primary_color: editClientForm.primary_color, competitors: comps }); setEditClientOpen(false); };
  const handleDeleteClient = async () => { if (!selectedClient) return; if (!isAdmin) { toast.error("Only administrators can delete brands."); return; } if (confirm(`Delete "${selectedClient.name}"?`)) await deleteClient(selectedClient.id); };
  const handleAddTag = () => { if (newTag.trim() && selectedClient) { updateBrandTags([...selectedClient.brand_tags, newTag.trim()]); setNewTag(""); } };
  const toggleModel = (id: string) => { if (selectedModels.includes(id)) { if (selectedModels.length > 1) setSelectedModels(selectedModels.filter(m => m !== id)); } else { setSelectedModels([...selectedModels, id]); } };
  const toggleModelFilter = (id: string) => { if (modelFilter.includes(id)) { setModelFilter(modelFilter.filter(m => m !== id)); } else { setModelFilter([...modelFilter, id]); } };

  const handleExportFullAudit = () => {
    if (!selectedClient) return;
    const overallVisibility = Math.round(auditResults.reduce((sum, r) => sum + r.summary.share_of_voice, 0) / (auditResults.length || 1));
    const priority = overallVisibility < 30 ? 'HIGH' : overallVisibility < 60 ? 'MEDIUM' : 'LOW';

    // Calculate priority counts
    const highCount = auditResults.filter(r => (r.summary?.share_of_voice || 0) < 30).length;
    const medCount = auditResults.filter(r => { const s = r.summary?.share_of_voice || 0; return s >= 30 && s < 60; }).length;
    const lowCount = auditResults.filter(r => (r.summary?.share_of_voice || 0) >= 60).length;

    // Gather Tavily insights
    const tavilyInsights: string[] = [];
    const tavilySrcs: { prompt: string; urls: string[] }[] = [];
    Object.entries(tavilyResults).forEach(([pid, data]: [string, any]) => {
      if (data?.analysis?.insights) data.analysis.insights.forEach((i: string) => { if (!tavilyInsights.includes(i)) tavilyInsights.push(i); });
      if (data?.sources?.length) {
        const p = prompts.find(x => x.id === pid);
        tavilySrcs.push({ prompt: p?.prompt_text || pid, urls: data.sources.slice(0, 3).map((s: any) => s.url) });
      }
    });

    let txt = "=".repeat(64) + "\n";
    txt += "           FORZEO GEO AUDIT REPORT - FULL ANALYSIS\n";
    txt += "=".repeat(64) + "\n\n";
    txt += "Export Date: " + new Date().toLocaleString() + "\n";
    txt += "Priority Level: " + priority + "\n\n";

    txt += "-".repeat(40) + "\n EXECUTIVE SUMMARY\n" + "-".repeat(40) + "\n\n";
    txt += "Brand: " + selectedClient.brand_name + "\n";
    txt += "Overall Visibility: " + overallVisibility + "%\n\n";
    txt += "Quick Stats:\n";
    txt += "  * Total Prompts: " + prompts.length + "\n";
    txt += "  * Completed Audits: " + auditResults.length + "\n";
    txt += "  * Citations Found: " + allCitations.length + "\n";
    txt += "  * Unique Sources: " + domainStats.length + "\n";

    txt += "Priority Breakdown:\n";
    txt += "  [CRITICAL] <30%: " + highCount + " prompts\n";
    txt += "  [MODERATE] 30-60%: " + medCount + " prompts\n";
    txt += "  [GOOD] >60%: " + lowCount + " prompts\n\n";

    txt += "-".repeat(40) + "\n CLIENT INFORMATION\n" + "-".repeat(40) + "\n\n";
    txt += "Name: " + selectedClient.name + "\n";
    txt += "Brand: " + selectedClient.brand_name + "\n";
    txt += "Industry: " + (selectedClient.industry || "N/A") + "\n";
    txt += "Region: " + (selectedClient.target_region || "N/A") + "\n";
    txt += "Brand Tags: " + (selectedClient.brand_tags?.join(", ") || "None") + "\n";
    txt += "Competitors: " + (selectedClient.competitors?.join(", ") || "None") + "\n\n";

    txt += "-".repeat(40) + "\n AI-POWERED RECOMMENDATIONS\n" + "-".repeat(40) + "\n\n";
    if (aiInsights) {
      txt += "Summary: " + (aiInsights.summary || 'N/A') + "\n";
      txt += "Priority: " + (aiInsights.priority?.toUpperCase() || 'N/A') + "\n\n";
      if (aiInsights.recommendations?.length) {
        txt += "Strategic Recommendations:\n";
        aiInsights.recommendations.forEach((r, i) => { txt += "  " + (i + 1) + ". " + r + "\n"; });
        txt += "\n";
      }
      if (aiInsights.keyActions?.length) {
        txt += "Key Actions:\n";
        aiInsights.keyActions.forEach(a => { txt += "  * " + a + "\n"; });
        txt += "\n";
      }
    } else {
      txt += "No AI recommendations generated yet.\n";
      txt += "Visit the Insights tab and click 'Generate AI Insights' to get recommendations.\n\n";
    }

    txt += "-".repeat(40) + "\n FORZEO DISCOVERY ENGINE ANALYSIS\n" + "-".repeat(40) + "\n\n";
    if (tavilyInsights.length > 0 || tavilySrcs.length > 0) {
      if (tavilyInsights.length) {
        txt += "Web Insights:\n";
        tavilyInsights.slice(0, 5).forEach((ins, i) => { txt += "  " + (i + 1) + ". " + ins + "\n"; });
        txt += "\n";
      }
      if (tavilySrcs.length) {
        txt += "Discovered Sources:\n";
        tavilySrcs.slice(0, 5).forEach((item, i) => {
          txt += "\n  [" + (i + 1) + "] " + item.prompt.substring(0, 50) + (item.prompt.length > 50 ? "..." : "") + "\n";
          item.urls.forEach(u => { txt += "      - " + u + "\n"; });
        });
        txt += "\n";
      }
    } else {
      txt += "No Discovery Engine data available. Enable Discovery toggle and run audits.\n\n";
    }

    txt += "-".repeat(40) + "\n MODEL PERFORMANCE\n" + "-".repeat(40) + "\n\n";
    AI_MODELS.forEach(m => { const s = modelStats[m.id]; const pct = s?.total ? Math.round((s.visible / s.total) * 100) : 0; txt += m.name + " (" + m.provider + "): " + (s?.visible || 0) + "/" + (s?.total || 0) + " visible (" + pct + "%) - $" + (s?.cost || 0).toFixed(4) + "\n"; });

    txt += "\n" + "-".repeat(40) + "\n COMPETITOR ANALYSIS\n" + "-".repeat(40) + "\n\n";
    competitorGap.forEach((c, i) => { const isBrand = c.name === selectedClient?.brand_name; txt += (isBrand ? ">> " : "   ") + (i + 1) + ". " + c.name + ": " + c.mentions + " mentions (" + c.percentage + "%)\n"; });

    txt += "\n" + "-".repeat(40) + "\n PROMPTS (" + prompts.length + ")\n" + "-".repeat(40) + "\n\n";
    prompts.forEach((p, i) => { const r = auditResults.find(x => x.prompt_id === p.id); const sov = r?.summary?.share_of_voice || 0; const pri = sov < 30 ? "[!]" : sov < 60 ? "[~]" : "[+]"; txt += (i + 1) + ". " + pri + " [" + (p.is_active ? "Active" : "Inactive") + "] " + p.prompt_text + "\n   Category: " + (p.category || "custom") + " | Niche: " + (p.niche_level || "N/A") + (r ? " | Visibility: " + sov + "%" : "") + "\n"; });

    txt += "\n" + "=".repeat(40) + "\n AUDIT RESULTS (" + auditResults.length + ")\n" + "=".repeat(40) + "\n";
    auditResults.forEach((r, i) => { txt += "\n[" + (i + 1) + "] " + r.prompt_text + "\n" + "-".repeat(50) + "\nDate: " + new Date(r.created_at).toLocaleString() + "\nSOV: " + r.summary.share_of_voice + "% | Position: " + (r.summary.average_rank || "N/A") + " | Citations: " + r.summary.total_citations + "\n\nModel Results:\n"; r.model_results.forEach(mr => { txt += "  - " + mr.model_name + ": " + (mr.brand_mentioned ? "Mentioned" : "Not mentioned") + (mr.brand_rank ? " (Position #" + mr.brand_rank + ")" : "") + " - " + mr.brand_mention_count + " mentions, " + (mr.citations?.length || 0) + " citations\n"; }); txt += "\n"; });

    txt += "\n" + "-".repeat(40) + "\n TOP CITATIONS (" + Math.min(allCitations.length, 50) + ")\n" + "-".repeat(40) + "\n\n";
    allCitations.slice(0, 50).forEach((c, i) => { txt += (i + 1) + ". " + c.domain + " (" + c.count + "x)\n   " + c.url + "\n"; });

    txt += "\n" + "-".repeat(40) + "\n TOP SOURCES (" + Math.min(domainStats.length, 30) + ")\n" + "-".repeat(40) + "\n\n";
    domainStats.slice(0, 30).forEach((s, i) => { txt += (i + 1) + ". " + s.domain + ": " + s.count + " citations across " + s.promptCount + " prompts\n"; });

    txt += "\n" + "=".repeat(64) + "\n";
    txt += "Generated by Forzeo GEO Dashboard\n";
    txt += `${window.location.origin}\n`;
    txt += "=".repeat(64) + "\n";

    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (selectedClient.slug || selectedClient.name.toLowerCase().replace(/\s+/g, "-")) + "-full-audit-" + new Date().toISOString().split("T")[0] + ".txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const dateRangeLabel = dateRangeFilter === "7d" ? "Last 7 days" : dateRangeFilter === "30d" ? "Last 30 days" : dateRangeFilter === "90d" ? "Last 90 days" : "All Time";
  const modelFilterLabel = modelFilter.length === 0 ? "All Models" : modelFilter.length === 1 ? AI_MODELS.find(m => m.id === modelFilter[0])?.name : `${modelFilter.length} Models`;

  const handleRunCampaign = async () => {
    if (!campaignName.trim()) return;
    const activePromptIds = prompts.filter(p => p.is_active !== false).map(p => p.id);
    await runCampaign(campaignName, activePromptIds);
    setCampaignName("");
    setRunCampaignOpen(false);
    setActiveTab("topics"); // Switch to topics tab to see progress
  };

  const RunCampaignDialog = () => (
    <Dialog open={runCampaignOpen} onOpenChange={setRunCampaignOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Run Massive Topic Audit</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Topic Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Q1 Competitor Audit"
              />
              <p className="text-sm text-gray-500">
                This will run all {prompts.filter(p => p.is_active !== false).length} active prompts as a single topic audit.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => setRunCampaignOpen(false)} variant="outline">Cancel</Button>
          <Button onClick={handleRunCampaign} disabled={!campaignName.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Start Topic Audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const exportModelResponsesToCSV = useCallback(() => {
    if (!selectedClient || filteredAuditResults.length === 0) return;

    // Define CSV headers
    const rows = [["Prompt", "Topic", "Model", "Visibility", "Position", "Brands Mentioned", "Citations Found", "Citation URLs", "Raw Response"]];

    for (const r of filteredAuditResults) {
      const promptInfo = prompts.find(p => p.id === r.prompt_id);

      // Iterate over each model result within this audit
      r.model_results.forEach(mr => {
        // Skip models filtered out by the UI
        if (modelFilter.length > 0 && !modelFilter.includes(mr.model)) return;

        const isVisible = mr.brand_mentioned ? "Yes" : "No";
        const rank = mr.brand_rank ? mr.brand_rank.toString() : "-";
        const citationsCount = mr.citations?.length?.toString() || "0";

        // Format brands list
        const brands = mr.extracted_brands?.map(b => b.title).join("; ") || "None";

        // Format citation URLs as semicolon-separated list
        const citationUrls = mr.citations?.map((c: any) => c.url || c).filter(Boolean).join("; ") || "";

        // Clean and escape raw response for CSV
        let rawContent = mr.raw_response || "No response data available";
        // Escape quotes by doubling them, and wrap the entire string in quotes to protect newlines/commas
        const escapedContent = `"${rawContent.replace(/"/g, '""')}"`;

        // Map explicitly requested model names
        let explicitModelName = mr.model;
        if (mr.model === "google-ai-overview") explicitModelName = "ai overview";
        else if (mr.model.includes("gpt")) explicitModelName = "gpt";
        else if (mr.model.includes("claude")) explicitModelName = "claude";
        else if (mr.model.includes("gemini")) explicitModelName = "gemini";
        else if (mr.model.includes("perplexity")) explicitModelName = "perplexity";
        else if (mr.model.includes("serp") || mr.model.includes("google-search")) explicitModelName = "serp";

        rows.push([
          `"${(promptInfo?.prompt_text || r.prompt_text || "").replace(/"/g, '""')}"`,
          `"${(promptInfo?.category || "custom").replace(/"/g, '""')}"`,
          explicitModelName,
          isVisible,
          rank,
          `"${brands.replace(/"/g, '""')}"`,
          citationsCount,
          `"${citationUrls.replace(/"/g, '""')}"`,
          escapedContent
        ]);
      });
    }

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedClient.slug}-raw-responses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedClient, filteredAuditResults, prompts, modelFilter]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={cn(
        "bg-white border-r border-gray-200 flex flex-col fixed h-full z-40 transition-all duration-300 shadow-sm overflow-hidden",
        // Mobile: Fixed overlay, toggled by mobileMenuOpen
        "md:translate-x-0 w-56",
        mobileMenuOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0",
        // Desktop: Toggled by sidebarCollapsed
        sidebarCollapsed && "md:w-0 md:-translate-x-full"
      )}>
        <div className="p-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"><div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden" style={{ backgroundColor: selectedClient?.brand_domain ? 'transparent' : (selectedClient?.primary_color || "#3b82f6") }}>{selectedClient?.brand_domain ? (<img src={`https://www.google.com/s2/favicons?domain=${selectedClient.brand_domain}&sz=32`} alt="" className="h-8 w-8" onError={(e) => { const parent = (e.target as HTMLImageElement).parentElement; if (parent) { parent.style.backgroundColor = selectedClient?.primary_color || '#3b82f6'; } (e.target as HTMLImageElement).style.display = 'none'; const span = document.createElement('span'); span.className = 'text-white font-bold text-sm'; span.textContent = selectedClient?.brand_name?.charAt(0) || '?'; parent?.appendChild(span); }} />) : (<span className="text-white font-bold text-sm">{selectedClient?.brand_name?.charAt(0) || "?"}</span>)}</div><span className="font-semibold text-gray-900 flex-1 truncate">{selectedClient?.brand_name || "Select"}</span><ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 max-h-[70vh] flex flex-col">
              {/* Agency Dashboard option for agency users */}
              {isAgency && (
                <div className="flex-shrink-0">
                  <DropdownMenuItem onClick={() => switchClient(null as any)} className="flex items-center gap-2 text-blue-600 font-medium">
                    <Shield className="h-4 w-4" />
                    Agency Dashboard
                    {!selectedClient && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </div>
              )}
              <div className="overflow-y-auto flex-1 min-h-0">
                {clients.map(c => (<DropdownMenuItem key={c.id} onClick={() => switchClient(c)} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-5 w-5 rounded flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden" style={{ backgroundColor: c.brand_domain ? 'transparent' : c.primary_color }}>{c.brand_domain ? (<img src={`https://www.google.com/s2/favicons?domain=${c.brand_domain}&sz=32`} alt="" className="h-5 w-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; const parent = (e.target as HTMLImageElement).parentElement; if (parent) { parent.style.backgroundColor = c.primary_color; const span = document.createElement('span'); span.className = 'text-white text-xs font-bold'; span.textContent = c.brand_name.charAt(0); parent.appendChild(span); } }} />) : (<span className="text-white text-xs font-bold">{c.brand_name.charAt(0)}</span>)}</div><span className="truncate">{c.brand_name}</span></div>{c.id === selectedClient?.id && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}</DropdownMenuItem>))}
              </div>
              <div className="flex-shrink-0"><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setAddClientOpen(true)}><Plus className="h-4 w-4 mr-2 flex-shrink-0" /> Add Brand</DropdownMenuItem></div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden min-h-0">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">General</div>
          {[
            { id: "overview", label: "Overview", icon: Home },
            { id: "prompts", label: "Prompts", icon: MessageSquare, badge: pendingPrompts > 0 ? pendingPrompts : null },
            { id: "topics", label: "Topics", icon: Layers },
            { id: "insights", label: "Insights", icon: Lightbulb, betaBadge: true },

            { id: "schedules", label: "Schedules", icon: Clock },
            { id: "bulk_scheduler", label: "Bulk Scheduler", icon: Calendar },
            { id: "future-citations", label: "Future Citations", icon: Zap, betaBadge: true },
            { id: "sources", label: "Citations", icon: Globe, badge: allCitations.length > 0 ? allCitations.length : null },
            { id: "traffic", label: "Traffic", icon: BarChart3 },
            { id: "cost", label: "Cost Analysis", icon: DollarSign },
            { id: "content", label: "Content", icon: FileText }
          ].filter(item => {
            // Admin sees all tabs
            if (isAdmin) return true;
            // Agency sees specific tabs
            if (isAgency) {
              return ["overview", "prompts", "topics", "insights", "future-citations", "sources", "content", "brands"].includes(item.id);
            }
            // Normal users see limited tabs (bulk_scheduler and cost are admin-only)
            return !["schedules", "future-citations", "bulk_scheduler", "cost"].includes(item.id);
          }).map(item => (<button key={item.id} onClick={() => setActiveTab(item.id as typeof activeTab)} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all text-left", activeTab === item.id ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100")}><item.icon className={cn("h-4 w-4 flex-shrink-0", activeTab === item.id ? "text-white" : "text-gray-400")} /><span className="flex-1 truncate">{item.label}</span>{item.badge && <span className={cn("text-xs px-1.5 py-0.5 rounded flex-shrink-0 min-w-[20px] text-center", activeTab === item.id ? "bg-white/20 text-white" : "bg-blue-100 text-blue-600")}>{item.badge > 99 ? "99+" : item.badge}</span>}{item.betaBadge && <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 bg-blue-500 text-white font-semibold">BETA</span>}</button>))}
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-5">Project</div>
          <button onClick={() => setSettingsOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 mb-0.5 text-left transition-all"><Settings className="h-4 w-4 flex-shrink-0 text-gray-400" /><span className="flex-1 truncate">Settings</span></button>
          <button onClick={() => setManageBrandsOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 mb-0.5 text-left transition-all"><Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" /><span className="flex-1 truncate">Brands</span></button>
          {onShowLaunchpad && (
            <button onClick={onShowLaunchpad} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 text-left transition-all text-blue-600 hover:bg-blue-50">
              <Zap className="h-4 w-4 flex-shrink-0 text-blue-500" />
              <span className="flex-1 truncate">Launchpad</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold flex-shrink-0">GEO</span>
            </button>
          )}

          {isAdmin && (
            <>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-5">Company</div>
              <button onClick={() => setUserManagementOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 mb-0.5 text-left transition-all">
                <Users className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <span className="flex-1 truncate">Users</span>
                <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 bg-purple-100 text-purple-600">Admin</span>
              </button>
            </>
          )}

        </nav>
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          {/* Agency Quota Display */}
          {isAgency && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
              <div className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-1"><Shield className="h-3 w-3" /> Agency Plan</div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Brands</span>
                    <span className={cn("font-medium", clients.length >= 5 ? "text-red-600" : "text-gray-900")}>{clients.length}/5</span>
                  </div>
                  <div className="h-1.5 bg-blue-200/50 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", clients.length >= 5 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${Math.min((clients.length / 5) * 100, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Prompts <span className="text-[10px] text-gray-400 font-normal">(current)</span></span>
                    <span className={cn("font-medium", prompts.length >= 15 ? "text-red-600" : "text-gray-900")}>{prompts.length}/15</span>
                  </div>
                  <div className="h-1.5 bg-blue-200/50 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", prompts.length >= 15 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${Math.min((prompts.length / 15) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 mb-3 shadow-lg overflow-hidden">
              <div className="text-xs font-medium text-gray-400 mb-1">Audits Completed</div>
              <div className="text-xl font-bold text-white truncate">{auditResults.length}</div>
              <div className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse"></span>
                <span className="truncate">Total runs (all time)</span>
              </div>
            </div>
          )}
          {/* User Profile Section */}
          {user && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{user.email?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{user.email?.split('@')[0]}</div>
                  <div className="flex items-center gap-1">
                    {role === 'admin' && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-semibold">Admin</span>}
                    {role === 'agency' && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">Agency</span>}
                    {role === 'user' && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold">User</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 text-left transition-colors mt-1">
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 truncate">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <main className={cn("flex-1 min-h-screen transition-all duration-300", sidebarCollapsed ? "ml-0" : "md:ml-56")}>
        <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Mobile Toggle */}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <PanelLeft className="h-5 w-5" />
              </button>
              {/* Desktop Toggle */}
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden md:block p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}>
                {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
              <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2 truncate">
                {(() => {
                  const Icon = activeTab === "overview" ? Eye :
                    activeTab === "prompts" ? Target :
                      activeTab === "schedules" || activeTab === "bulk_scheduler" ? Calendar :
                        activeTab === "traffic" ? BarChart3 :
                          activeTab === "cost" ? DollarSign :
                            activeTab === "sources" ? Globe :
                              activeTab === "insights" ? TrendingUp :
                                FileText;
                  return <Icon className="h-5 w-5 text-gray-400 hidden sm:block" />;
                })()}
                <span className="truncate">
                  {activeTab === "overview" ? "Overview" :
                    activeTab === "prompts" ? "Prompts" :
                      activeTab === "schedules" ? "Auto-Run Schedules" :
                        activeTab === "bulk_scheduler" ? "Bulk Scheduler" :
                          activeTab === "future-citations" ? "Future Citations" :
                            activeTab === "topics" ? "Topics" :
                              activeTab === "content" ? "Content Generator" :
                                activeTab === "insights" ? "Insights" :
                                  activeTab === "traffic" ? "AI Traffic" :
                                    activeTab === "cost" ? "Cost Analysis" :
                                      activeTab === "sources" ? "Citations" :
                                        "Dashboard"}
                </span>
              </h1>
              {(dateRangeFilter !== "all" || modelFilter.length > 0) && <Badge variant="secondary" className="text-xs hidden sm:inline-flex">Filtered</Badge>}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
              {/* Notifications Bell - Admin Only */}
              {role === 'admin' && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      if (!showNotifications && unreadCount > 0) {
                        markNotificationsAsRead();
                      }
                    }}
                    className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <>
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-red-500 text-white text-[10px] font-bold">{unreadCount}</span>
                        </span>
                      </>
                    )}
                  </button>
                  {showNotifications && (
                    <>
                      <div className="fixed inset-0 z-[9998] bg-black/20" onClick={() => setShowNotifications(false)} />
                      <div className="fixed top-16 right-4 w-[450px] bg-white rounded-xl shadow-2xl border-2 border-transparent bg-gradient-to-br from-blue-50 via-white to-purple-50 z-[9999] max-h-[600px] overflow-hidden ring-1 ring-blue-200/50 animate-in slide-in-from-top-4 duration-300">
                        <div className="p-4 border-b border-blue-100/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
                          <h3 className="font-semibold text-base bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Notifications</h3>
                        </div>
                        <div className="max-h-[540px] overflow-y-auto bg-white">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center text-sm text-gray-500">
                              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                              <p>No notifications yet</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {notifications.map(notif => (
                                <div
                                  key={notif.id}
                                  className={cn(
                                    "p-4 hover:bg-gray-50 transition-colors",
                                    !notif.is_read && "bg-blue-50/50"
                                  )}
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                                      {!notif.is_read && (
                                        <span className="flex h-2 w-2 mt-1.5">
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700">{notif.message}</p>
                                    {notif.metadata && (
                                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-xs bg-gray-50 -mx-4 -mb-4 px-4 py-3">
                                        {notif.metadata.new_user_name && (
                                          <div className="flex items-center gap-3">
                                            <span className="font-semibold text-gray-600 min-w-[70px]">Name:</span>
                                            <span className="text-gray-900 font-medium">{notif.metadata.new_user_name}</span>
                                          </div>
                                        )}
                                        {notif.metadata.new_user_email && (
                                          <div className="flex items-center gap-3">
                                            <span className="font-semibold text-gray-600 min-w-[70px]">Email:</span>
                                            <span className="text-gray-900">{notif.metadata.new_user_email}</span>
                                          </div>
                                        )}
                                        {notif.metadata.new_user_id && (
                                          <div className="flex items-center gap-3">
                                            <span className="font-semibold text-gray-600 min-w-[70px]">User ID:</span>
                                            <span className="text-gray-600 font-mono text-[10px]">{notif.metadata.new_user_id}</span>
                                          </div>
                                        )}
                                        {notif.metadata.signup_time && (
                                          <div className="flex items-center gap-3">
                                            <span className="font-semibold text-gray-600 min-w-[70px]">Signed up:</span>
                                            <span className="text-gray-700">{new Date(notif.metadata.signup_time).toLocaleString()}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    <p className="text-xs text-gray-400 mt-2">
                                      {new Date(notif.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Client Badge - Hidden on small mobile to save space if needed, or kept compact */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">

                <DropdownMenu><DropdownMenuTrigger asChild><button className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap", dateRangeFilter !== "all" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-white/50")}><Calendar className="h-3.5 w-3.5" /> {dateRangeFilter === "7d" ? "Last 7 days" : dateRangeFilter === "30d" ? "Last 30 days" : dateRangeFilter === "90d" ? "Last 90 days" : dateRangeFilter === "custom" ? "Custom Range" : "All Time"}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64"><DropdownMenuItem onClick={() => setDateRangeFilter("7d")} className={cn(dateRangeFilter === "7d" && "bg-blue-50")}>Last 7 days</DropdownMenuItem><DropdownMenuItem onClick={() => setDateRangeFilter("30d")} className={cn(dateRangeFilter === "30d" && "bg-blue-50")}>Last 30 days</DropdownMenuItem><DropdownMenuItem onClick={() => setDateRangeFilter("90d")} className={cn(dateRangeFilter === "90d" && "bg-blue-50")}>Last 90 days</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setDateRangeFilter("all")} className={cn(dateRangeFilter === "all" && "bg-blue-50")}>All Time</DropdownMenuItem><DropdownMenuSeparator /><div className="px-2 py-2"><p className="text-xs font-medium text-gray-500 mb-2">Custom Range</p><div className="flex flex-col gap-2"><input type="date" value={customDateStart} onChange={(e) => { setCustomDateStart(e.target.value); setDateRangeFilter("custom"); }} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Start date" /><input type="date" value={customDateEnd} onChange={(e) => { setCustomDateEnd(e.target.value); setDateRangeFilter("custom"); }} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="End date" /></div></div></DropdownMenuContent></DropdownMenu>
                {/* All Models filter removed per UI overhaul */}
              </div>

              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export Data</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={exportToCSV}><FileText className="h-4 w-4 mr-2" /> Export Summary (CSV)</DropdownMenuItem><DropdownMenuItem onClick={exportModelResponsesToCSV}><FileText className="h-4 w-4 mr-2" /> Export Raw Responses (CSV)</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={exportFullReport}><FileText className="h-4 w-4 mr-2" /> Export Report (TXT)</DropdownMenuItem><DropdownMenuItem onClick={handleExportFullAudit}><FileText className="h-4 w-4 mr-2" /> Export Full Audit (TXT)</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => window.print()}><FileText className="h-4 w-4 mr-2" /> Export as PDF (Print)</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setImportDialogOpen(true)}><Upload className="h-4 w-4 mr-2" /> Import Data</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              {isAdmin && <button onClick={() => setIncludeTavily(!includeTavily)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border", includeTavily ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50")} title="Include Forzeo Discovery Engine"><span className={cn("w-2 h-2 rounded-full", includeTavily ? "bg-amber-500" : "bg-gray-300")} />{includeTavily ? "Discovery On" : "Discovery Off"}</button>}
              {isAdmin && <Button onClick={() => runFullAudit()} disabled={loading || pendingPrompts === 0} className="bg-gray-900 hover:bg-gray-800 text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}{loading ? "Running..." : `Run ${pendingPrompts} Prompts`}</Button>}
            </div>
          </div>
        </header>
        {auditProgress !== null && (
          <div className="bg-blue-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-between sticky top-[65px] z-30 shadow-md animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Running Initial Audit... {auditProgress}%</span>
            </div>
            <div className="w-48 bg-blue-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-500 ease-out"
                style={{ width: `${auditProgress}%` }}
              />
            </div>
          </div>
        )}
        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" /> {error}</div>}
        <div className="print-header hidden" style={{ display: 'none' }}>
          <div style={{ padding: '20px 0', borderBottom: '2px solid #e5e7eb', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>Forzeo GEO Report</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
              {selectedClient?.brand_name || 'All Brands'} — {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} — {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="p-6">
          {activeTab === "overview" && (
            <OverviewTab
              isAgency={isAgency}
              clients={clients}
              selectedClient={selectedClient}
              prompts={prompts}
              auditResults={auditResults}
              filteredAuditResults={filteredAuditResults}
              modelStats={modelStats}
              competitorGap={competitorGap}
              detailedBrandStats={detailedBrandStats}
              sovTimeSeries={sovTimeSeries}
              allCitations={allCitations}
              domainStats={domainStats}
              typeSegments={typeSegments}
              recentPrompts={recentPrompts}
              selectedModels={selectedModels}
              sovTimeRange={sovTimeRange}
              setSovTimeRange={setSovTimeRange}
              showBrandOnly={showBrandOnly}
              setShowBrandOnly={setShowBrandOnly}
              showBrandVisibilityModal={showBrandVisibilityModal}
              setShowBrandVisibilityModal={setShowBrandVisibilityModal}
              switchClient={switchClient}
              setManageBrandsOpen={setManageBrandsOpen}
              setActiveTab={(tab: any) => setActiveTab(tab)}
              setSelectedPromptDetail={setSelectedPromptDetail}
              refreshData={refreshData}
              totalAiTraffic={totalLLMSessionsLast7}
            />
          )}{activeTab === "brands" && BrandsTab()}
          {activeTab === "prompts" && (
            <PromptsTab
              prompts={prompts}
              auditResults={auditResults}
              filteredPrompts={filteredPrompts}
              selectedClient={selectedClient}
              isAdmin={isAdmin}
              isAgency={isAgency}
              loading={loading}
              loadingPromptIds={loadingPromptIds}
              selectedPromptIds={selectedPromptIds}
              setSelectedPromptIds={setSelectedPromptIds}
              promptsTabView={promptsTabView}
              setPromptsTabView={setPromptsTabView}
              promptsFilterVisibility={promptsFilterVisibility}
              setPromptsFilterVisibility={setPromptsFilterVisibility}
              promptsFilterCompetitor={promptsFilterCompetitor}
              setPromptsFilterCompetitor={setPromptsFilterCompetitor}
              promptSortField={promptSortField}
              setPromptSortField={setPromptSortField}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              inlineEditTopicId={inlineEditTopicId}
              setInlineEditTopicId={setInlineEditTopicId}
              inlineEditTopicValue={inlineEditTopicValue}
              setInlineEditTopicValue={setInlineEditTopicValue}
              setSelectedPromptDetail={setSelectedPromptDetail}
              setBulkPromptsOpen={setBulkPromptsOpen}
              setEditingPromptId={setEditingPromptId}
              setEditingPromptText={setEditingPromptText}
              setEditingPromptTopic={setEditingPromptTopic}
              setEditPromptOpen={setEditPromptOpen}
              setEditingLocationPromptId={setEditingLocationPromptId}
              setEditingLocationValue={setEditingLocationValue}
              setEditLocationOpen={setEditLocationOpen}
              runSinglePrompt={runSinglePrompt}
              bulkArchivePrompts={bulkArchivePrompts}
              bulkDeletePrompts={bulkDeletePrompts}
              reactivatePrompt={reactivatePrompt}
              updatePrompt={updatePrompt}
              getAIOpportunity={getAIOpportunity}
              getPromptResult={getPromptResult}
              tavilyResults={tavilyResults}
              recsModalOpen={recsModalOpen}
              setRecsModalOpen={setRecsModalOpen}
              recsModalPromptId={recsModalPromptId}
              setRecsModalPromptId={setRecsModalPromptId}
              recsModalLoading={recsModalLoading}
              setRecsModalLoading={setRecsModalLoading}
              recsModalData={recsModalData}
              setRecsModalData={setRecsModalData}
              generateRecommendations={generateRecommendations}
              bulkRunProgress={bulkRunProgress}
              setBulkRunProgress={setBulkRunProgress}
              exportToCSV={exportToCSV}
              exportModelResponsesToCSV={exportModelResponsesToCSV}
            />
          )}
          {activeTab === "schedules" && selectedClient && <React.Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}><ScheduleManager clientId={selectedClient.id} prompts={prompts} selectedModels={selectedModels} /></React.Suspense>}
          {activeTab === "bulk_scheduler" && isAdmin && <React.Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}><MultiAccountScheduler clients={clients} selectedModels={selectedModels} /></React.Suspense>}
          {activeTab === "future-citations" && selectedClient && <React.Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}><SignalsDashboard clientId={selectedClient.id} brandName={selectedClient.brand_name} /></React.Suspense>}
          {activeTab === "topics" && selectedClient && (
            <TopicsTab
              topicData={topicData}
              unassignedPrompts={unassignedPrompts}
              expandedTopic={expandedTopic}
              setExpandedTopic={setExpandedTopic}
              setActiveTab={(tab: string) => setActiveTab(tab as any)}
              setBulkPromptsOpen={setBulkPromptsOpen}
              getPromptResult={getPromptResult}
              selectedClient={selectedClient}
              setSelectedPromptDetail={setSelectedPromptDetail}
              getAIOpportunity={getAIOpportunity}
            />
          )}
          {activeTab === "citations" && (
            <CitationsTab
              allCitations={allCitations}
              filteredCitations={filteredCitations}
              citationSearch={citationSearch}
              setCitationSearch={setCitationSearch}
              selectedCitation={selectedCitation}
              setSelectedCitation={setSelectedCitation}
              exportCitations={exportCitations}
              citationsByPrompt={citationsByPrompt}
              citationMeta={citationMeta}
              selectedClient={selectedClient}
              prompts={prompts}
              filteredAuditResults={filteredAuditResults}
              selectedPromptDetail={selectedPromptDetail}
              setSelectedPromptDetail={setSelectedPromptDetail}
            />
          )}
          {activeTab === "sources" && (
            <SourcesTab
              selectedClient={selectedClient}
              allCitations={allCitations}
              domainStats={domainStats}
              citationMeta={citationMeta}
              filteredAuditResults={filteredAuditResults}
              sourcesView={sourcesView}
              setSourcesView={setSourcesView}
              sourcesGapView={sourcesGapView}
              setSourcesGapView={setSourcesGapView}
              sourcesTypeFilter={sourcesTypeFilter}
              setSourcesTypeFilter={setSourcesTypeFilter}
              sourcesModelFilter={sourcesModelFilter}
              setSourcesModelFilter={setSourcesModelFilter}
              sourcesModelFilterOpen={sourcesModelFilterOpen}
              setSourcesModelFilterOpen={setSourcesModelFilterOpen}
              sourcesPage={sourcesPage}
              setSourcesPage={setSourcesPage}
              SOURCES_PAGE_SIZE={SOURCES_PAGE_SIZE}
              categorizeCitations={categorizeCitations}
              verifyCitations={verifyCitations}
              categorizationProgress={categorizationProgress}
              setCategorizationProgress={setCategorizationProgress}
            />
          )}
          {activeTab === "content" && (
            <ContentTab
              contentTopic={contentTopic}
              setContentTopic={setContentTopic}
              contentType={contentType}
              setContentType={setContentType}
              targetAudience={targetAudience}
              setTargetAudience={setTargetAudience}
              contentKeywords={contentKeywords}
              setContentKeywords={setContentKeywords}
              toneOfVoice={toneOfVoice}
              setToneOfVoice={setToneOfVoice}
              generatingContent={generatingContent}
              generatedContent={generatedContent}
              selectedClient={selectedClient}
              onGenerateContent={handleGenerateContent}
              prompts={prompts}
              industries={industries}
              setEditClientForm={setEditClientForm}
              setEditClientOpen={setEditClientOpen}
              generatedContentHistory={generatedContentHistory}
              onDeleteHistoryItem={deleteContentHistoryItem}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === "insights" && (
            <InsightsTab
              filteredAuditResults={filteredAuditResults}
              selectedClient={selectedClient}
              tavilyResults={tavilyResults}
              aiInsights={aiInsights}
              setAiInsights={setAiInsights}
              generatingAiInsights={generatingAiInsights}
              setGeneratingAiInsights={setGeneratingAiInsights}
              generateOverallRecommendations={generateOverallRecommendations}
              setSelectedPromptDetail={setSelectedPromptDetail}
            />
          )}
          {activeTab === "traffic" && (
            <React.Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
              <TrafficTab
                selectedClient={selectedClient}
                sovTimeSeries={sovTimeSeries}
                onOpenSettings={() => setSettingsOpen(true)}
                ga4={ga4}
              />
            </React.Suspense>
          )}
          {activeTab === "cost" && (
              <CostTab
                filteredAuditResults={filteredAuditResults}
              />
          )}

        </div>
      </main>
      {SettingsSheet()}{AddClientDialog()}{EditClientDialog()}{ManageBrandsDialog()}{BulkPromptsDialog()}{PromptDetailDialog()}{EditPromptDialog()}{EditLocationDialog()}{ImportDialog()}{RunCampaignDialog()}
      <React.Suspense fallback={null}><UserManagement open={userManagementOpen} onOpenChange={setUserManagementOpen} /></React.Suspense>
      <input ref={fileInputRef} type="file" accept=".json,.csv,.txt" className="hidden" onChange={handleFileImport} />
    </div>
  );

  function BrandsTab() {
    return (
      <AgencyBrandsManager
        clients={clients}
        onSelectClient={(id) => { const c = clients.find(x => x.id === id); if (c) switchClient(c); }}
        onAddBrand={() => setAddClientOpen(true)}
        onEditBrand={(id) => {
          const c = clients.find(x => x.id === id);
          if (c) {
            switchClient(c);
            setEditClientForm({ name: c.name, brand_name: c.brand_name || c.name, target_region: c.target_region || "United States", industry: c.industry || "Custom", customIndustry: "", primary_color: c.primary_color || "#3b82f6", logo_url: "", competitors: (c.competitors || []).join(", "), website: c.brand_domain || "" });
            setEditClientOpen(true);
          }
        }}
        auditResults={auditResults}
      />
    );
  }

  function SettingsSheet() {
    return (
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-[400px] bg-white overflow-y-auto">
          <SheetHeader><SheetTitle>Settings</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-6">
            <div>
              <Label className="text-sm font-medium text-gray-900">Brand Tags</Label>
              <p className="text-xs text-gray-500 mb-2">Alternative names for brand detection</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedClient?.brand_tags.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-800 font-medium">
                    {t}
                    <button aria-label={`Remove tag ${t}`} onClick={() => updateBrandTags(selectedClient.brand_tags.filter((_, j) => j !== i))} className="ml-1 text-blue-600 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
                {(!selectedClient?.brand_tags || selectedClient.brand_tags.length === 0) && <span className="text-sm text-gray-400 italic">No tags added</span>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddTag()} className="bg-white" />
                <Button size="sm" onClick={handleAddTag} className="bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-900">Competitors</Label>
              <p className="text-xs text-gray-500 mb-2">Brands to track alongside yours</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedClient?.competitors.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{c}</span>
                    <button aria-label={`Remove competitor ${c}`} onClick={() => updateCompetitors(selectedClient.competitors.filter((_, j) => j !== i))} className="ml-1 text-gray-500 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
                {(!selectedClient?.competitors || selectedClient.competitors.length === 0) && <span className="text-sm text-gray-400 italic">No competitors added</span>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add competitor..." value={newCompetitor} onChange={(e) => setNewCompetitor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor(newCompetitor)} className="bg-white" />
                <Button size="sm" onClick={() => handleAddCompetitor(newCompetitor)} className="bg-green-600 hover:bg-green-700 text-white">Add</Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-900">AI Models</Label>
              <p className="text-xs text-gray-500 mb-2">Select models to query</p>
              <div className="space-y-2">
                {AI_MODELS.map(model => {
                  const Logo = MODEL_LOGOS[model.id]?.Logo;
                  const color = MODEL_LOGOS[model.id]?.color || "#666";
                  const isSelected = selectedModels.includes(model.id);
                  return (
                    <div key={model.id} onClick={() => toggleModel(model.id)} className={cn("flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all", isSelected ? "bg-blue-50 border-blue-400" : "bg-white border-gray-200 hover:border-gray-300")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center", isSelected ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300")}>
                          {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>
                        {Logo && <Logo className="h-6 w-6" style={{ color }} />}
                        <span className={cn("text-sm font-medium", isSelected ? "text-gray-900" : "text-gray-700")}>{model.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Integrations
              </Label>
              <p className="text-xs text-gray-500 mb-3">Connect external data sources to enrich your dashboard</p>
              <GA4ConnectorPanel selectedClient={selectedClient} ga4={ga4} />
            </div>
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium text-red-600">Danger Zone</Label>
              <div className="mt-2 space-y-2">
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200" onClick={clearAllPrompts}><Trash2 className="h-4 w-4 mr-2" /> Clear All Prompts</Button>
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200" onClick={clearResults}><Trash2 className="h-4 w-4 mr-2" /> Clear All Results</Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024) {
      toast.error("Logo file too large. Please use an image under 100KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (isEdit) {
        setEditClientForm(prev => ({ ...prev, logo_url: result }));
      } else {
        setNewClientForm(prev => ({ ...prev, logo_url: result }));
      }
      toast.success("Logo uploaded successfully");
    };
    reader.readAsDataURL(file);
  };

  function AddClientDialog() {
    return (
      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent className="sm:max-w-lg bg-white flex flex-col max-h-[90vh]">
          <DialogHeader className="flex-shrink-0 pb-2">
            <DialogTitle className="text-xl font-semibold text-gray-900">Add New Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Brand Name *</Label>
                <Input
                  placeholder="e.g., Nike"
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, name: e.target.value, brand_name: e.target.value }))}
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Display Name</Label>
                <Input
                  placeholder="e.g., Acme"
                  value={newClientForm.brand_name}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, brand_name: e.target.value }))}
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Industry</Label>
                <Select value={newClientForm.industry} onValueChange={(v) => setNewClientForm(prev => ({ ...prev, industry: v, customIndustry: v === "Custom" ? prev.customIndustry : "" }))}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select industry..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg">
                    {Object.keys(industries).map(ind => (
                      <SelectItem key={ind} value={ind} className="text-gray-900 hover:bg-gray-100 cursor-pointer">{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Target Region</Label>
                <Select value={newClientForm.target_region} onValueChange={(v) => setNewClientForm(prev => ({ ...prev, target_region: v }))}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select region..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg max-h-60">
                    {Object.keys(locations).map(loc => (
                      <SelectItem key={loc} value={loc} className="text-gray-900 hover:bg-gray-100 cursor-pointer">{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newClientForm.industry === "Custom" && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Custom Industry Name</Label>
                <Input
                  placeholder="e.g., AI Technology, Pet Services, FinTech..."
                  value={newClientForm.customIndustry}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, customIndustry: e.target.value }))}
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Enter your specific industry for better content generation</p>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-gray-700">Website URL (optional)</Label>
              <Input
                placeholder="https://www.example.com"
                value={newClientForm.website}
                onChange={(e) => setNewClientForm(prev => ({ ...prev, website: e.target.value }))}
                className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Helps AI generate better content with brand context</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">Competitors (comma-separated)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async (e) => {
                    e.preventDefault();
                    setIsAutoFinding(true);
                    try {
                      const results = await fetchCompetitors(newClientForm.brand_name, newClientForm.industry, newClientForm.target_region);

                      if (results && results.length > 0) {
                        const current = newClientForm.competitors.split(",").map(c => c.trim()).filter(Boolean);
                        const combined = Array.from(new Set([...current, ...results]));
                        setNewClientForm(prev => ({ ...prev, competitors: combined.join(", ") }));
                      } else {
                        toast.info("No competitors found.");
                      }
                    } catch (err) {
                      console.error("Auto-find failed:", err);
                    } finally {
                      setIsAutoFinding(false);
                    }
                  }}
                  disabled={isAutoFinding || !newClientForm.brand_name}
                  className="h-6 text-xs px-2" style={{ color: '#0372ff' }}
                >
                  {isAutoFinding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {isAutoFinding ? "Finding..." : "Auto-Find"}
                </Button>
              </div>
              <Input
                placeholder="e.g., Nike, Adidas, Puma"
                value={newClientForm.competitors}
                onChange={(e) => setNewClientForm(prev => ({ ...prev, competitors: e.target.value }))}
                className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Enter competitor brand names separated by commas</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Brand Color</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={newClientForm.primary_color}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                  />
                  <Input
                    value={newClientForm.primary_color}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="flex-1 bg-white border-gray-300 text-gray-900 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Logo URL (or Upload)</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={newClientForm.logo_url}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, logo_url: e.target.value }))}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <div className="relative">
                    <input
                      type="file"
                      id="new-logo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, false)}
                    />
                    <label
                      htmlFor="new-logo-upload"
                      className="flex items-center justify-center p-2.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 cursor-pointer text-gray-600 transition-colors"
                      title="Upload Logo"
                    >
                      <Upload className="h-4 w-4" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-4 flex-shrink-0">
            <Button variant="outline" onClick={() => setAddClientOpen(false)} className="border-gray-300 text-gray-700 hover:bg-gray-50" disabled={isCreatingClient}>Cancel</Button>
            <Button onClick={handleCreateClient} disabled={!newClientForm.name.trim() || isCreatingClient} className="text-white disabled:opacity-50" style={{ background: '#0372ff' }}>
              {isCreatingClient ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function EditClientDialog() {
    return (
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="sm:max-w-lg bg-white flex flex-col max-h-[90vh]">
          <DialogHeader className="flex-shrink-0 pb-2">
            <DialogTitle className="text-xl font-semibold text-gray-900">Edit Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Brand Name *</Label>
                <Input
                  value={editClientForm.name}
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Display Name</Label>
                <Input
                  value={editClientForm.brand_name}
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, brand_name: e.target.value }))}
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Industry</Label>
                <Select value={editClientForm.industry} onValueChange={(v) => setEditClientForm(prev => ({ ...prev, industry: v, customIndustry: v === "Custom" ? prev.customIndustry : "" }))}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg">
                    {Object.keys(industries).map(ind => (
                      <SelectItem key={ind} value={ind} className="text-gray-900 hover:bg-gray-100">{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Target Region</Label>
                <Select value={editClientForm.target_region} onValueChange={(v) => setEditClientForm(prev => ({ ...prev, target_region: v }))}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg max-h-60">
                    {Object.keys(locations).map(loc => (
                      <SelectItem key={loc} value={loc} className="text-gray-900 hover:bg-gray-100">{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editClientForm.industry === "Custom" && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Custom Industry Name</Label>
                <Input
                  placeholder="e.g., AI Technology, Pet Services, FinTech..."
                  value={editClientForm.customIndustry}
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, customIndustry: e.target.value }))}
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
                <p className="mt-1 text-xs text-gray-500">Enter your specific industry for better content generation</p>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-gray-700">Website URL (optional)</Label>
              <Input
                placeholder="https://www.example.com"
                value={editClientForm.website}
                onChange={(e) => setEditClientForm(prev => ({ ...prev, website: e.target.value }))}
                className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500">Helps AI generate better content with brand context</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">Competitors (comma-separated)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async (e) => {
                    e.preventDefault();
                    setIsAutoFinding(true);
                    try {
                      const results = await fetchCompetitors(editClientForm.brand_name, editClientForm.industry, editClientForm.target_region);

                      if (results && results.length > 0) {
                        const current = editClientForm.competitors.split(",").map(c => c.trim()).filter(Boolean);
                        const combined = Array.from(new Set([...current, ...results]));
                        setEditClientForm(prev => ({ ...prev, competitors: combined.join(", ") }));
                      } else {
                        toast.info("No competitors found. Please try manually.");
                      }
                    } catch (err) {
                      console.error("Auto-find failed:", err);
                    } finally {
                      setIsAutoFinding(false);
                    }
                  }}
                  disabled={isAutoFinding || !editClientForm.brand_name}
                  className="h-6 text-xs px-2" style={{ color: '#0372ff' }}
                >
                  {isAutoFinding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {isAutoFinding ? "Finding..." : "Auto-Find"}
                </Button>
              </div>
              <Input
                placeholder="e.g., Nike, Adidas, Puma"
                value={editClientForm.competitors}
                onChange={(e) => setEditClientForm(prev => ({ ...prev, competitors: e.target.value }))}
                className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Brand Color</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={editClientForm.primary_color}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                  />
                  <Input
                    value={editClientForm.primary_color}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="flex-1 bg-white border-gray-300 text-gray-900 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Logo URL (or Upload)</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={editClientForm.logo_url}
                    onChange={(e) => setEditClientForm(prev => ({ ...prev, logo_url: e.target.value }))}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  />
                  <div className="relative">
                    <input
                      type="file"
                      id="edit-logo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, true)}
                    />
                    <label
                      htmlFor="edit-logo-upload"
                      className="flex items-center justify-center p-2.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 cursor-pointer text-gray-600 transition-colors"
                      title="Upload Logo"
                    >
                      <Upload className="h-4 w-4" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-4 flex justify-between">
            {isAdmin && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDeleteClient}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete Brand
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditClientOpen(false)} className="border-gray-300 text-gray-700">Cancel</Button>
              <Button onClick={handleUpdateClient} disabled={!editClientForm.name.trim()} className="text-white" style={{ background: '#0372ff' }}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function EditPromptDialog() {
    return (
      <Dialog open={editPromptOpen} onOpenChange={setEditPromptOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="prompt-text" className="mb-2 block">Prompt Text</Label>
              <Textarea
                id="prompt-text"
                value={editingPromptText}
                onChange={(e) => setEditingPromptText(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Label htmlFor="prompt-topic" className="mb-2 block">Topic</Label>
              <Input
                id="prompt-topic"
                value={editingPromptTopic}
                onChange={(e) => setEditingPromptTopic(e.target.value)}
                placeholder="e.g. Dating Apps, Best Mattress..."
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Group prompts by topic for analysis in the Topics tab</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPromptOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (editingPromptId && editingPromptText.trim()) {
                try {
                  await updatePrompt(editingPromptId, {
                    prompt_text: editingPromptText.trim(),
                    topic: editingPromptTopic.trim(),
                  });
                  setEditPromptOpen(false);
                } catch (err: any) {
                  toast.error(err.message || "Failed to update prompt");
                }
              }
            }} disabled={!editingPromptText.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function ManageBrandsDialog() {
    return (
      <Dialog open={manageBrandsOpen} onOpenChange={setManageBrandsOpen}>
        <DialogContent className="sm:max-w-2xl bg-white max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Manage Brands</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-3">
              {clients.map(client => (
                <div key={client.id} className={cn("flex items-center justify-between p-4 rounded-xl border-2 transition-all", client.id === selectedClient?.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300")}>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: client.primary_color }}>{client.brand_name.charAt(0)}</div>
                    <div>
                      <div className="font-semibold text-gray-900">{client.name}</div>
                      <div className="text-sm text-gray-500">{client.industry} - {client.target_region}</div>
                      <div className="flex items-center gap-2 mt-1">{client.competitors?.slice(0, 3).map((c, i) => (<span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{c}</span>))}{(client.competitors?.length || 0) > 3 && <span className="text-xs text-gray-400">+{client.competitors.length - 3} more</span>}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.id === selectedClient?.id && <Badge className="bg-blue-100 text-blue-700">Active</Badge>}
                    <Button variant="outline" size="sm" onClick={() => { switchClient(client); setManageBrandsOpen(false); }} className="text-gray-600"><Eye className="h-4 w-4 mr-1" /> View</Button>
                    <Button variant="outline" size="sm" onClick={() => { const clientIndustry = Object.keys(industries).includes(client.industry) ? client.industry : "Custom"; const customInd = Object.keys(industries).includes(client.industry) ? "" : client.industry; setEditClientForm({ name: client.name, brand_name: client.brand_name, target_region: client.target_region, industry: clientIndustry, customIndustry: customInd, primary_color: client.primary_color, logo_url: "", competitors: client.competitors?.join(", ") || "", website: client.brand_domain || "" }); switchClient(client); setManageBrandsOpen(false); setEditClientOpen(true); }} className="text-gray-600"><Settings className="h-4 w-4 mr-1" /> Edit</Button>
                    {isAdmin && <Button variant="outline" size="sm" aria-label={`Delete ${client.name}`} onClick={() => { if (confirm("Delete " + client.name + "?")) deleteClient(client.id); }} className="text-red-600 border-red-200 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => setManageBrandsOpen(false)} className="border-gray-300 text-gray-700">Close</Button>
            <Button onClick={() => { setManageBrandsOpen(false); setAddClientOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4 mr-2" /> Add New Brand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }


  function BulkPromptsDialog() {
    return (<Dialog open={bulkPromptsOpen} onOpenChange={setBulkPromptsOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add Prompts</DialogTitle></DialogHeader><div className="space-y-4">
      {/* Location Selector */}
      <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
        <Label className="text-xs text-blue-700 uppercase tracking-wider flex items-center gap-1"><Globe className="h-3 w-3" /> Target Location (Optional)</Label>
        <Select value={promptLocation || "__default__"} onValueChange={(v) => setPromptLocation(v === "__default__" ? "" : v)}>
          <SelectTrigger className="bg-white h-8 text-sm mt-1.5"><SelectValue placeholder="Use brand's default location" /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="__default__">📍 Use brand's default location</SelectItem>
            {/* Countries */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50">Countries</div>
            <SelectItem value="United States">🇺🇸 United States</SelectItem>
            <SelectItem value="United Kingdom">🇬🇧 United Kingdom</SelectItem>
            <SelectItem value="India">🇮🇳 India</SelectItem>
            <SelectItem value="Thailand">🇹🇭 Thailand</SelectItem>
            <SelectItem value="Australia">🇦🇺 Australia</SelectItem>
            <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
            <SelectItem value="UAE">🇦🇪 UAE</SelectItem>
            <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
            <SelectItem value="Singapore">🇸🇬 Singapore</SelectItem>
            {/* US Cities */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇺🇸 US Cities</div>
            <SelectItem value="US: New York">New York, NY</SelectItem>
            <SelectItem value="US: Los Angeles">Los Angeles, CA</SelectItem>
            <SelectItem value="US: Chicago">Chicago, IL</SelectItem>
            <SelectItem value="US: San Francisco">San Francisco, CA</SelectItem>
            <SelectItem value="US: Miami">Miami, FL</SelectItem>
            <SelectItem value="US: Seattle">Seattle, WA</SelectItem>
            <SelectItem value="US: Boston">Boston, MA</SelectItem>
            <SelectItem value="US: Dallas">Dallas, TX</SelectItem>
            <SelectItem value="US: Austin">Austin, TX</SelectItem>
            <SelectItem value="US: Denver">Denver, CO</SelectItem>
            {/* UK Cities */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇬🇧 UK Cities</div>
            <SelectItem value="UK: London">London</SelectItem>
            <SelectItem value="UK: Manchester">Manchester</SelectItem>
            <SelectItem value="UK: Birmingham">Birmingham</SelectItem>
            <SelectItem value="UK: Edinburgh">Edinburgh</SelectItem>
            {/* India Cities */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇮🇳 India Cities</div>
            <SelectItem value="India: Mumbai">Mumbai</SelectItem>
            <SelectItem value="India: Delhi">Delhi</SelectItem>
            <SelectItem value="India: Bangalore">Bangalore</SelectItem>
            <SelectItem value="India: Hyderabad">Hyderabad</SelectItem>
            <SelectItem value="India: Chennai">Chennai</SelectItem>
            {/* Thailand Cities */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇹🇭 Thailand Cities</div>
            <SelectItem value="Thailand: Bangkok">Bangkok</SelectItem>
            <SelectItem value="Thailand: Chiang Mai">Chiang Mai</SelectItem>
            <SelectItem value="Thailand: Phuket">Phuket</SelectItem>
            {/* Australia Cities */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇦🇺 Australia Cities</div>
            <SelectItem value="Australia: Sydney">Sydney</SelectItem>
            <SelectItem value="Australia: Melbourne">Melbourne</SelectItem>
            {/* UAE Cities */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇦🇪 UAE Cities</div>
            <SelectItem value="UAE: Dubai">Dubai</SelectItem>
            <SelectItem value="UAE: Abu Dhabi">Abu Dhabi</SelectItem>
            {/* Canada Cities */}
            <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇨🇦 Canada Cities</div>
            <SelectItem value="Canada: Toronto">Toronto</SelectItem>
            <SelectItem value="Canada: Vancouver">Vancouver</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-blue-600 mt-1">AI responses will be personalized for this location</p>
      </div>
      {/* Topic / Seed Keyword */}
      <div>
        <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1"><Tag className="h-3 w-3" /> Topic / Keyword</Label>
        <Input placeholder="e.g. running shoes, athletic wear..." value={promptTopic} onChange={(e) => setPromptTopic(e.target.value)} className="mt-1.5" />
        <p className="text-xs text-gray-400 mt-1">Group prompts under a topic for aggregated metrics in the Topics tab</p>
      </div>
      <div><Label>Single Prompt</Label><div className="flex gap-2 mt-1"><Input placeholder="Enter a search prompt..." value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddPrompt()} /><Button onClick={handleAddPrompt}>Add</Button></div></div>
      <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or bulk add</span></div></div>
      <div><Label>Multiple Prompts (one per line)</Label><Textarea placeholder={"Prompt 1\nPrompt 2\nPrompt 3"} value={bulkPrompts} onChange={(e) => setBulkPrompts(e.target.value)} rows={6} className="mt-1" /></div>

      <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or generate with AI</span></div></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Tone</Label>
          <Select value={genTone} onValueChange={setGenTone}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral (Standard)</SelectItem>
              <SelectItem value="investigative">Investigative</SelectItem>
              <SelectItem value="commercial">Commercial/Buying</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Focus</Label>
          <Select value={genFocus} onValueChange={setGenFocus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General Visibility</SelectItem>
              <SelectItem value="comparison">Competitor Comparison</SelectItem>
              <SelectItem value="features">Feature Specific</SelectItem>
              <SelectItem value="price">Price/Cost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs text-gray-500 uppercase tracking-wider block">Seed Prompts</Label>
        </div>
        <div className="flex gap-2">
          <Input placeholder="e.g. brand strategy, market positioning, competitors" value={seedKeywords} onChange={(e) => setSeedKeywords(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleGeneratePrompts()} />
          <Button onClick={handleGeneratePrompts} disabled={generatingPrompts || !seedKeywords.trim()} className="bg-blue-600 hover:bg-blue-700 text-white w-12 p-0 flex-shrink-0">
            {generatingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI will generate 5 relevant search prompts to track based on these inputs.</p>
      </div>
    </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setImportDialogOpen(true); setBulkPromptsOpen(false); }}>Import File</Button>
        <Button onClick={handleBulkAdd} disabled={!bulkPrompts.trim()}>Add {parseBulkPrompts(bulkPrompts).length} Prompts</Button>
      </DialogFooter>
    </DialogContent>
    </Dialog>
    );
  }

  function PromptDetailDialog() {
    const result = filteredAuditResults.find(r => r.prompt_id === selectedPromptDetail);
    const prompt = prompts.find(p => p.id === selectedPromptDetail);
    const [detailTab, setDetailTab] = useState<"models" | "past_responses" | "citations" | "tavily" | "content" | "insights">("models");
    const [pastResponsesCitationFilter, setPastResponsesCitationFilter] = useState<"all" | "new" | "common" | "unused">("all");
    const [generatedVisibilityContent, setGeneratedVisibilityContent] = useState<string | null>(null);
    const [generatingVisibilityContent, setGeneratingVisibilityContent] = useState(false);
    const [recommendations, setRecommendations] = useState<PromptInsightResult | null>(null);
    const [generatingRecommendations, setGeneratingRecommendations] = useState(false);

    // Date toggle for viewing past responses inline
    const [selectedResponseDate, setSelectedResponseDate] = useState<string | null>(null);

    // Get all available dates for this prompt
    const promptHistory = useMemo(() => {
      return auditResults
        .filter(r => r.prompt_id === selectedPromptDetail)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [auditResults, selectedPromptDetail]);

    const availableDates = useMemo(() => {
      return promptHistory.map(r => r.created_at.split('T')[0]);
    }, [promptHistory]);

    // Get the result for the selected date (or latest if none selected)
    const displayResult = useMemo(() => {
      if (!selectedResponseDate) return result;
      const matchingResult = promptHistory.find(r => r.created_at.split('T')[0] === selectedResponseDate);
      return matchingResult || result;
    }, [selectedResponseDate, promptHistory, result]);

    const currentDateIndex = useMemo(() => {
      if (!selectedResponseDate) return 0;
      return availableDates.indexOf(selectedResponseDate);
    }, [selectedResponseDate, availableDates]);

    const navigateDate = (direction: number) => {
      const newIndex = Math.max(0, Math.min(availableDates.length - 1, currentDateIndex + direction));
      setSelectedResponseDate(availableDates[newIndex] || null);
    };

    if (!result && !prompt) return null;
    const allPromptCitations = displayResult?.model_results.flatMap(mr => mr.citations.map(c => ({ ...c, model: mr.model_name }))) || [];
    const uniqueCitations = Array.from(new Map(allPromptCitations.map(c => [c.url, c])).values());
    const tavilyData = selectedPromptDetail ? tavilyResults[selectedPromptDetail] as any : null;

    // Calculate average rank using shared helper (consistent with overview card and prompts table)
    const computedAvgRank = computePositionForResult(displayResult, selectedClient);

    const handleGenerateVisibilityContent = async () => {
      if (!prompt && !result) return;
      setGeneratingVisibilityContent(true);
      setGeneratedVisibilityContent(null);
      try {
        const content = await generateVisibilityContent(
          prompt?.prompt_text || result?.prompt_text || "",
          result || null,
          tavilyData
        );
        setGeneratedVisibilityContent(content);
        if (content) {
          setDetailTab("content");
          saveToContentHistory({
            id: Date.now().toString(),
            title: prompt?.prompt_text || result?.prompt_text || "Generated Article",
            content,
            createdAt: new Date().toISOString(),
            source: 'prompt_detail',
            promptText: prompt?.prompt_text || result?.prompt_text,
          });
        }
      } catch (err) {
        console.error("Error generating content:", err);
      } finally {
        setGeneratingVisibilityContent(false);
      }
    };

    const handleGenerateRecommendations = async () => {
      if (!prompt && !result) return;
      setGeneratingRecommendations(true);
      setRecommendations(null);
      try {
        const recs = await generateRecommendations(
          prompt?.prompt_text || result?.prompt_text || "",
          result || null,
          tavilyData
        );
        setRecommendations(recs);
        if (recs) setDetailTab("insights");
      } catch (err) {
        console.error("Error generating recommendations:", err);
      } finally {
        setGeneratingRecommendations(false);
      }
    };

    return (
      <Dialog open={!!selectedPromptDetail} onOpenChange={() => setSelectedPromptDetail(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold text-gray-900 pr-8 leading-tight">{prompt?.prompt_text || result?.prompt_text}</DialogTitle>
          </DialogHeader>
          {result ? (
            <div className="space-y-6 pt-4">
              {/* Stats Cards - Compact */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-2 text-center">
                  <div className="text-2xl font-bold text-green-700">{displayResult?.summary.share_of_voice || 0}%</div>
                  <div className="text-xs font-medium text-green-600 mt-0.5">Visibility</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-2 text-center">
                  <div className="text-2xl font-bold text-blue-700">{computedAvgRank ? `#${computedAvgRank}` : "--"}</div>
                  <div className="text-xs font-medium text-blue-600 mt-0.5">Avg Position</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-2 text-center">
                  <div className="text-2xl font-bold text-purple-700">{displayResult?.summary.total_citations || 0}</div>
                  <div className="text-xs font-medium text-purple-600 mt-0.5">Citations</div>
                </div>
                {/* Competitor Count */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-2 text-center">
                  {(() => {
                    // Count ALL competitors mentioned across all model results
                    const allCompetitorMentions = new Set<string>();
                    result.model_results.forEach(mr => {
                      const responseText = (mr.raw_response || "").toLowerCase();
                      (selectedClient?.competitors || []).forEach(comp => {
                        if (responseText.includes(comp.toLowerCase())) {
                          allCompetitorMentions.add(comp);
                        }
                      });
                    });
                    const count = allCompetitorMentions.size;
                    return (
                      <>
                        <div className="text-2xl font-bold text-amber-700">{count}</div>
                        <div className="text-xs font-medium text-amber-600 mt-0.5">Competitors</div>
                      </>
                    );
                  })()}
                </div>
              </div>



              {/* Tabs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setDetailTab("models")} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", detailTab === "models" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Model Results</button>
                  <button onClick={() => setDetailTab("past_responses")} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", detailTab === "past_responses" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Past Responses</button>
                  <button onClick={() => setDetailTab("citations")} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all", detailTab === "citations" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Citations ({uniqueCitations.length})</button>
                  {isAdmin && <button onClick={() => setDetailTab("tavily")} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5", detailTab === "tavily" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Discovery Engine</button>}
                  <button onClick={() => { if (recommendations) setDetailTab("insights"); else handleGenerateRecommendations(); }} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5", detailTab === "insights" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
                    {generatingRecommendations ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
                    Insights
                  </button>
                  {generatedVisibilityContent && (
                    <button onClick={() => setDetailTab("content")} className={cn("px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5", detailTab === "content" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}><Wand2 className="h-3.5 w-3.5" />Generated</button>
                  )}
                </div>
                <Button
                  onClick={handleGenerateVisibilityContent}
                  disabled={generatingVisibilityContent}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  {generatingVisibilityContent ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</>
                  ) : (
                    <><Wand2 className="h-4 w-4 mr-2" />Generate Article</>
                  )}
                </Button>
              </div>

              {/* Model Results Tab */}
              {detailTab === "models" && (
                <div className="space-y-4">
                  {/* Date Toggle */}
                  {availableDates.length > 1 && (
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigateDate(1)}
                          disabled={currentDateIndex >= availableDates.length - 1}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4 text-gray-600" />
                        </button>
                        <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                          {selectedResponseDate
                            ? new Date(selectedResponseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : new Date(displayResult?.created_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          }
                        </span>
                        <button
                          onClick={() => navigateDate(-1)}
                          disabled={currentDateIndex <= 0}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                      <span className="text-xs text-gray-500">
                        {currentDateIndex === 0 ? 'Viewing latest response' : `${availableDates.length - currentDateIndex} of ${availableDates.length} runs`}
                      </span>
                    </div>
                  )}

                  {/* Enforce strict order based on AI_MODELS constant */}
                  {AI_MODELS.map((modelDef, i) => {
                    // Find corresponding result for this model
                    const mr = displayResult?.model_results.find(r => r.model === modelDef.id);

                    // If no result for this model, skip it (or show placeholder if desired)
                    if (!mr) return null;

                    const Logo = MODEL_LOGOS[mr.model]?.Logo;
                    const color = MODEL_LOGOS[mr.model]?.color || "#666";

                    // Clean response text for display and analysis (handles historical data)
                    const { cleanedResponse, brandRank: computedRank } = cleanAndAnalyzeResponse(
                      mr.raw_response || "",
                      selectedClient?.brand_name || "",
                      selectedClient?.competitors || [],
                      selectedClient?.brand_tags || []
                    );

                    // Competitor Analysis
                    const responseText = cleanedResponse.toLowerCase();
                    let competitorMentions = (mr.competitors_found || []).map(c => ({
                      name: c.name,
                      count: c.count,
                      rank: c.rank
                    }));

                    // Merge: ensure ALL configured competitors that are mentioned (via normalized matching) appear
                    const mentionedNames = new Set(competitorMentions.map(c => c.name.toLowerCase()));
                    (selectedClient?.competitors || []).forEach(comp => {
                      // Skip if already present (exact or normalized match)
                      if (mentionedNames.has(comp.toLowerCase())) return;
                      if (competitorMentions.some(cm => brandNamesMatch(cm.name, comp))) return;
                      // Use normalized matching to detect mentions
                      if (brandMentionedInText(cleanedResponse, comp)) {
                        // Count occurrences
                        const compLower = comp.toLowerCase();
                        const compToken = normalizeBrandToken(comp);
                        let count = 0;
                        // Try exact match first
                        const exactMatches = responseText.match(new RegExp(compLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"));
                        if (exactMatches) count = exactMatches.length;
                        // Try normalized token match
                        if (count === 0 && compToken.length >= 3) {
                          const tokenRegex = new RegExp(`\\b${compToken}\\b`, "gi");
                          const tokenMatches = responseText.replace(/[^a-z0-9\s]/g, '').match(tokenRegex);
                          if (tokenMatches) count = tokenMatches.length;
                        }
                        if (count > 0) {
                          competitorMentions.push({ name: comp, count, rank: null });
                        }
                      }
                    });

                    // Fallback for old data or if competitors_found is empty but regex finds matches
                    if (competitorMentions.length === 0) {
                      competitorMentions = (selectedClient?.competitors || []).map(comp => {
                        if (brandMentionedInText(cleanedResponse, comp)) {
                          const compLower = comp.toLowerCase();
                          const exactMatches = responseText.match(new RegExp(compLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"));
                          return { name: comp, count: exactMatches ? exactMatches.length : 1, rank: null as number | null };
                        }
                        return { name: comp, count: 0, rank: null as number | null };
                      }).filter(c => c.count > 0);
                    }

                    competitorMentions.sort((a, b) => a.name.localeCompare(b.name));

                    const topCompetitor = competitorMentions[0];

                    return (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Model Header */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            {Logo && <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100"><Logo className="h-5 w-5" style={{ color }} /></div>}
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{mr.model_name}</span>
                              {/* Show indicator for Google AI Overview status */}
                              {mr.model === "google_ai_overview" && (
                                mr.is_ai_overview === true ? (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">AI Overview</span>
                                ) : mr.raw_response ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Featured Snippet</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">No AI Data</span>
                                )
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {mr.brand_mentioned ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium"><CheckCircle className="h-4 w-4" /> Visible</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm font-medium">Not Visible</span>
                            )}
                            {(() => {
                              // Only show rank when the brand is actually visible for this model
                              if (!mr.brand_mentioned) return null;
                              // Layer 1: DB brand_rank, Layer 2: parsed from numbered list, Layer 3: extracted_brands position, Layer 4: mention order
                              let rank: number | null = mr.brand_rank || computedRank || null;
                              if (!rank && mr.extracted_brands) {
                                const ownBrand = mr.extracted_brands.find((eb: any) => eb.is_own_brand && eb.position);
                                if (ownBrand) rank = ownBrand.position;
                              }
                              if (!rank && mr.raw_response && selectedClient) {
                                const text = mr.raw_response.toLowerCase();
                                const brandIdx = text.indexOf(selectedClient.brand_name.toLowerCase());
                                if (brandIdx !== -1) {
                                  rank = 1;
                                  (selectedClient.competitors || []).forEach((comp: string) => {
                                    const compIdx = text.indexOf(comp.toLowerCase());
                                    if (compIdx !== -1 && compIdx < brandIdx) rank!++;
                                  });
                                }
                              }
                              return rank ? <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">#{rank}</span> : null;
                            })()}
                            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">{mr.citations.length} citations</span>
                          </div>
                        </div>

                        {/* Response Preview */}
                        {cleanedResponse && (
                          <div className="p-4 border-b border-gray-100">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">AI Response</div>
                            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed max-w-none prose prose-sm prose-blue">
                              {/* Enhanced markdown-style formatting */}
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed text-[15px] max-w-3xl" {...props} />,
                                  a: ({ node, ...props }) => <a className="text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                                  ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-5 space-y-2.5 text-[15px] max-w-3xl" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-5 space-y-2.5 text-[15px] max-w-3xl" {...props} />,
                                  li: ({ node, ...props }) => <li className="pl-1 text-gray-700 marker:text-gray-400" {...props} />,
                                  h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-8 mb-4 text-gray-900 tracking-tight" {...props} />,
                                  h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-6 mb-3 text-gray-900 tracking-tight" {...props} />,
                                  h3: ({ node, ...props }) => <h3 className="text-[1.05rem] font-bold mt-5 mb-2 text-gray-900 tracking-tight" {...props} />,
                                  code: ({ node, ...props }) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px] font-mono text-slate-800 border border-slate-200" {...props} />,
                                  strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                                }}
                              >
                                {mr.model === "google_ai_overview" ? formatAIOverviewForDisplay(cleanedResponse) : cleanedResponse}
                              </ReactMarkdown>
                            </div>

                            {/* Competitor Mentions Block */}
                            {(() => {
                              // For non-admin: only show tracked competitor brands
                              // For admin: show all detected brands with option to add as competitor
                              const displayMentions = isAdmin
                                ? competitorMentions
                                : competitorMentions.filter(c => selectedClient?.competitors.some(tc => brandNamesMatch(tc, c.name)));
                              const displayTop = displayMentions[0] || null;

                              if (displayMentions.length === 0) return null;

                              return (
                                <div className="mt-4 pt-3 border-t border-gray-200">
                                  <div className="flex flex-col gap-3">
                                    {displayTop && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-medium uppercase">Top mentioned:</span>
                                        <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200">{displayTop.name}</Badge>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs text-gray-400 font-medium uppercase">
                                        {isAdmin ? "All brands mentioned:" : "Competitor brands mentioned:"}
                                      </span>
                                      {displayMentions.map((comp, k) => {
                                        const isTracked = selectedClient?.competitors.some(c => brandNamesMatch(c, comp.name));
                                        return (
                                          <div key={k} className="flex items-center gap-1">
                                            <Badge variant="secondary" className={cn("text-xs border", isTracked ? "text-gray-600 bg-gray-100 hover:bg-gray-200 border-gray-200" : "text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200")}>
                                              {comp.name} {comp.rank ? <span className="ml-1 font-semibold text-blue-600">#{comp.rank}</span> : <span className="text-gray-400 ml-1">({comp.count}x)</span>}
                                              {isAdmin && isTracked && <CheckCircle className="h-3 w-3 ml-1 text-green-500 inline" />}
                                            </Badge>
                                            {isAdmin && !isTracked && (
                                              <button onClick={() => handleAddCompetitor(comp.name)} className="text-blue-600 hover:bg-blue-50 rounded-full p-0.5 transition-colors" title="Add to competitors">
                                                <Plus className="h-3 w-3" />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Citations - shown below response */}
                        {mr.citations.length > 0 && (
                          <div className="p-4 border-b border-gray-100">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Sources Cited ({mr.citations.length})</div>
                            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                              {mr.citations.map((c, j) => (
                                <a key={j} href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors group">
                                  <img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`} alt="" className="h-4 w-4 rounded flex-shrink-0" />
                                  <span className="text-sm text-gray-700 truncate flex-1 group-hover:text-gray-900">{c.title || c.domain}</span>
                                  <ExternalLink className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Show indicator for AI Overview source type */}
                        {mr.model === "google_ai_overview" && mr.raw_response && mr.is_ai_overview === false && (
                          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                            ⚠️ This content is from <strong>Featured Snippet</strong>, not Google's AI Overview. AI Overview was not available for this query.
                          </div>
                        )}
                        {/* Show 'No AI Overview available' message when Google AI Overview has no response */}
                        {!mr.raw_response && mr.model === "google_ai_overview" && (
                          <div className="p-4 border-b border-gray-100">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">AI Response</div>
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                              <span className="text-gray-600 font-medium">No AI Overview available for this prompt</span>
                              <p className="text-xs text-gray-500 mt-1">Google did not generate an AI Overview or Featured Snippet for this query.</p>
                            </div>
                          </div>
                        )}

                        {/* Extracted Brands - admin only */}
                        {isAdmin && mr.extracted_brands && mr.extracted_brands.length > 0 && (
                          <div className="p-4 border-b border-gray-100">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Brands Mentioned ({mr.extracted_brands.length})</div>
                            <div className="flex flex-wrap gap-2">
                              {mr.extracted_brands.map((brand, j) => {
                                // Use backend flags but also do client-side normalized check
                                const isOwnBrand = brand.is_own_brand || brandNamesMatch(brand.title, selectedClient?.brand_name || '') || (selectedClient?.brand_tags || []).some(t => brandNamesMatch(brand.title, t));
                                const isCompetitor = brand.is_competitor || (selectedClient?.competitors || []).some(c => brandNamesMatch(c, brand.title));
                                const isNew = !isOwnBrand && !isCompetitor;

                                return (
                                  <div key={j} className="flex items-center gap-1">
                                    <Badge
                                      variant={isOwnBrand ? "default" : "secondary"}
                                      className={cn(
                                        "text-xs",
                                        isOwnBrand && "bg-green-100 text-green-700 border-green-200 hover:bg-green-200",
                                        isCompetitor && "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
                                        isNew && "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                                      )}
                                      title={brand.positions && brand.positions.length > 1
                                        ? `Positions: ${brand.positions.join(", ")}`
                                        : `Position: ${brand.position}`
                                      }
                                    >
                                      {brand.title}
                                      <span className="ml-1 opacity-70">({brand.mention_count}x)</span>
                                      {brand.entity_points && brand.entity_points > 0.5 && (
                                        <span className="ml-1 text-purple-500 font-medium" title="Entity Points Score">
                                          {brand.entity_points.toFixed(2)}pts
                                        </span>
                                      )}
                                      {/* Show average rank for all brands */}
                                      {brand.positions && brand.positions.length > 0 && (
                                        <span
                                          className={cn(
                                            "ml-1 font-medium",
                                            brand.position <= 3 ? "text-amber-500" : "text-gray-500"
                                          )}
                                          title={`Avg rank: ${(brand.positions.reduce((a, b) => a + b, 0) / brand.positions.length).toFixed(1)}`}
                                        >
                                          #{brand.position}
                                          {brand.positions.length > 1 && (
                                            <span className="opacity-60"> (avg: {(brand.positions.reduce((a, b) => a + b, 0) / brand.positions.length).toFixed(1)})</span>
                                          )}
                                        </span>
                                      )}
                                    </Badge>
                                    {isNew && (
                                      <button
                                        onClick={() => handleAddCompetitor(brand.title)}
                                        className="text-blue-600 hover:bg-blue-50 rounded-full p-0.5 transition-colors"
                                        title="Add to competitors"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span>Your brand</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span>Known competitor</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>New discovery</span>
                              <span className="flex items-center gap-1 ml-2 border-l pl-2"><span className="text-purple-500 font-medium">pts</span>= Entity Points (earlier mentions score higher)</span>
                            </div>
                          </div>
                        )}




                      </div>
                    );
                  })}
                </div>
              )}

              {/* Citations Tab */}
              {detailTab === "citations" && (
                <div className="space-y-3">
                  {uniqueCitations.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                      <Link2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500 font-medium">No citations found for this prompt</p>
                    </div>
                  ) : (
                    uniqueCitations.map((c, i) => {
                      const nc4 = normalizeCitationCategory(citationMeta?.[c.domain]?.category); const t = DOMAIN_TYPES[(nc4 && nc4 !== 'other') ? nc4 : classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name)] || DOMAIN_TYPES.other;
                      const modelsUsing = allPromptCitations.filter(x => x.url === c.url).map(x => x.model);
                      return (
                        <div key={i} className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow">
                          <img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=24`} alt="" className="h-6 w-6 mt-0.5 rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-base font-medium text-gray-900 hover:text-blue-600 line-clamp-1">{c.title || c.url}</a>
                                <p className="text-sm text-gray-500 truncate mt-0.5">{c.url}</p>
                              </div>
                              <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0", t.bg, t.color)}>{t.label}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-xs text-gray-500 font-medium">Cited by:</span>
                              {[...new Set(modelsUsing)].map((m, j) => <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">{m}</span>)}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <button aria-label="Copy URL to clipboard" onClick={() => navigator.clipboard.writeText(c.url)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><Copy className="h-4 w-4" /></button>
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ExternalLink className="h-4 w-4" /></a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Past Responses Tab */}
              {detailTab === "past_responses" && (() => {
                // Get all audit runs for this specific prompt
                const promptHistory = auditResults.filter(r => r.prompt_id === selectedPromptDetail)
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // Sort ascending for history calculation

                // Calculate historical citation data
                const domainAppearanceDates = new Map<string, Date>(); // Domain -> First seen date
                const domainCounts = new Map<string, number>(); // Domain -> Total count

                promptHistory.forEach(run => {
                  const runDate = new Date(run.created_at);
                  const citations = run.model_results.flatMap(mr => mr.citations);
                  const uniqueDomains = new Set(citations.map(c => c.domain));

                  uniqueDomains.forEach(domain => {
                    if (!domainAppearanceDates.has(domain)) {
                      domainAppearanceDates.set(domain, runDate);
                    }
                    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
                  });
                });

                // Classify runs based on citations
                const classifiedRuns = promptHistory.map(run => {
                  const runDate = new Date(run.created_at);
                  const citations = run.model_results.flatMap(mr => mr.citations);
                  const uniqueDomains = new Set(citations.map(c => c.domain));

                  let hasNew = false;
                  let hasCommon = false;
                  let hasUnused = false; // "Unused" interpreted as "Rare" (count <= 1)

                  uniqueDomains.forEach(domain => {
                    const firstSeen = domainAppearanceDates.get(domain);
                    const count = domainCounts.get(domain) || 0;

                    // New: First seen in this run (compare timestamps loosely)
                    if (firstSeen && Math.abs(firstSeen.getTime() - runDate.getTime()) < 1000) {
                      hasNew = true;
                    }
                    // Common: Appears in > 3 runs (or > 30% of history if many runs?) Let's say > 2.
                    if (count > 2) {
                      hasCommon = true;
                    }
                    // Unused/Rare: Appears only once or twice
                    if (count <= 2) {
                      hasUnused = true;
                    }
                  });

                  return { ...run, hasNew, hasCommon, hasUnused };
                }).reverse(); // Sort descending for display (newest first)

                // Filter runs
                const filteredHistory = classifiedRuns.filter(run => {
                  if (pastResponsesCitationFilter === "all") return true;
                  if (pastResponsesCitationFilter === "new") return run.hasNew;
                  if (pastResponsesCitationFilter === "common") return run.hasCommon;
                  if (pastResponsesCitationFilter === "unused") return run.hasUnused;
                  return true;
                });

                return (
                  <div className="space-y-4">


                    {filteredHistory.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-xl">
                        <History className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600 font-medium">No runs match this filter</p>
                        <p className="text-sm text-gray-500 mt-1">Try selecting a different filter.</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Visibility</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Position</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Brands</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Citations</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-16 px-6"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredHistory.map((run, idx) => {
                              const citationCount = run.model_results.reduce((sum, mr) => sum + mr.citations.length, 0);
                              const sov = run.summary.share_of_voice || 0;

                              // Calculate average rank using shared helper (consistent everywhere)
                              const avgRank = computePositionForResult(run, selectedClient);

                              // Extract unique brands from extracted_brands or fallback
                              const uniqueBrands = new Set<string>();
                              run.model_results.forEach(mr => {
                                if (mr.extracted_brands && mr.extracted_brands.length > 0) {
                                  mr.extracted_brands.forEach(b => uniqueBrands.add(b.title));
                                } else if (mr.brand_mentioned) {
                                  // Fallback for older runs if brands weren't extracted
                                  uniqueBrands.add(selectedClient?.brand_name || "Client");
                                }
                              });

                              // Convert to array and prioritize own brand
                              const brandsArray = Array.from(uniqueBrands).sort((a, b) => {
                                const aIsOwn = a.toLowerCase() === (selectedClient?.brand_name || "").toLowerCase();
                                const bIsOwn = b.toLowerCase() === (selectedClient?.brand_name || "").toLowerCase();
                                if (aIsOwn) return -1;
                                if (bIsOwn) return 1;
                                return a.localeCompare(b);
                              });

                              const displayBrands = brandsArray.slice(0, 5);
                              const overflowCount = brandsArray.length - displayBrands.length;

                              return (
                                <tr key={run.id || idx} className="hover:bg-gray-50/50 transition-colors group">
                                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    <div className="flex items-center gap-2">
                                      {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      {run.hasNew && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-[10px] px-1.5 py-0 h-4">New</Badge>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className={cn(
                                      "inline-flex items-center justify-center font-bold text-lg",
                                      sov >= 70 ? "text-green-600" : sov >= 30 ? "text-yellow-600" : sov > 0 ? "text-orange-600" : "text-gray-400"
                                    )}>
                                      {sov}%
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className={cn(
                                      "inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg font-bold",
                                      avgRank ? (avgRank <= 3 ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-gray-50 text-gray-600 border border-gray-100") : "text-gray-300"
                                    )}>
                                      {avgRank ? `#${avgRank}` : "—"}
                                    </div>
                                  </td>
                                  {/* Brands Column */}
                                  <td className="px-4 py-4">
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      {displayBrands.length > 0 ? (
                                        <>
                                          {displayBrands.map((brand, i) => {
                                            const domain = `${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                                            const isOwn = brand.toLowerCase() === (selectedClient?.brand_name || "").toLowerCase();

                                            return (
                                              <div key={i} className={cn(
                                                "flex items-center justify-center h-7 w-7 rounded-md border transition-all hover:scale-110",
                                                isOwn ? "bg-green-50 border-green-200 shadow-sm ring-1 ring-green-100" : "bg-white border-gray-200 shadow-sm"
                                              )} title={brand}>
                                                <img
                                                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                                  alt={brand}
                                                  className="h-4 w-4 rounded-sm"
                                                  onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement!.innerText = brand.charAt(0).toUpperCase();
                                                    e.currentTarget.parentElement!.className += " text-[10px] font-bold text-gray-500 uppercase flex items-center justify-center w-full h-full";
                                                  }}
                                                />
                                              </div>
                                            );
                                          })}
                                          {overflowCount > 0 && (
                                            <div className="h-7 w-7 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shadow-sm">
                                              +{overflowCount}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">None</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                      {citationCount}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button
                                      onClick={() => {
                                        setSelectedResponseDate(run.created_at);
                                        setDetailTab("models");
                                      }}
                                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:scale-110"
                                      title="View details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tavily Tab */}
              {detailTab === "tavily" && (
                <div className="space-y-4">
                  {tavilyData ? (
                    <>
                      {/* Tavily Answer */}
                      {tavilyData.answer && (
                        <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4">
                          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                            AI-Generated Answer
                          </div>
                          <p className="text-gray-800 leading-relaxed">{tavilyData.answer}</p>
                        </div>
                      )}

                      {/* Analysis Cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Brand Visibility</div>
                          <div className="flex items-center gap-3">
                            {tavilyData.analysis?.brand_mentioned ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                <CheckCircle className="h-4 w-4" /> Mentioned {tavilyData.analysis.brand_mention_count || 0}x
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                                <X className="h-4 w-4" /> Not Found
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Competitor Mentions</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(tavilyData.analysis?.competitor_mentions || {}).filter(([_, v]) => (v as number) > 0).map(([name, count]) => {
                              const isTracked = selectedClient?.competitors.some(c => c.toLowerCase() === name.toLowerCase());
                              return (
                                <div key={name} className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                                    {name}: {count as number}x
                                  </Badge>
                                  {!isTracked && (
                                    <button onClick={() => handleAddCompetitor(name)} className="text-blue-600 hover:bg-blue-50 rounded-full p-0.5 transition-colors" title="Add to competitors">
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {Object.values(tavilyData.analysis?.competitor_mentions || {}).every((v) => (v as number) === 0) && (
                              <span className="text-sm text-gray-400">No competitors found</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Domains */}
                      {tavilyData.analysis?.top_domains?.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Domains (Influence Sources)</div>
                          <div className="grid grid-cols-2 gap-2">
                            {tavilyData.analysis.top_domains.slice(0, 10).map((d: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                <img src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`} alt="" className="h-4 w-4 rounded" />
                                <span className="text-sm text-gray-700 flex-1 truncate">{d.domain}</span>
                                <span className="text-xs text-gray-500 font-medium">{d.count}x</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Source Types */}
                      {tavilyData.analysis?.source_types && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Source Types</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(tavilyData.analysis.source_types).filter(([_, v]) => (v as number) > 0).map(([type, count]) => (
                              <Badge key={type} variant="secondary" className="capitalize">
                                {type}: {count as number}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Insights */}
                      {tavilyData.analysis?.insights?.length > 0 && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">AI Insights</div>
                          <ul className="space-y-2">
                            {tavilyData.analysis.insights.map((insight: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* All Sources */}
                      {tavilyData.sources?.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <div className="p-4 border-b border-gray-100">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Web Sources ({tavilyData.sources.length})</div>
                          </div>
                          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                            {tavilyData.sources.map((source: any, i: number) => (
                              <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
                                <img src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=24`} alt="" className="h-6 w-6 rounded mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 line-clamp-1">{source.title}</div>
                                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{source.content?.substring(0, 150)}...</p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                    <span>{source.domain}</span>
                                    {source.score && <span className="px-1.5 py-0.5 bg-gray-100 rounded">Score: {(source.score * 100).toFixed(0)}%</span>}
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-600 font-medium mb-2">No Discovery Engine data available</p>
                      <p className="text-sm text-gray-500 mb-4">Enable "Discovery On" and re-run this prompt to see AI source analysis.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Generated Content Tab */}
              {detailTab === "content" && (
                <div className="space-y-4">
                  {generatedVisibilityContent ? (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg shadow-purple-200">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900">AI-Generated Visibility Content</span>
                            <p className="text-xs text-gray-500 mt-0.5">Optimized for AI search visibility</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs px-2.5 py-1 bg-white/80 backdrop-blur rounded-full text-gray-600 font-medium shadow-sm">{generatedVisibilityContent.length.toLocaleString()} characters</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(generatedVisibilityContent)}
                            className="text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-all"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                          </Button>
                        </div>
                      </div>
                      <div className="p-6 max-h-[60vh] overflow-y-auto bg-gradient-to-b from-white to-gray-50/50">
                        <article className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700">
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {generatedVisibilityContent.split('\n').map((line, i) => {
                              if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-100">{line.replace('# ', '')}</h1>;
                              if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold text-gray-800 mt-6 mb-3">{line.replace('## ', '')}</h2>;
                              if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-medium text-gray-800 mt-5 mb-2">{line.replace('### ', '')}</h3>;
                              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-gray-700 my-1 pl-2">{line.replace(/^[-*] /, '')}</li>;
                              if (line.startsWith('**') && line.endsWith('**')) return <strong key={i} className="font-semibold text-gray-900 block my-2">{line.replace(/\*\*/g, '')}</strong>;
                              if (line.trim() === '') return <div key={i} className="h-3" />;
                              return <p key={i} className="mb-3 text-gray-700 leading-relaxed">{line}</p>;
                            })}
                          </div>
                        </article>
                      </div>
                      {/* AI Disclaimer */}
                      <div className="px-6 py-3 border-t border-amber-100 bg-amber-50">
                        <div className="flex items-start gap-2">
                          <svg className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            <span className="font-semibold">Important Notice:</span> This content is AI-generated and engineered for high-intent visibility across Large Language Models. While optimized for brand tone and relevance, all outputs must be reviewed, fact-checked, and verified by a human editor or professional writer prior to publishing to ensure absolute accuracy and compliance with brand standards.
                          </p>
                        </div>
                      </div>
                      <div className="p-4 border-t border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex-shrink-0 shadow-sm">
                            <Lightbulb className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">How to maximize AI visibility</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Publish on your blog with proper schema markup. Share on social media and industry forums. Pitch to authoritative sites for backlinks. The more high-quality sources reference this content, the more likely AI models will cite your brand.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="bg-gradient-to-br from-purple-100 to-indigo-100 h-20 w-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Wand2 className="h-10 w-10 text-purple-500" />
                      </div>
                      <p className="text-gray-800 font-semibold text-lg mb-2">Generate AI-Optimized Article</p>
                      <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">Create humanized, E-E-A-T optimized content based on your audit results, Discovery Engine source analysis, and competitor insights.</p>
                      <Button onClick={handleGenerateVisibilityContent} disabled={generatingVisibilityContent} size="lg" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-200 transition-all">
                        {generatingVisibilityContent ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating humanized content...</> : "Generate Article"}
                      </Button>
                      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Audit-based</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Tavily insights</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> E-E-A-T optimized</span>
                      </div>
                      {/* AI Disclaimer Notice */}
                      <div className="mt-6 mx-auto max-w-2xl bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                          </div>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            <span className="font-semibold">Important Notice:</span> This content is AI-generated and engineered for high-intent visibility across Large Language Models. While optimized for brand tone and relevance, all outputs must be reviewed, fact-checked, and verified by a human editor or professional writer prior to publishing to ensure absolute accuracy and compliance with brand standards.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Insights/Recommendations Tab — AI Visibility Strategist */}
              {detailTab === "insights" && (
                <div className="space-y-4">
                  {recommendations ? (
                    <div className="space-y-4">
                      {/* Header with priority + refresh */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-lg",
                            recommendations.priority === 'high' ? "bg-red-100" : recommendations.priority === 'medium' ? "bg-amber-100" : "bg-green-100"
                          )}>
                            <Target className={cn("h-4 w-4", recommendations.priority === 'high' ? "text-red-600" : recommendations.priority === 'medium' ? "text-amber-600" : "text-green-600")} />
                          </div>
                          <span className="font-semibold text-gray-900 text-sm">AI Visibility Strategist</span>
                          <Badge className={cn("text-xs", recommendations.priority === 'high' ? "bg-red-100 text-red-700 border-red-200" : recommendations.priority === 'medium' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-green-100 text-green-700 border-green-200")}>{recommendations.priority.toUpperCase()} PRIORITY</Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleGenerateRecommendations} disabled={generatingRecommendations} className="text-xs h-7">
                          {generatingRecommendations ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}Refresh
                        </Button>
                      </div>

                      {/* Citation Gap Summary */}
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-indigo-600" />
                          <h4 className="text-sm font-semibold text-indigo-900">Citation Gap Analysis</h4>
                        </div>
                        <p className="text-sm text-indigo-800 leading-relaxed">{recommendations.citationGapSummary}</p>
                      </div>

                      {/* Platform Presence Table */}
                      {recommendations.platformPresence && recommendations.platformPresence.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Platform Presence</h4>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {recommendations.platformPresence.map((p, idx) => (
                              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-sm font-medium text-gray-700">{p.platform}</span>
                                <div className="flex items-center gap-2">
                                  {p.present ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                        <CheckCircle className="h-3 w-3" />Present
                                      </span>
                                      {p.rank && <span className="text-xs text-gray-500">Position #{p.rank}</span>}
                                    </>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                                      <X className="h-3 w-3" />Absent
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* High Impact Recommendations */}
                      {recommendations.recommendations.filter(r => r.type === 'High Impact').length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 h-5 w-5 rounded bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                              <Sparkles className="h-3 w-3 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900">High Impact Strategic Actions</h4>
                          </div>
                          {recommendations.recommendations.filter(r => r.type === 'High Impact').map((rec, idx) => (
                            <div key={idx} className="bg-white border border-purple-100 rounded-xl overflow-hidden shadow-sm">
                              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-100">
                                <div className="flex items-start justify-between gap-2">
                                  <h5 className="text-sm font-semibold text-gray-900">{rec.title}</h5>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">High Impact</Badge>
                                    <Badge className={cn('text-xs', rec.priority === 'High' ? 'bg-red-100 text-red-700 border-red-200' : rec.priority === 'Medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200')}>{rec.priority}</Badge>
                                  </div>
                                </div>
                                {rec.targetPlatforms && (
                                  <p className="text-xs text-purple-600 mt-1">🎯 {rec.targetPlatforms}</p>
                                )}
                              </div>
                              <div className="p-4 space-y-3">
                                {rec.whyThisWorks && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why This Works</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{rec.whyThisWorks}</p>
                                  </div>
                                )}
                                {rec.exactAction && (
                                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Exact Action</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {rec.exactAction.contentFormat && <div><span className="text-gray-500">Format:</span> <span className="font-medium text-gray-700">{rec.exactAction.contentFormat}</span></div>}
                                      {rec.exactAction.wordCount && <div><span className="text-gray-500">Length:</span> <span className="font-medium text-gray-700">{rec.exactAction.wordCount}</span></div>}
                                      {rec.exactAction.targetUrl && <div className="col-span-2"><span className="text-gray-500">URL:</span> <span className="font-medium text-indigo-600 break-all">{rec.exactAction.targetUrl}</span></div>}
                                    </div>
                                    {rec.exactAction.keyClaims && rec.exactAction.keyClaims.length > 0 && (
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1">Key claims to include:</p>
                                        <ul className="space-y-0.5">
                                          {rec.exactAction.keyClaims.map((claim, ci) => (
                                            <li key={ci} className="text-xs text-gray-700 flex items-start gap-1"><span className="text-indigo-400 mt-0.5">•</span>{claim}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {rec.exactAction.existingPageNote && (
                                      <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded p-2">
                                        <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-amber-700">{rec.exactAction.existingPageNote}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {rec.executionSteps && rec.executionSteps.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Execution Steps</p>
                                    <ol className="space-y-1">
                                      {rec.executionSteps.map((step, si) => (
                                        <li key={si} className="text-xs text-gray-700 flex items-start gap-2">
                                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">{si + 1}</span>
                                          {step}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                <div className="flex items-center gap-4 pt-1 border-t border-gray-100">
                                  {rec.timeline && (
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <Clock className="h-3 w-3 text-gray-400" />
                                      <span className="font-medium">{rec.timeline}</span>
                                    </div>
                                  )}
                                  {rec.successMetric && (
                                    <div className="flex items-center gap-1 text-xs text-emerald-700">
                                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                                      <span>{rec.successMetric}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick Win Recommendations */}
                      {recommendations.recommendations.filter(r => r.type === 'Quick Win').length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 h-5 w-5 rounded bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                              <Zap className="h-3 w-3 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-900">Quick Tactical Wins</h4>
                          </div>
                          {recommendations.recommendations.filter(r => r.type === 'Quick Win').map((rec, idx) => (
                            <div key={idx} className="bg-white border border-teal-100 rounded-xl overflow-hidden shadow-sm">
                              <div className="bg-gradient-to-r from-teal-50 to-green-50 px-4 py-3 border-b border-teal-100">
                                <div className="flex items-start justify-between gap-2">
                                  <h5 className="text-sm font-semibold text-gray-900">{rec.title}</h5>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200">Quick Win</Badge>
                                    <Badge className={cn('text-xs', rec.priority === 'High' ? 'bg-red-100 text-red-700 border-red-200' : rec.priority === 'Medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200')}>{rec.priority}</Badge>
                                  </div>
                                </div>
                                {rec.targetPlatforms && (
                                  <p className="text-xs text-teal-600 mt-1">🎯 {rec.targetPlatforms}</p>
                                )}
                              </div>
                              <div className="p-4 space-y-3">
                                {rec.whyThisWorks && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why This Works</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{rec.whyThisWorks}</p>
                                  </div>
                                )}
                                {rec.exactAction && (
                                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Exact Action</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {rec.exactAction.contentFormat && <div><span className="text-gray-500">Format:</span> <span className="font-medium text-gray-700">{rec.exactAction.contentFormat}</span></div>}
                                      {rec.exactAction.wordCount && <div><span className="text-gray-500">Length:</span> <span className="font-medium text-gray-700">{rec.exactAction.wordCount}</span></div>}
                                      {rec.exactAction.targetUrl && <div className="col-span-2"><span className="text-gray-500">URL:</span> <span className="font-medium text-teal-600 break-all">{rec.exactAction.targetUrl}</span></div>}
                                    </div>
                                    {rec.exactAction.keyClaims && rec.exactAction.keyClaims.length > 0 && (
                                      <div>
                                        <p className="text-xs text-gray-500 mb-1">Key claims to include:</p>
                                        <ul className="space-y-0.5">
                                          {rec.exactAction.keyClaims.map((claim, ci) => (
                                            <li key={ci} className="text-xs text-gray-700 flex items-start gap-1"><span className="text-teal-400 mt-0.5">•</span>{claim}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {rec.exactAction.existingPageNote && (
                                      <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded p-2">
                                        <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-amber-700">{rec.exactAction.existingPageNote}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {rec.executionSteps && rec.executionSteps.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Execution Steps</p>
                                    <ol className="space-y-1">
                                      {rec.executionSteps.map((step, si) => (
                                        <li key={si} className="text-xs text-gray-700 flex items-start gap-2">
                                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xs">{si + 1}</span>
                                          {step}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                <div className="flex items-center gap-4 pt-1 border-t border-gray-100">
                                  {rec.timeline && (
                                    <div className="flex items-center gap-1 text-xs text-gray-600">
                                      <Clock className="h-3 w-3 text-gray-400" />
                                      <span className="font-medium">{rec.timeline}</span>
                                    </div>
                                  )}
                                  {rec.successMetric && (
                                    <div className="flex items-center gap-1 text-xs text-emerald-700">
                                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                                      <span>{rec.successMetric}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex-shrink-0 shadow-sm">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">AI Visibility Strategist</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Insights generated from per-platform AI response analysis, citation source data, and competitor gap analysis. Recommendations target specific citation patterns to improve your brand's presence in AI-generated responses.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="bg-gradient-to-br from-indigo-100 to-purple-100 h-20 w-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Target className="h-10 w-10 text-indigo-500" />
                      </div>
                      <p className="text-gray-800 font-semibold text-lg mb-2">AI Visibility Strategist</p>
                      <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">Analyze why competitors get cited in AI responses for this query, and get 6 precise, actionable recommendations to close the gap — split into High Impact strategies and Quick Wins.</p>
                      <Button onClick={handleGenerateRecommendations} disabled={generatingRecommendations} size="lg" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-200 transition-all">
                        {generatingRecommendations ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing Citation Gaps...</> : <><Zap className="h-4 w-4 mr-2" />Generate Visibility Strategy</>}
                      </Button>
                      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Citation gap analysis</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Per-platform insights</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> 6 structured actions</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl my-4">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-600 font-medium mb-4">No results yet. Run this prompt to see analysis.</p>
              <Button size="lg" onClick={() => { if (prompt) runSinglePrompt(prompt.id); setSelectedPromptDetail(null); }} className="bg-gray-900 hover:bg-gray-800"><Play className="h-4 w-4 mr-2" /> Run Now</Button>
            </div>
          )}
        </DialogContent>
      </Dialog >
    );
  }

  function ImportDialog() {
    return (<Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Import Prompts</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Paste JSON or text (one prompt per line)</Label><Textarea placeholder={'{"prompts": ["prompt 1", "prompt 2"]}\nor\nprompt 1\nprompt 2'} value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} className="mt-1 font-mono text-sm" /></div><div className="text-center text-sm text-gray-500">or</div><Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>Upload File (.json, .csv, .txt)</Button></div><DialogFooter><Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button><Button onClick={handleImport}>Import</Button></DialogFooter></DialogContent></Dialog>);
  }

  function EditLocationDialog() {
    const editingPrompt = prompts.find(p => p.id === editingLocationPromptId);
    return (
      <Dialog open={editLocationOpen} onOpenChange={setEditLocationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-500" /> Edit Prompt Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPrompt && (
              <div className="p-3 bg-gray-50 rounded-lg border text-sm text-gray-700">
                "{editingPrompt.prompt_text}"
              </div>
            )}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Select Location</Label>
              <Select value={editingLocationValue || "__default__"} onValueChange={setEditingLocationValue}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose location" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="__default__">📍 Use brand's default location</SelectItem>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50">Countries</div>
                  <SelectItem value="United States">🇺🇸 United States</SelectItem>
                  <SelectItem value="United Kingdom">🇬🇧 United Kingdom</SelectItem>
                  <SelectItem value="India">🇮🇳 India</SelectItem>
                  <SelectItem value="Thailand">🇹🇭 Thailand</SelectItem>
                  <SelectItem value="Australia">🇦🇺 Australia</SelectItem>
                  <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                  <SelectItem value="UAE">🇦🇪 UAE</SelectItem>
                  <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇺🇸 US Cities</div>
                  <SelectItem value="US: New York">New York, NY</SelectItem>
                  <SelectItem value="US: Los Angeles">Los Angeles, CA</SelectItem>
                  <SelectItem value="US: Chicago">Chicago, IL</SelectItem>
                  <SelectItem value="US: San Francisco">San Francisco, CA</SelectItem>
                  <SelectItem value="US: Miami">Miami, FL</SelectItem>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇬🇧 UK Cities</div>
                  <SelectItem value="UK: London">London</SelectItem>
                  <SelectItem value="UK: Manchester">Manchester</SelectItem>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇮🇳 India Cities</div>
                  <SelectItem value="India: Mumbai">Mumbai</SelectItem>
                  <SelectItem value="India: Delhi">Delhi</SelectItem>
                  <SelectItem value="India: Bangalore">Bangalore</SelectItem>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 mt-1">🇹🇭 Thailand Cities</div>
                  <SelectItem value="Thailand: Bangkok">Bangkok</SelectItem>
                  <SelectItem value="Thailand: Phuket">Phuket</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-2">AI responses will be personalized for this location when you run the audit.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLocationOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLocation} className="bg-blue-600 hover:bg-blue-700"><Globe className="h-4 w-4 mr-1" /> Save Location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  function BrandVisibilityModal() {
    const clientStats = detailedBrandStats.find(s => s.name === selectedClient?.brand_name);
    const sov = clientStats?.percentage || 0;
    const rank = clientStats?.avgRank;

    return (
      <Dialog open={showBrandVisibilityModal} onOpenChange={setShowBrandVisibilityModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-blue-600" />
              Brand Visibility Landscape
            </DialogTitle>
            <p className="text-sm text-gray-500">Detailed breakdown of brand mentions across all audits</p>
          </DialogHeader>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
              <div className="text-sm text-blue-600 font-medium mb-1">Your Share of Voice</div>
              <div className="text-3xl font-bold text-blue-700">{sov}%</div>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
              <div className="text-sm text-indigo-600 font-medium mb-1">Avg. Position</div>
              <div className="text-3xl font-bold text-indigo-700">{rank ? `#${rank}` : '-'}</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
              <div className="text-sm text-gray-600 font-medium mb-1">Audits with Presence</div>
              <div className="text-3xl font-bold text-gray-700">{clientStats?.auditPresence || 0} <span className="text-base font-normal text-gray-400">/ {filteredAuditResults.length}</span></div>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 -mx-2 px-2 border rounded-lg border-gray-100">
            <table className="w-full relative">
              <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Brand</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Mentions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-1/3 pl-8">Visibility Share</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Avg Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detailedBrandStats.map((brand, i) => {
                  const isClient = brand.name === selectedClient?.brand_name;
                  const brandDomain = isClient ? selectedClient?.brand_domain : `${brand.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                  return (
                    <tr key={i} className={cn("hover:bg-gray-50/80 transition-colors", isClient && "bg-blue-50/40 hover:bg-blue-50/60")}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-500">#{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={`https://www.google.com/s2/favicons?domain=${brandDomain}&sz=32`} className="w-6 h-6 rounded-md bg-white border border-gray-100 shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                          <div className="w-6 h-6 rounded-md bg-gray-100 hidden flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">{brand.name.substring(0, 2)}</div>
                          <span className={cn("font-medium", isClient ? "text-blue-700" : "text-gray-900")}>{brand.name}</span>
                          {isClient && <Badge className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-[10px] h-5">You</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 font-medium">{brand.mentions}</td>
                      <td className="px-4 py-3 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${brand.percentage}%`, backgroundColor: isClient ? '#3b82f6' : '#9ca3af' }} />
                          </div>
                          <span className="text-sm font-medium w-9 text-right">{brand.percentage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={cn("inline-flex items-center px-2 py-0.5 rounded text-sm font-medium", brand.avgRank && brand.avgRank <= 3 ? "bg-amber-50 text-amber-700 border border-amber-100" : "text-gray-600")}>
                          {brand.avgRank ? `#${brand.avgRank}` : '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}

