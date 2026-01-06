/**
 * FORZEO GEO DASHBOARD - Redesigned UI v6.0
 */
import { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, FileText, Globe, Play, Plus, Loader2, ChevronDown, X, CheckCircle, ExternalLink, Users, Download, Settings, Tag, Trash2, Search, AlertTriangle, Eye, RefreshCw, Calendar, Home, MessageSquare, Key, CreditCard, HelpCircle, Building2, Clock, Filter, ArrowUpDown, Link2, Sparkles, Copy, TrendingUp, TrendingDown, Minus, Upload, ChevronRight } from "lucide-react";
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
import { useClientDashboard, AI_MODELS } from "@/hooks/useClientDashboard";
import { MODEL_LOGOS } from "@/components/ModelLogos";

const DOMAIN_TYPES: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ugc: { label: "UGC", color: "text-cyan-700", bg: "bg-cyan-100", dot: "#06b6d4" },
  corporate: { label: "Corporate", color: "text-orange-700", bg: "bg-orange-100", dot: "#f97316" },
  editorial: { label: "Editorial", color: "text-purple-700", bg: "bg-purple-100", dot: "#a855f7" },
  reference: { label: "Reference", color: "text-green-700", bg: "bg-green-100", dot: "#22c55e" },
  competitor: { label: "Competitor", color: "text-red-700", bg: "bg-red-100", dot: "#ef4444" },
  institutional: { label: "Institutional", color: "text-emerald-700", bg: "bg-emerald-100", dot: "#10b981" },
  other: { label: "Other", color: "text-gray-700", bg: "bg-gray-100", dot: "#6b7280" },
};

function classifyDomain(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes("reddit") || d.includes("quora") || d.includes("youtube")) return "ugc";
  if (d.includes("forbes") || d.includes("techcrunch") || d.includes("wired")) return "editorial";
  if (d.includes("wikipedia")) return "reference";
  if (d.includes(".gov") || d.includes(".edu")) return "institutional";
  if (d.includes("apple") || d.includes("google") || d.includes("microsoft")) return "corporate";
  return "other";
}

function BrandLogo({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  const domain = useMemo(() => {
    const n = name.toLowerCase().replace(/\s+/g, "");
    const domainMap: Record<string, string> = { bumble: "bumble.com", hinge: "hinge.co", tinder: "tinder.com", shaadi: "shaadi.com", aisle: "aisle.co", myntra: "myntra.com", amazon: "amazon.com", google: "google.com" };
    return domainMap[n] || `${n}.com`;
  }, [name]);
  return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`} alt={name} className={cn("rounded", className)} style={{ width: size, height: size }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
}

function DonutChart({ value, size = 120, label = "Citations" }: { value: number; size?: number; label?: string }) {
  const strokeWidth = 12; const radius = (size - strokeWidth) / 2; const circumference = 2 * Math.PI * radius;
  return (<div className="relative" style={{ width: size, height: size }}><svg width={size} height={size} className="transform -rotate-90"><circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} /><circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#3b82f6" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={circumference * 0.25} strokeLinecap="round" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-gray-900">{value}</span><span className="text-xs text-gray-500">{label}</span></div></div>);
}

function TrendIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0) return <span className="flex items-center gap-0.5 text-green-600 text-xs"><TrendingUp className="h-3 w-3" />+{value}{suffix}</span>;
  if (value < 0) return <span className="flex items-center gap-0.5 text-red-600 text-xs"><TrendingDown className="h-3 w-3" />{value}{suffix}</span>;
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus className="h-3 w-3" />0{suffix}</span>;
}

export default function ClientDashboard() {
  const { clients, selectedClient, prompts, auditResults, selectedModels, loading, loadingPromptId, error, addClient, updateClient, deleteClient, switchClient, setSelectedModels, runFullAudit, runSinglePrompt, clearResults, addCustomPrompt, addMultiplePrompts, deletePrompt, clearAllPrompts, updateBrandTags, updateCompetitors, exportToCSV, exportFullReport, importData, generatePromptsFromKeywords, generateContent, INDUSTRY_PRESETS: industries, LOCATION_CODES: locations } = useClientDashboard();

  const [activeTab, setActiveTab] = useState<"overview" | "prompts" | "citations" | "sources" | "content">("overview");
  const [newPrompt, setNewPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [manageBrandsOpen, setManageBrandsOpen] = useState(false);
  const [selectedPromptDetail, setSelectedPromptDetail] = useState<string | null>(null);
  const [sourcesView, setSourcesView] = useState<"domains" | "urls">("domains");
  const [newTag, setNewTag] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [bulkPromptsOpen, setBulkPromptsOpen] = useState(false);
  const [bulkPrompts, setBulkPrompts] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contentTopic, setContentTopic] = useState("");
  const [contentType, setContentType] = useState("article");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatingContent, setGeneratingContent] = useState(false);
  const [showBrandOnly, setShowBrandOnly] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [promptsTabView, setPromptsTabView] = useState<"active" | "suggested" | "inactive">("active");
  const [sourcesGapView, setSourcesGapView] = useState<"all" | "gap">("all");
  const [newClientForm, setNewClientForm] = useState({ name: "", brand_name: "", target_region: "United States", industry: "Custom", competitors: "", primary_color: "#3b82f6", logo_url: "" });
  const [editClientForm, setEditClientForm] = useState({ name: "", brand_name: "", target_region: "United States", industry: "Custom", primary_color: "#3b82f6", logo_url: "", competitors: "" });

  const filteredAuditResults = useMemo(() => {
    let results = auditResults;
    if (dateRangeFilter !== "all") { const now = new Date(); const days = dateRangeFilter === "7d" ? 7 : dateRangeFilter === "30d" ? 30 : 90; const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000); results = results.filter(r => new Date(r.created_at) >= cutoff); }
    if (modelFilter.length > 0) { results = results.map(r => ({ ...r, model_results: r.model_results.filter(mr => modelFilter.includes(mr.model)) })).filter(r => r.model_results.length > 0); }
    return results;
  }, [auditResults, dateRangeFilter, modelFilter]);

  const allCitations = useMemo(() => {
    const citationMap = new Map<string, { url: string; title: string; domain: string; count: number; prompts: string[] }>();
    for (const result of filteredAuditResults) { for (const mr of result.model_results) { for (const c of mr.citations) { const key = c.url; if (citationMap.has(key)) { const existing = citationMap.get(key)!; existing.count++; if (!existing.prompts.includes(result.prompt_text)) existing.prompts.push(result.prompt_text); } else { citationMap.set(key, { ...c, count: 1, prompts: [result.prompt_text] }); } } } }
    return Array.from(citationMap.values()).sort((a, b) => b.count - a.count);
  }, [filteredAuditResults]);

  const modelStats = useMemo(() => {
    const stats: Record<string, { visible: number; total: number; cost: number }> = {};
    AI_MODELS.forEach(model => { stats[model.id] = { visible: 0, total: 0, cost: 0 }; });
    filteredAuditResults.forEach(result => { result.model_results.forEach(mr => { if (stats[mr.model]) { stats[mr.model].total++; if (mr.brand_mentioned) stats[mr.model].visible++; stats[mr.model].cost += mr.api_cost; } }); });
    return stats;
  }, [filteredAuditResults]);

  const competitorGap = useMemo(() => {
    if (!selectedClient) return [];
    const mentions: Record<string, number> = {}; mentions[selectedClient.brand_name] = 0; selectedClient.competitors.forEach(c => { mentions[c] = 0; });
    filteredAuditResults.forEach(result => { result.model_results.forEach(mr => { const response = mr.raw_response?.toLowerCase() || ""; if (mr.brand_mentioned) mentions[selectedClient.brand_name] += mr.brand_mention_count; selectedClient.competitors.forEach(comp => { const regex = new RegExp(comp.toLowerCase(), "gi"); const matches = response.match(regex); if (matches) mentions[comp] += matches.length; }); }); });
    const total = Object.values(mentions).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(mentions).map(([name, count]) => ({ name, mentions: count, percentage: Math.round((count / total) * 100) })).sort((a, b) => b.mentions - a.mentions);
  }, [selectedClient, filteredAuditResults]);

  const filteredPromptsByTab = useMemo(() => {
    const activePrompts = prompts.filter(p => p.is_active !== false);
    const inactivePrompts = prompts.filter(p => p.is_active === false);
    const runPromptIds = new Set(auditResults.map(r => r.prompt_id));
    const suggestedPrompts = activePrompts.filter(p => !runPromptIds.has(p.id));
    switch (promptsTabView) { case "active": return activePrompts; case "suggested": return suggestedPrompts; case "inactive": return inactivePrompts; default: return activePrompts; }
  }, [prompts, auditResults, promptsTabView]);

  const filteredPrompts = useMemo(() => !searchQuery ? filteredPromptsByTab : filteredPromptsByTab.filter(p => p.prompt_text.toLowerCase().includes(searchQuery.toLowerCase())), [filteredPromptsByTab, searchQuery]);
  const pendingPrompts = prompts.filter(p => p.is_active !== false && !auditResults.find(r => r.prompt_id === p.id)).length;
  const totalCost = Object.values(modelStats).reduce((sum, m) => sum + m.cost, 0);
  const getPromptResult = (promptId: string) => filteredAuditResults.find(r => r.prompt_id === promptId);

  const domainStats = useMemo(() => {
    const stats: Record<string, { count: number; type: string; avg: number; prompts: Set<string> }> = {};
    filteredAuditResults.forEach(result => { result.model_results.forEach(mr => { mr.citations.forEach(c => { if (!stats[c.domain]) stats[c.domain] = { count: 0, type: classifyDomain(c.domain), avg: 0, prompts: new Set() }; stats[c.domain].count++; stats[c.domain].prompts.add(result.prompt_text); }); }); });
    const total = filteredAuditResults.length || 1;
    Object.keys(stats).forEach(d => { stats[d].avg = Math.round((stats[d].count / total) * 10) / 10; });
    return Object.entries(stats).map(([domain, data]) => ({ domain, count: data.count, type: data.type, avg: data.avg, promptCount: data.prompts.size, prompts: Array.from(data.prompts) })).sort((a, b) => b.count - a.count);
  }, [filteredAuditResults]);

  const recentPrompts = useMemo(() => filteredAuditResults.slice(0, 9).map(r => { const p = prompts.find(x => x.id === r.prompt_id); return { ...r, prompt_text: p?.prompt_text || r.prompt_text }; }), [filteredAuditResults, prompts]);

  const handleAddPrompt = async () => { if (newPrompt.trim()) { await addCustomPrompt(newPrompt.trim()); setNewPrompt(""); } };
  const handleBulkAdd = () => { if (bulkPrompts.trim()) { addMultiplePrompts(bulkPrompts.split("\n").filter(l => l.trim().length > 3)); setBulkPrompts(""); setBulkPromptsOpen(false); } };
  const handleGeneratePrompts = async () => { if (!keywordsInput.trim()) return; setGeneratingPrompts(true); try { const g = await generatePromptsFromKeywords(keywordsInput); if (g?.length) { addMultiplePrompts(g); setKeywordsInput(""); } } finally { setGeneratingPrompts(false); } };
  const handleGenerateContent = async () => { if (!contentTopic.trim()) return; setGeneratingContent(true); setGeneratedContent(""); try { const c = await generateContent(contentTopic, contentType); if (c) setGeneratedContent(c); } finally { setGeneratingContent(false); } };
  const handleImport = () => { if (importText.trim()) { importData(importText); setImportText(""); setImportDialogOpen(false); } };
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => importData(ev.target?.result as string); r.readAsText(f); } };
  const handleCreateClient = async () => { if (!newClientForm.name.trim()) return; const comps = newClientForm.competitors.split(",").map(c => c.trim()).filter(Boolean); await addClient({ name: newClientForm.name, brand_name: newClientForm.brand_name || newClientForm.name, target_region: newClientForm.target_region, location_code: locations[newClientForm.target_region] || 2840, industry: newClientForm.industry, competitors: comps.length > 0 ? comps : industries[newClientForm.industry]?.competitors || [], primary_color: newClientForm.primary_color }); setNewClientForm({ name: "", brand_name: "", target_region: "United States", industry: "Custom", competitors: "", primary_color: "#3b82f6", logo_url: "" }); setAddClientOpen(false); };
  const handleUpdateClient = async () => { if (!selectedClient || !editClientForm.name.trim()) return; const comps = editClientForm.competitors.split(",").map(c => c.trim()).filter(Boolean); await updateClient(selectedClient.id, { name: editClientForm.name, brand_name: editClientForm.brand_name || editClientForm.name, target_region: editClientForm.target_region, location_code: locations[editClientForm.target_region] || selectedClient.location_code, industry: editClientForm.industry, primary_color: editClientForm.primary_color, competitors: comps }); setEditClientOpen(false); };
  const handleDeleteClient = async () => { if (!selectedClient || clients.length <= 1) return; if (confirm(`Delete "${selectedClient.name}"?`)) await deleteClient(selectedClient.id); };
  const handleAddTag = () => { if (newTag.trim() && selectedClient) { updateBrandTags([...selectedClient.brand_tags, newTag.trim()]); setNewTag(""); } };
  const handleAddCompetitor = () => { if (newCompetitor.trim() && selectedClient) { updateCompetitors([...selectedClient.competitors, newCompetitor.trim()]); setNewCompetitor(""); } };
  const toggleModel = (id: string) => { if (selectedModels.includes(id)) { if (selectedModels.length > 1) setSelectedModels(selectedModels.filter(m => m !== id)); } else { setSelectedModels([...selectedModels, id]); } };
  const toggleModelFilter = (id: string) => { if (modelFilter.includes(id)) { setModelFilter(modelFilter.filter(m => m !== id)); } else { setModelFilter([...modelFilter, id]); } };

  const handleExportFullAudit = () => {
    if (!selectedClient) return;
    const overallVisibility = Math.round(auditResults.reduce((sum, r) => sum + r.summary.share_of_voice, 0) / (auditResults.length || 1));
    let txt = "FORZEO GEO AUDIT REPORT\n" + "=".repeat(60) + "\n\n";
    txt += "Export Date: " + new Date().toLocaleString() + "\n\n";
    txt += "CLIENT INFORMATION\n" + "-".repeat(40) + "\n";
    txt += "Name: " + selectedClient.name + "\nBrand: " + selectedClient.brand_name + "\nIndustry: " + (selectedClient.industry || "N/A") + "\nRegion: " + (selectedClient.target_region || "N/A") + "\n";
    txt += "Brand Tags: " + (selectedClient.brand_tags?.join(", ") || "None") + "\nCompetitors: " + (selectedClient.competitors?.join(", ") || "None") + "\n\n";
    txt += "SUMMARY\n" + "-".repeat(40) + "\n";
    txt += "Total Prompts: " + prompts.length + "\nTotal Audits: " + auditResults.length + "\nOverall Visibility: " + overallVisibility + "%\nTotal Citations: " + allCitations.length + "\nTotal Cost: $" + totalCost.toFixed(4) + "\n\n";
    txt += "MODEL PERFORMANCE\n" + "-".repeat(40) + "\n";
    AI_MODELS.forEach(m => { const s = modelStats[m.id]; const pct = s?.total ? Math.round((s.visible / s.total) * 100) : 0; txt += m.name + " (" + m.provider + "): " + (s?.visible || 0) + "/" + (s?.total || 0) + " visible (" + pct + "%) - $" + (s?.cost || 0).toFixed(4) + "\n"; });
    txt += "\nCOMPETITOR ANALYSIS\n" + "-".repeat(40) + "\n";
    competitorGap.forEach((c, i) => { txt += (i + 1) + ". " + c.name + ": " + c.mentions + " mentions (" + c.percentage + "%)\n"; });
    txt += "\nPROMPTS (" + prompts.length + ")\n" + "-".repeat(40) + "\n";
    prompts.forEach((p, i) => { txt += (i + 1) + ". [" + (p.is_active ? "Active" : "Inactive") + "] " + p.prompt_text + "\n   Category: " + (p.category || "custom") + " | Niche: " + (p.niche_level || "N/A") + "\n"; });
    txt += "\nAUDIT RESULTS (" + auditResults.length + ")\n" + "=".repeat(60) + "\n";
    auditResults.forEach((r, i) => { txt += "\n[" + (i + 1) + "] " + r.prompt_text + "\n" + "-".repeat(50) + "\nDate: " + new Date(r.created_at).toLocaleString() + "\nSOV: " + r.summary.share_of_voice + "% | Rank: " + (r.summary.average_rank || "N/A") + " | Citations: " + r.summary.total_citations + "\n\nModel Results:\n"; r.model_results.forEach(mr => { txt += "  - " + mr.model_name + ": " + (mr.brand_mentioned ? "Mentioned" : "Not mentioned") + (mr.brand_rank ? " (Rank #" + mr.brand_rank + ")" : "") + " - " + mr.brand_mention_count + " mentions, " + (mr.citations?.length || 0) + " citations\n"; }); txt += "\n"; });
    txt += "\nTOP CITATIONS (" + Math.min(allCitations.length, 50) + ")\n" + "-".repeat(40) + "\n";
    allCitations.slice(0, 50).forEach((c, i) => { txt += (i + 1) + ". " + c.domain + " (" + c.count + "x)\n   " + c.url + "\n"; });
    txt += "\nTOP SOURCES (" + Math.min(domainStats.length, 30) + ")\n" + "-".repeat(40) + "\n";
    domainStats.slice(0, 30).forEach((s, i) => { txt += (i + 1) + ". " + s.domain + ": " + s.count + " citations across " + s.promptCount + " prompts\n"; });
    txt += "\n" + "=".repeat(60) + "\nGenerated by Forzeo GEO Dashboard\nhttps://wondrous-queijadas-f95c7e.netlify.app\n";
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = (selectedClient.slug || selectedClient.name.toLowerCase().replace(/\s+/g, "-")) + "-full-audit-" + new Date().toISOString().split("T")[0] + ".txt"; a.click(); URL.revokeObjectURL(url);
  };

  const dateRangeLabel = dateRangeFilter === "7d" ? "Last 7 days" : dateRangeFilter === "30d" ? "Last 30 days" : dateRangeFilter === "90d" ? "Last 90 days" : "All Time";
  const modelFilterLabel = modelFilter.length === 0 ? "All Models" : modelFilter.length === 1 ? AI_MODELS.find(m => m.id === modelFilter[0])?.name : `${modelFilter.length} Models`;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
        <div className="p-4 border-b border-gray-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-lg p-2 -m-2"><div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedClient?.primary_color || "#3b82f6" }}><span className="text-white font-bold text-sm">{selectedClient?.brand_name?.charAt(0) || "?"}</span></div><span className="font-semibold text-gray-900 flex-1 truncate">{selectedClient?.brand_name || "Select"}</span><ChevronDown className="h-4 w-4 text-gray-400" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">{clients.map(c => (<DropdownMenuItem key={c.id} onClick={() => switchClient(c)} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-5 w-5 rounded flex items-center justify-center" style={{ backgroundColor: c.primary_color }}><span className="text-white text-xs font-bold">{c.brand_name.charAt(0)}</span></div><span>{c.brand_name}</span></div>{c.id === selectedClient?.id && <CheckCircle className="h-4 w-4 text-green-500" />}</DropdownMenuItem>))}<DropdownMenuSeparator /><DropdownMenuItem onClick={() => setAddClientOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Brand</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-2">General</div>
          {[{ id: "overview", label: "Overview", icon: Home }, { id: "prompts", label: "Prompts", icon: MessageSquare, badge: pendingPrompts > 0 ? pendingPrompts : null }, { id: "citations", label: "Citations", icon: Link2, badge: allCitations.length > 0 ? allCitations.length : null }, { id: "sources", label: "Sources", icon: Globe }, { id: "content", label: "Content", icon: Sparkles }].map(item => (<button key={item.id} onClick={() => setActiveTab(item.id as typeof activeTab)} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors", activeTab === item.id ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50")}><item.icon className="h-4 w-4" />{item.label}{item.badge && <span className="ml-auto text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">{item.badge > 99 ? "99+" : item.badge}</span>}</button>))}
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-2 mt-6">Project</div>
          <button onClick={() => setSettingsOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 mb-1"><Settings className="h-4 w-4" /> Settings</button>
          <button onClick={() => setManageBrandsOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 mb-1"><Building2 className="h-4 w-4" /> Brands</button>
          <button onClick={() => setSettingsOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"><Tag className="h-4 w-4" /> Tags</button>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-2 mt-6">Company</div>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 mb-1"><Key className="h-4 w-4" /> API Keys</button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"><CreditCard className="h-4 w-4" /> Billing</button>
        </nav>
        <div className="p-3 border-t border-gray-100"><div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 mb-3"><div className="text-xs font-medium text-gray-500 mb-1">API Cost</div><div className="text-lg font-bold text-gray-900">${totalCost.toFixed(4)}</div><div className="text-xs text-gray-400 mt-1">{auditResults.length} audits run</div></div><button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"><HelpCircle className="h-4 w-4" /> Help</button></div>
      </aside>

      <main className="flex-1 ml-56 min-h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><FileText className="h-5 w-5 text-gray-400" />{activeTab === "overview" ? "Overview" : activeTab === "prompts" ? "Prompts" : activeTab === "citations" ? "Citations" : activeTab === "content" ? "Content Generator" : "Sources"}</h1>{(dateRangeFilter !== "all" || modelFilter.length > 0) && <Badge variant="secondary" className="text-xs">Filtered</Badge>}</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-white shadow-sm text-gray-900"><div className="h-4 w-4 rounded flex items-center justify-center" style={{ backgroundColor: selectedClient?.primary_color || "#3b82f6" }}><span className="text-white text-[10px] font-bold">{selectedClient?.brand_name?.charAt(0)}</span></div>{selectedClient?.brand_name}</button>
                <DropdownMenu><DropdownMenuTrigger asChild><button className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", dateRangeFilter !== "all" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-white/50")}><Calendar className="h-3.5 w-3.5" /> {dateRangeLabel}</button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setDateRangeFilter("7d")} className={cn(dateRangeFilter === "7d" && "bg-blue-50")}>Last 7 days</DropdownMenuItem><DropdownMenuItem onClick={() => setDateRangeFilter("30d")} className={cn(dateRangeFilter === "30d" && "bg-blue-50")}>Last 30 days</DropdownMenuItem><DropdownMenuItem onClick={() => setDateRangeFilter("90d")} className={cn(dateRangeFilter === "90d" && "bg-blue-50")}>Last 90 days</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setDateRangeFilter("all")} className={cn(dateRangeFilter === "all" && "bg-blue-50")}>All Time</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                <DropdownMenu><DropdownMenuTrigger asChild><button className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors", modelFilter.length > 0 ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-white/50")}><Filter className="h-3.5 w-3.5" /> {modelFilterLabel}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">{AI_MODELS.map(model => { const Logo = MODEL_LOGOS[model.id]?.Logo; const color = MODEL_LOGOS[model.id]?.color || "#666"; const isSelected = modelFilter.length === 0 || modelFilter.includes(model.id); return (<DropdownMenuItem key={model.id} onClick={() => toggleModelFilter(model.id)} className={cn(isSelected && "bg-blue-50")}><div className="flex items-center gap-2 w-full">{Logo && <Logo className="h-4 w-4" style={{ color }} />}<span className="flex-1">{model.name}</span>{isSelected && <CheckCircle className="h-3 w-3 text-blue-600" />}</div></DropdownMenuItem>); })}<DropdownMenuSeparator /><DropdownMenuItem onClick={() => setModelFilter([])}>Clear Filters</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              </div>
              {activeTab === "prompts" && <Button onClick={() => setBulkPromptsOpen(true)} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Add Prompt</Button>}
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={exportToCSV}><FileText className="h-4 w-4 mr-2" /> Export CSV</DropdownMenuItem><DropdownMenuItem onClick={exportFullReport}><FileText className="h-4 w-4 mr-2" /> Export Report (TXT)</DropdownMenuItem><DropdownMenuItem onClick={handleExportFullAudit}><FileText className="h-4 w-4 mr-2" /> Export Full Audit (TXT)</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setImportDialogOpen(true)}><Upload className="h-4 w-4 mr-2" /> Import Data</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              <Button onClick={runFullAudit} disabled={loading || pendingPrompts === 0} className="bg-gray-900 hover:bg-gray-800 text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}{loading ? "Running..." : `Run ${pendingPrompts} Prompts`}</Button>
            </div>
          </div>
        </header>
        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" /> {error}</div>}
        <div className="p-6">{activeTab === "overview" && <OverviewTab />}{activeTab === "prompts" && <PromptsTab />}{activeTab === "citations" && <CitationsTab />}{activeTab === "sources" && <SourcesTab />}{activeTab === "content" && <ContentTab />}</div>
      </main>
      <SettingsSheet /><AddClientDialog /><EditClientDialog /><ManageBrandsDialog /><BulkPromptsDialog /><PromptDetailDialog /><ImportDialog />
      <input ref={fileInputRef} type="file" accept=".json,.csv,.txt" className="hidden" onChange={handleFileImport} />
    </div>
  );

  function OverviewTab() {
    const overallVisibility = filteredAuditResults.length > 0 ? Math.round(filteredAuditResults.reduce((sum, r) => sum + r.summary.share_of_voice, 0) / filteredAuditResults.length) : 0;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><div className="text-sm text-gray-500">Overall Visibility</div><Eye className="h-4 w-4 text-gray-400" /></div><div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-bold text-gray-900">{overallVisibility}%</span><TrendIndicator value={0} /></div></div>
          <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><div className="text-sm text-gray-500">Total Prompts</div><MessageSquare className="h-4 w-4 text-gray-400" /></div><div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-bold text-gray-900">{prompts.length}</span><span className="text-sm text-gray-400">unlimited</span></div></div>
          <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><div className="text-sm text-gray-500">Citations Found</div><Link2 className="h-4 w-4 text-gray-400" /></div><div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-bold text-gray-900">{allCitations.length}</span><span className="text-sm text-gray-400">{domainStats.length} domains</span></div></div>
          <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><div className="text-sm text-gray-500">API Cost</div><CreditCard className="h-4 w-4 text-gray-400" /></div><div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-bold text-gray-900">${totalCost.toFixed(2)}</span><span className="text-sm text-gray-400">{filteredAuditResults.length} audits</span></div></div>
        </div>
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Eye className="h-4 w-4 text-gray-400" /> Visibility by Model</h3><p className="text-xs text-gray-500 mt-0.5">Percentage of responses mentioning your brand</p></div></div>
            <div className="space-y-4 mt-6">{AI_MODELS.filter(m => selectedModels.includes(m.id)).map(model => { const stats = modelStats[model.id] || { visible: 0, total: 0, cost: 0 }; const pct = stats.total > 0 ? Math.round((stats.visible / stats.total) * 100) : 0; const Logo = MODEL_LOGOS[model.id]?.Logo; const color = MODEL_LOGOS[model.id]?.color || "#666"; return (<div key={model.id} className="flex items-center gap-3"><div className="w-32 flex items-center gap-2">{Logo && <Logo className="h-4 w-4" style={{ color }} />}<span className="text-sm text-gray-700 truncate">{model.name}</span></div><div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden relative"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} /><span className="absolute inset-0 flex items-center justify-center text-xs font-medium" style={{ color: pct > 50 ? "white" : "#374151" }}>{pct}%</span></div><span className="text-sm font-medium text-gray-600 w-16 text-right">{stats.visible}/{stats.total}</span></div>); })}</div>
            {filteredAuditResults.length === 0 && <div className="text-center py-8 text-gray-500"><BarChart3 className="h-10 w-10 mx-auto mb-2 text-gray-300" /><p className="text-sm">Run audits to see visibility data</p></div>}
          </div>
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4 text-gray-400" /> Brand Visibility</h3></div>
            <div className="space-y-3">{competitorGap.slice(0, 8).map((c, i) => { const isBrand = c.name === selectedClient?.brand_name; return (<div key={i} className={cn("flex items-center gap-3 p-2 rounded-lg", isBrand && "bg-blue-50")}><span className="text-sm text-gray-400 w-5">{i + 1}</span><BrandLogo name={c.name} size={20} /><span className={cn("flex-1 text-sm truncate", isBrand ? "font-semibold text-blue-700" : "text-gray-700")}>{c.name}</span><div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${c.percentage}%`, backgroundColor: isBrand ? "#3b82f6" : "#9ca3af" }} /></div><span className={cn("text-sm font-medium w-12 text-right", isBrand ? "text-blue-600" : "text-gray-600")}>{c.percentage}%</span></div>); })}{competitorGap.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Run audits to see brand data</p>}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Globe className="h-4 w-4 text-gray-400" /> Top Sources</h3><p className="text-xs text-gray-500 mt-0.5">Most cited domains across all models</p></div><button onClick={() => setActiveTab("sources")} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">View All <ChevronRight className="h-3.5 w-3.5" /></button></div>
          <div className="grid grid-cols-3 gap-6"><div className="flex flex-col items-center justify-center"><DonutChart value={allCitations.length} size={140} /><div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-xs">{Object.entries(DOMAIN_TYPES).slice(0, 6).map(([k, t]) => (<div key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.dot }} /><span className="text-gray-600">{t.label}</span></div>))}</div></div><div className="col-span-2"><table className="w-full"><thead><tr className="text-xs text-gray-500 border-b border-gray-100"><th className="text-left pb-2 font-medium">Domain</th><th className="text-right pb-2 font-medium">Citations</th><th className="text-right pb-2 font-medium">Prompts</th><th className="text-right pb-2 font-medium">Type</th></tr></thead><tbody className="text-sm">{domainStats.slice(0, 6).map((s, i) => { const t = DOMAIN_TYPES[s.type] || DOMAIN_TYPES.other; return (<tr key={i} className="border-b border-gray-50"><td className="py-2.5"><div className="flex items-center gap-2"><img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`} alt="" className="h-4 w-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /><span className="text-gray-900">{s.domain}</span></div></td><td className="py-2.5 text-right text-gray-600">{s.count}</td><td className="py-2.5 text-right text-gray-600">{s.promptCount}</td><td className="py-2.5 text-right"><span className={cn("px-2 py-0.5 rounded text-xs font-medium", t.bg, t.color)}>{t.label}</span></td></tr>); })}{domainStats.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-500">Run audits to see source data</td></tr>}</tbody></table></div></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-gray-400" /> Recent Audits</h3><div className="flex items-center gap-2"><span className="text-sm text-gray-500">{selectedClient?.brand_name} mentioned</span><button onClick={() => setShowBrandOnly(!showBrandOnly)} className={cn("relative w-10 h-5 rounded-full transition-colors", showBrandOnly ? "bg-blue-500" : "bg-gray-200")}><span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", showBrandOnly ? "translate-x-5" : "translate-x-0.5")} /></button></div></div>
          <div className="grid grid-cols-3 gap-4">{recentPrompts.filter(r => !showBrandOnly || r.summary.share_of_voice > 0).slice(0, 9).map((r, i) => (<div key={i} onClick={() => setSelectedPromptDetail(r.prompt_id)} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"><h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">{r.prompt_text}</h4><p className="text-xs text-gray-500 line-clamp-2 mb-3">{r.model_results[0]?.raw_response?.substring(0, 100) || "No response"}...</p><div className="flex items-center justify-between"><div className="flex items-center gap-1">{r.model_results.slice(0, 4).map((mr, j) => { const Logo = MODEL_LOGOS[mr.model]?.Logo; const color = MODEL_LOGOS[mr.model]?.color || "#666"; return Logo ? (<div key={j} className={cn("p-1 rounded", mr.brand_mentioned ? "bg-green-50" : "bg-gray-50")}><Logo className="h-3.5 w-3.5" style={{ color: mr.brand_mentioned ? color : "#9ca3af" }} /></div>) : null; })}</div><span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.created_at).toLocaleDateString()}</span></div></div>))}</div>
          {recentPrompts.length === 0 && (<div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No recent audits. Run some prompts to see results here.</p></div>)}
        </div>
      </div>
    );
  }

  function PromptsTab() {
    const activeCount = prompts.filter(p => p.is_active !== false).length;
    const runPromptIds = new Set(auditResults.map(r => r.prompt_id));
    const suggestedCount = prompts.filter(p => p.is_active !== false && !runPromptIds.has(p.id)).length;
    const inactiveCount = prompts.filter(p => p.is_active === false).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="flex items-center bg-gray-100 rounded-lg p-1"><button onClick={() => setPromptsTabView("active")} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", promptsTabView === "active" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>Active <span className="ml-1 text-xs text-gray-400">({activeCount})</span></button><button onClick={() => setPromptsTabView("suggested")} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", promptsTabView === "suggested" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>Pending <span className="ml-1 text-xs text-orange-500">({suggestedCount})</span></button><button onClick={() => setPromptsTabView("inactive")} className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", promptsTabView === "inactive" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>Inactive <span className="ml-1 text-xs text-gray-400">({inactiveCount})</span></button></div></div>
          <div className="flex items-center gap-3"><span className="text-sm text-gray-500">{prompts.length} total prompts</span><Button onClick={() => setBulkPromptsOpen(true)} className="bg-gray-900 hover:bg-gray-800"><Plus className="h-4 w-4 mr-1" /> Add Prompt</Button></div>
        </div>
        <div className="flex items-center gap-3"><div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search prompts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-white border-gray-200" /></div><Button variant="outline" onClick={exportToCSV}><Download className="h-4 w-4 mr-1" /> Export</Button></div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="w-10 px-4 py-3"><Checkbox /></th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"><button className="flex items-center gap-1 hover:text-gray-700">Prompt <ArrowUpDown className="h-3 w-3" /></button></th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Visibility</th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Position</th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Models</th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Citations</th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filteredPrompts.map((p) => { const r = getPromptResult(p.id); const isLoading = loadingPromptId === p.id; const vis = r?.summary.share_of_voice || 0; const pos = r?.summary.average_rank; const cit = r?.summary.total_citations || 0; return (<tr key={p.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Checkbox /></td><td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-gray-900 text-sm">{p.prompt_text}</span>{p.niche_level && <Badge variant="outline" className="text-xs">{p.niche_level === "super_niche" ? "Super Niche" : p.niche_level === "niche" ? "Niche" : "Broad"}</Badge>}</div></td><td className="px-4 py-3 text-center"><span className={cn("text-sm font-medium", vis > 0 ? "text-green-600" : "text-gray-400")}>{r ? `${vis}%` : "--"}</span></td><td className="px-4 py-3 text-center text-gray-500">{pos ? `#${pos}` : "--"}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1">{r?.model_results.slice(0, 4).map((mr, i) => { const Logo = MODEL_LOGOS[mr.model]?.Logo; const color = MODEL_LOGOS[mr.model]?.color || "#666"; return Logo ? <Logo key={i} className="h-4 w-4" style={{ color: mr.brand_mentioned ? color : "#d1d5db" }} /> : null; })}{!r && <span className="text-xs text-gray-400">Not run</span>}</div></td><td className="px-4 py-3 text-center">{cit > 0 ? <Badge variant="secondary">{cit}</Badge> : <span className="text-gray-400">--</span>}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><Button variant="ghost" size="sm" onClick={() => setSelectedPromptDetail(p.id)} className="h-7 px-2 text-gray-500 hover:text-gray-700"><Eye className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" onClick={() => runSinglePrompt(p.id)} disabled={isLoading} className="h-7 px-2 text-gray-500 hover:text-blue-600">{isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</Button><Button variant="ghost" size="sm" onClick={() => deletePrompt(p.id)} className="h-7 px-2 text-gray-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button></div></td></tr>); })}</tbody>
          </table>
          {filteredPrompts.length === 0 && (<div className="p-12 text-center"><MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">{promptsTabView === "suggested" ? "All prompts have been run!" : promptsTabView === "inactive" ? "No inactive prompts" : "No prompts yet. Add your first prompt to get started."}</p></div>)}
        </div>
      </div>
    );
  }

  function SourcesTab() {
    const [sourceSearch, setSourceSearch] = useState("");
    const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
    const filteredDomainStats = useMemo(() => !sourceSearch ? domainStats : domainStats.filter(s => s.domain.toLowerCase().includes(sourceSearch.toLowerCase())), [domainStats, sourceSearch]);
    const gapDomains = useMemo(() => { if (!selectedClient) return []; const brandDomains = new Set<string>(); const competitorDomains = new Map<string, Set<string>>(); filteredAuditResults.forEach(result => { result.model_results.forEach(mr => { const response = mr.raw_response?.toLowerCase() || ""; const hasBrand = mr.brand_mentioned; mr.citations.forEach(c => { if (hasBrand) brandDomains.add(c.domain); selectedClient.competitors.forEach(comp => { if (response.includes(comp.toLowerCase())) { if (!competitorDomains.has(c.domain)) competitorDomains.set(c.domain, new Set()); competitorDomains.get(c.domain)!.add(comp); } }); }); }); }); return Array.from(competitorDomains.entries()).filter(([domain]) => !brandDomains.has(domain)).map(([domain, competitors]) => ({ domain, competitors: Array.from(competitors) })).slice(0, 20); }, [selectedClient, filteredAuditResults]);
    const displayedStats = sourcesGapView === "gap" ? gapDomains.map(g => { const stat = domainStats.find(s => s.domain === g.domain); return stat ? { ...stat, gapCompetitors: g.competitors } : null; }).filter(Boolean) : filteredDomainStats;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2"><button onClick={() => setSourcesView("domains")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", sourcesView === "domains" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>Domains</button><button onClick={() => setSourcesView("urls")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", sourcesView === "urls" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>URLs</button></div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">Source Usage by Domain</h3><div className="flex items-center gap-4 text-xs">{domainStats.slice(0, 5).map((s, i) => (<div key={i} className="flex items-center gap-1.5"><img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`} alt="" className="h-3.5 w-3.5 rounded" /><span className="text-gray-600">{s.domain}</span></div>))}</div></div>
          <div className="h-48 flex items-end gap-2 border-b border-gray-100 pb-4">{domainStats.slice(0, 15).map((s, i) => { const max = Math.max(...domainStats.slice(0, 15).map(x => x.count), 1); const h = (s.count / max) * 100; const t = DOMAIN_TYPES[s.type] || DOMAIN_TYPES.other; return (<div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer" onClick={() => setExpandedDomain(expandedDomain === s.domain ? null : s.domain)}><div className="w-full rounded-t hover:opacity-80 transition-opacity relative" style={{ height: `${Math.max(h, 4)}%`, backgroundColor: t.dot, minHeight: 4 }}><div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{s.domain}: {s.count}</div></div><span className="text-xs text-gray-500">{s.count}</span></div>); })}</div>
          <div className="flex items-center justify-end gap-4 mt-4 text-xs">{Object.entries(DOMAIN_TYPES).slice(0, 6).map(([k, t]) => (<div key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.dot }} /><span className="text-gray-600">{t.label}</span></div>))}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100"><div className="flex items-center gap-3"><button onClick={() => setSourcesGapView("all")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", sourcesGapView === "all" ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-50")}><Globe className="h-3.5 w-3.5" /> All Domains</button><button onClick={() => setSourcesGapView("gap")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", sourcesGapView === "gap" ? "bg-orange-100 text-orange-700" : "text-gray-500 hover:bg-gray-50")}><AlertTriangle className="h-3.5 w-3.5" /> Gap Analysis{gapDomains.length > 0 && <Badge variant="secondary" className="ml-1">{gapDomains.length}</Badge>}</button></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search domains..." value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} className="pl-9 w-48 h-9" /></div><Button variant="outline" size="sm" onClick={exportToCSV}><Download className="h-3.5 w-3.5 mr-1" /> Export</Button></div></div>
          {sourcesGapView === "gap" && (<div className="px-4 py-3 bg-orange-50 border-b border-orange-100"><p className="text-sm text-orange-700"><AlertTriangle className="h-4 w-4 inline mr-1" />These domains cite your competitors but not your brand.</p></div>)}
          <table className="w-full"><thead className="bg-gray-50 border-b border-gray-100"><tr><th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase w-12">#</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase"><button className="flex items-center gap-1"><Globe className="h-3 w-3" /> Source <ArrowUpDown className="h-3 w-3" /></button></th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th><th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Citations</th><th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prompts</th>{sourcesGapView === "gap" && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Competitors</th>}<th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Avg/Audit</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{(displayedStats as typeof domainStats).map((s, i) => { const t = DOMAIN_TYPES[s.type] || DOMAIN_TYPES.other; const isExpanded = expandedDomain === s.domain; return (<><tr key={i} className={cn("hover:bg-gray-50 cursor-pointer", isExpanded && "bg-blue-50")} onClick={() => setExpandedDomain(isExpanded ? null : s.domain)}><td className="px-5 py-3 text-sm text-gray-400">{i + 1}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=20`} alt="" className="h-5 w-5 rounded" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><circle cx="12" cy="12" r="10"/></svg>'; }} /><a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-900 hover:text-blue-600">{s.domain}</a><ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", isExpanded && "rotate-90")} /></div></td><td className="px-4 py-3"><span className={cn("px-2.5 py-1 rounded text-xs font-medium", t.bg, t.color)}>{t.label}</span></td><td className="px-4 py-3 text-right text-sm text-gray-600">{s.count}</td><td className="px-4 py-3 text-right text-sm text-gray-600">{s.promptCount}</td>{sourcesGapView === "gap" && (<td className="px-4 py-3"><div className="flex items-center gap-1 flex-wrap">{((s as any).gapCompetitors || []).slice(0, 3).map((comp: string, j: number) => (<span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium"><BrandLogo name={comp} size={12} />{comp}</span>))}{((s as any).gapCompetitors || []).length > 3 && <span className="text-xs text-gray-500">+{((s as any).gapCompetitors || []).length - 3}</span>}</div></td>)}<td className="px-5 py-3 text-right text-sm text-gray-600">{s.avg}</td></tr>{isExpanded && s.prompts && (<tr><td colSpan={sourcesGapView === "gap" ? 7 : 6} className="px-5 py-3 bg-gray-50"><div className="text-xs text-gray-500 mb-2">Prompts citing this source:</div><div className="flex flex-wrap gap-2">{s.prompts.slice(0, 10).map((prompt, j) => (<Badge key={j} variant="secondary" className="text-xs max-w-xs truncate">{prompt}</Badge>))}{s.prompts.length > 10 && <Badge variant="outline" className="text-xs">+{s.prompts.length - 10} more</Badge>}</div></td></tr>)}</>); })}</tbody>
          </table>
          {displayedStats.length === 0 && (<div className="p-12 text-center"><Globe className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">{sourcesGapView === "gap" ? "No gap opportunities found" : "No source data yet. Run audits to collect data."}</p></div>)}
        </div>
      </div>
    );
  }

  function CitationsTab() {
    const [citationSearch, setCitationSearch] = useState("");
    const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
    const filteredCitations = useMemo(() => !citationSearch ? allCitations : allCitations.filter(c => c.url.toLowerCase().includes(citationSearch.toLowerCase()) || c.domain.toLowerCase().includes(citationSearch.toLowerCase()) || c.title?.toLowerCase().includes(citationSearch.toLowerCase())), [allCitations, citationSearch]);
    const citationsByPrompt = useMemo(() => { const map: Record<string, typeof allCitations> = {}; filteredAuditResults.forEach(r => { const promptCitations: typeof allCitations = []; r.model_results.forEach(mr => { mr.citations.forEach(c => { promptCitations.push({ ...c, count: 1, prompts: [r.prompt_text] }); }); }); if (promptCitations.length > 0) map[r.prompt_id] = promptCitations; }); return map; }, [filteredAuditResults]);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><div className="flex items-center gap-4"><h2 className="text-lg font-semibold text-gray-900">All Citations</h2><Badge variant="outline">{allCitations.length} total</Badge></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search citations..." value={citationSearch} onChange={(e) => setCitationSearch(e.target.value)} className="pl-9 w-64" /></div><Button variant="outline" size="sm" onClick={exportToCSV}><Download className="h-4 w-4 mr-1" /> Export</Button></div></div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">URL</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-32">Domain</th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase w-20">Count</th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase w-24">Type</th><th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase w-20">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{filteredCitations.slice(0, 50).map((c, i) => { const t = DOMAIN_TYPES[classifyDomain(c.domain)] || DOMAIN_TYPES.other; return (<tr key={i} className={cn("hover:bg-gray-50 cursor-pointer", selectedCitation === c.url && "bg-blue-50")} onClick={() => setSelectedCitation(c.url)}><td className="px-4 py-3"><div className="flex items-center gap-2"><img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`} alt="" className="h-4 w-4 rounded" /><div className="min-w-0"><div className="text-sm text-gray-900 truncate max-w-md">{c.title || c.url}</div><div className="text-xs text-gray-500 truncate max-w-md">{c.url}</div></div></div></td><td className="px-4 py-3 text-sm text-gray-600">{c.domain}</td><td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 bg-blue-100 text-blue-800 text-sm font-bold rounded-full">{c.count}</span></td><td className="px-4 py-3 text-center"><span className={cn("px-2 py-0.5 rounded text-xs font-medium", t.bg, t.color)}>{t.label}</span></td><td className="px-4 py-3 text-center"><a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4" /></a></td></tr>); })}</tbody>
            </table>
            {filteredCitations.length === 0 && (<div className="p-12 text-center"><Link2 className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No citations yet. Run audits to collect citation data.</p></div>)}
            {filteredCitations.length > 50 && <div className="p-3 text-center text-sm text-gray-500 border-t">Showing 50 of {filteredCitations.length} citations</div>}
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-4">Citations by Prompt</h3><div className="space-y-3 max-h-96 overflow-y-auto">{Object.entries(citationsByPrompt).map(([promptId, citations]) => { const prompt = prompts.find(p => p.id === promptId); const result = filteredAuditResults.find(r => r.prompt_id === promptId); return (<div key={promptId} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer border border-gray-200" onClick={() => setSelectedPromptDetail(promptId)}><div className="text-sm font-medium text-gray-900 line-clamp-2">{prompt?.prompt_text || result?.prompt_text}</div><div className="flex items-center gap-3 mt-2"><div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(citations.length * 10, 100)}%` }} /></div><span className="text-xs font-medium text-gray-700 whitespace-nowrap">{citations.length} domains</span></div></div>); })}{Object.keys(citationsByPrompt).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No citations collected yet</p>}</div></div>
            {selectedCitation && (<div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Citation Details</h3>{(() => { const c = allCitations.find(x => x.url === selectedCitation); if (!c) return null; return (<div className="space-y-3"><div><Label className="text-xs text-gray-500">Title</Label><p className="text-sm text-gray-900">{c.title || "No title"}</p></div><div><Label className="text-xs text-gray-500">URL</Label><a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{c.url}</a></div><div><Label className="text-xs text-gray-500">Domain</Label><p className="text-sm text-gray-900">{c.domain}</p></div><div><Label className="text-xs text-gray-500">Cited in {c.prompts.length} prompt(s)</Label><div className="mt-1 space-y-1">{c.prompts.slice(0, 5).map((p, i) => <p key={i} className="text-xs text-gray-600 truncate">{p}</p>)}</div></div><Button variant="outline" size="sm" className="w-full" onClick={() => navigator.clipboard.writeText(c.url)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy URL</Button></div>); })()}</div>)}
          </div>
        </div>
      </div>
    );
  }

  function ContentTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Content Generator</h2><p className="text-sm text-gray-500">Generate SEO-optimized content based on your brand and audit insights</p></div></div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4"><div><Label>Topic / Title</Label><Input placeholder="e.g., Best dating apps for professionals in 2025" value={contentTopic} onChange={(e) => setContentTopic(e.target.value)} className="mt-1" /></div><div><Label>Content Type</Label><Select value={contentType} onValueChange={setContentType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="article">Article</SelectItem><SelectItem value="listicle">Listicle (Top 10)</SelectItem><SelectItem value="comparison">Comparison Guide</SelectItem><SelectItem value="guide">How-To Guide</SelectItem><SelectItem value="faq">FAQ Section</SelectItem></SelectContent></Select></div></div>
              <div className="p-4 bg-gray-50 rounded-lg"><Label className="text-sm font-medium">Content will include:</Label><div className="mt-3 flex flex-wrap gap-2">{selectedClient?.brand_name && <span className="inline-flex items-center px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-800 font-medium">Brand: {selectedClient.brand_name}</span>}{selectedClient?.target_region && <span className="inline-flex items-center px-3 py-1.5 bg-green-100 border border-green-300 rounded-lg text-sm text-green-800 font-medium">Region: {selectedClient.target_region}</span>}{selectedClient?.industry && <span className="inline-flex items-center px-3 py-1.5 bg-purple-100 border border-purple-300 rounded-lg text-sm text-purple-800 font-medium">Industry: {selectedClient.industry}</span>}{selectedClient?.competitors?.slice(0, 3).map((c, i) => <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-800 font-medium"><BrandLogo name={c} size={14} />{c}</span>)}</div></div>
              <Button onClick={handleGenerateContent} disabled={generatingContent || !contentTopic.trim()} className="w-full bg-gray-900 hover:bg-gray-800">{generatingContent ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate Content</>}</Button>
              {generatedContent && (<div className="mt-6"><div className="flex items-center justify-between mb-3"><Label className="text-sm font-medium">Generated Content</Label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(generatedContent)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button><Button variant="outline" size="sm" onClick={() => { const blob = new Blob([generatedContent], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${contentTopic.replace(/\s+/g, "-").toLowerCase()}-content.md`; a.click(); URL.revokeObjectURL(url); }}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button></div></div><div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg border max-h-[500px] overflow-y-auto"><pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{generatedContent}</pre></div></div>)}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Quick Topics</h3><p className="text-xs text-gray-500 mb-3">Based on your prompts and audit results</p><div className="space-y-2">{prompts.slice(0, 5).map((p, i) => (<button key={i} onClick={() => setContentTopic(p.prompt_text)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg truncate">{p.prompt_text}</button>))}{prompts.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Add prompts to see suggestions</p>}</div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Content Ideas</h3><div className="space-y-2">{[`Why ${selectedClient?.brand_name} is the best choice in ${selectedClient?.target_region}`, `${selectedClient?.brand_name} vs ${selectedClient?.competitors[0] || "Competitors"}: Complete Comparison`, `Top 10 reasons to choose ${selectedClient?.brand_name}`, `How ${selectedClient?.brand_name} solves common ${selectedClient?.industry} problems`].map((idea, i) => (<button key={i} onClick={() => setContentTopic(idea)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">{idea}</button>))}</div></div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5"><h3 className="font-semibold text-blue-900 mb-2">Pro Tip</h3><p className="text-sm text-blue-700">Generate content for topics where your brand has low visibility to improve your AI search presence.</p></div>
          </div>
        </div>
      </div>
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
                    <button onClick={() => updateBrandTags(selectedClient.brand_tags.filter((_, j) => j !== i))} className="ml-1 text-blue-600 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
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
                    <BrandLogo name={c} size={16} />
                    <span>{c}</span>
                    <button onClick={() => updateCompetitors(selectedClient.competitors.filter((_, j) => j !== i))} className="ml-1 text-gray-500 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
                {(!selectedClient?.competitors || selectedClient.competitors.length === 0) && <span className="text-sm text-gray-400 italic">No competitors added</span>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add competitor..." value={newCompetitor} onChange={(e) => setNewCompetitor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()} className="bg-white" />
                <Button size="sm" onClick={handleAddCompetitor} className="bg-green-600 hover:bg-green-700 text-white">Add</Button>
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
                      <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">${model.costPerQuery.toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
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

  function AddClientDialog() {
    return (
      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Add New Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Brand Name *</Label>
                <Input 
                  placeholder="e.g., Acme Corp" 
                  value={newClientForm.name} 
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, name: e.target.value }))} 
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
                <Select value={newClientForm.industry} onValueChange={(v) => setNewClientForm(prev => ({ ...prev, industry: v }))}>
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
            <div>
              <Label className="text-sm font-medium text-gray-700">Competitors (comma-separated)</Label>
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
                <Label className="text-sm font-medium text-gray-700">Logo URL (optional)</Label>
                <Input 
                  placeholder="https://example.com/logo.png" 
                  value={newClientForm.logo_url} 
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, logo_url: e.target.value }))} 
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500" 
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => setAddClientOpen(false)} className="border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</Button>
            <Button onClick={handleCreateClient} disabled={!newClientForm.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Create Brand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function EditClientDialog() {
    return (
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Edit Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
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
                <Select value={editClientForm.industry} onValueChange={(v) => setEditClientForm(prev => ({ ...prev, industry: v }))}>
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
            <div>
              <Label className="text-sm font-medium text-gray-700">Competitors (comma-separated)</Label>
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
                <Label className="text-sm font-medium text-gray-700">Logo URL (optional)</Label>
                <Input 
                  placeholder="https://example.com/logo.png" 
                  value={editClientForm.logo_url} 
                  onChange={(e) => setEditClientForm(prev => ({ ...prev, logo_url: e.target.value }))} 
                  className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400" 
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 pt-4 flex justify-between">
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDeleteClient}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete Brand
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditClientOpen(false)} className="border-gray-300 text-gray-700">Cancel</Button>
              <Button onClick={handleUpdateClient} disabled={!editClientForm.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
            </div>
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
                    <Button variant="outline" size="sm" onClick={() => { setEditClientForm({ name: client.name, brand_name: client.brand_name, target_region: client.target_region, industry: client.industry, primary_color: client.primary_color, logo_url: "", competitors: client.competitors?.join(", ") || "" }); switchClient(client); setManageBrandsOpen(false); setEditClientOpen(true); }} className="text-gray-600"><Settings className="h-4 w-4 mr-1" /> Edit</Button>
                    {clients.length > 1 && (<Button variant="outline" size="sm" onClick={() => { if (confirm("Delete " + client.name + "?")) deleteClient(client.id); }} className="text-red-600 border-red-200 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>)}
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
    return (<Dialog open={bulkPromptsOpen} onOpenChange={setBulkPromptsOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add Prompts</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Single Prompt</Label><div className="flex gap-2 mt-1"><Input placeholder="Enter a search prompt..." value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddPrompt()} /><Button onClick={handleAddPrompt}>Add</Button></div></div><div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or bulk add</span></div></div><div><Label>Multiple Prompts (one per line)</Label><Textarea placeholder={"Best dating apps in India\nDating apps with verification\nSafe dating apps for women"} value={bulkPrompts} onChange={(e) => setBulkPrompts(e.target.value)} rows={6} className="mt-1" /></div><div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">Or generate with AI</span></div></div><div><Label>Generate from Keywords</Label><div className="flex gap-2 mt-1"><Input placeholder="dating apps, verification, safety" value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} /><Button onClick={handleGeneratePrompts} disabled={generatingPrompts}>{generatingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}</Button></div></div></div><DialogFooter><Button variant="outline" onClick={() => { setImportDialogOpen(true); setBulkPromptsOpen(false); }}>Import File</Button><Button onClick={handleBulkAdd} disabled={!bulkPrompts.trim()}>Add {bulkPrompts.split("\n").filter(l => l.trim().length > 3).length} Prompts</Button></DialogFooter></DialogContent></Dialog>);
  }

  function PromptDetailDialog() {
    const result = filteredAuditResults.find(r => r.prompt_id === selectedPromptDetail);
    const prompt = prompts.find(p => p.id === selectedPromptDetail);
    const [detailTab, setDetailTab] = useState<"models" | "citations">("models");
    if (!result && !prompt) return null;
    const allPromptCitations = result?.model_results.flatMap(mr => mr.citations.map(c => ({ ...c, model: mr.model_name }))) || [];
    const uniqueCitations = Array.from(new Map(allPromptCitations.map(c => [c.url, c])).values());
    return (<Dialog open={!!selectedPromptDetail} onOpenChange={() => setSelectedPromptDetail(null)}><DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle className="text-lg pr-8">{prompt?.prompt_text || result?.prompt_text}</DialogTitle></DialogHeader>{result ? (<div className="space-y-4"><div className="grid grid-cols-4 gap-4"><div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-gray-900">{result.summary.share_of_voice}%</div><div className="text-xs text-gray-500">Visibility</div></div><div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-gray-900">{result.summary.average_rank ? `#${result.summary.average_rank}` : "--"}</div><div className="text-xs text-gray-500">Avg Rank</div></div><div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-gray-900">{result.summary.total_citations}</div><div className="text-xs text-gray-500">Citations</div></div><div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-gray-900">${result.summary.total_cost.toFixed(4)}</div><div className="text-xs text-gray-500">Cost</div></div></div><div className="flex items-center gap-2 border-b"><button onClick={() => setDetailTab("models")} className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px", detailTab === "models" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700")}>Model Results</button><button onClick={() => setDetailTab("citations")} className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px", detailTab === "citations" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700")}>Citations ({uniqueCitations.length})</button></div>{detailTab === "models" && (<div className="space-y-3">{result.model_results.map((mr, i) => { const Logo = MODEL_LOGOS[mr.model]?.Logo; const color = MODEL_LOGOS[mr.model]?.color || "#666"; return (<div key={i} className="border rounded-lg p-4"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2">{Logo && <Logo className="h-5 w-5" style={{ color }} />}<span className="font-medium">{mr.model_name}</span></div><div className="flex items-center gap-2">{mr.brand_mentioned ? <Badge className="bg-green-100 text-green-700">Visible</Badge> : <Badge variant="outline" className="text-gray-500">Not Visible</Badge>}{mr.brand_rank && <Badge variant="outline">#{mr.brand_rank}</Badge>}<Badge variant="secondary">{mr.citations.length} citations</Badge></div></div>{mr.raw_response && <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap">{mr.raw_response.substring(0, 800)}{mr.raw_response.length > 800 && "..."}</div>}{mr.citations.length > 0 && (<div className="mt-3 pt-3 border-t"><div className="text-xs font-medium text-gray-500 mb-2">Sources cited:</div><div className="grid grid-cols-2 gap-2">{mr.citations.slice(0, 6).map((c, j) => (<a key={j} href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 text-xs"><img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`} alt="" className="h-4 w-4" /><span className="truncate text-gray-700">{c.title || c.domain}</span><ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" /></a>))}{mr.citations.length > 6 && <div className="text-xs text-gray-400 p-2">+{mr.citations.length - 6} more</div>}</div></div>)}</div>); })}</div>)}{detailTab === "citations" && (<div className="space-y-2">{uniqueCitations.length === 0 ? (<div className="text-center py-8 text-gray-500"><Link2 className="h-10 w-10 mx-auto mb-2 text-gray-300" /><p>No citations found for this prompt</p></div>) : (uniqueCitations.map((c, i) => { const t = DOMAIN_TYPES[classifyDomain(c.domain)] || DOMAIN_TYPES.other; const modelsUsing = allPromptCitations.filter(x => x.url === c.url).map(x => x.model); return (<div key={i} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"><img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=20`} alt="" className="h-5 w-5 mt-0.5 rounded" /><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1">{c.title || c.url}</a><p className="text-xs text-gray-500 truncate">{c.url}</p></div><span className={cn("px-2 py-0.5 rounded text-xs font-medium flex-shrink-0", t.bg, t.color)}>{t.label}</span></div><div className="flex items-center gap-2 mt-2"><span className="text-xs text-gray-500">Cited by:</span>{[...new Set(modelsUsing)].map((m, j) => <Badge key={j} variant="outline" className="text-xs">{m}</Badge>)}</div></div><div className="flex gap-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigator.clipboard.writeText(c.url)}><Copy className="h-3.5 w-3.5" /></Button><a href={c.url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><ExternalLink className="h-3.5 w-3.5" /></Button></a></div></div>); }))}</div>)}</div>) : (<div className="text-center py-8 text-gray-500"><MessageSquare className="h-10 w-10 mx-auto mb-2 text-gray-300" /><p>No results yet. Run this prompt to see analysis.</p><Button className="mt-4" onClick={() => { if (prompt) runSinglePrompt(prompt.id); setSelectedPromptDetail(null); }}>Run Now</Button></div>)}</DialogContent></Dialog>);
  }

  function ImportDialog() {
    return (<Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Import Prompts</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Paste JSON or text (one prompt per line)</Label><Textarea placeholder={'{"prompts": ["prompt 1", "prompt 2"]}\nor\nprompt 1\nprompt 2'} value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} className="mt-1 font-mono text-sm" /></div><div className="text-center text-sm text-gray-500">or</div><Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>Upload File (.json, .csv, .txt)</Button></div><DialogFooter><Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button><Button onClick={handleImport}>Import</Button></DialogFooter></DialogContent></Dialog>);
  }
}
