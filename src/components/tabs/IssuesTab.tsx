import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Search, Info, Globe, Tag, Clock, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Client, Prompt, AuditResult } from "@/hooks/useClientDashboard";

interface IssuesTabProps {
  selectedClient: Client | null;
  prompts: Prompt[];
  auditResults: AuditResult[];
  isAdmin: boolean;
  setActiveTab?: (tab: string) => void;
}

type Severity = "critical" | "high" | "medium" | "low";
type SubTab = "aeo" | "technical" | "content";

interface Issue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  count: number;
  action?: string;
  actionTab?: string;
}

const SEVERITY_STYLES: Record<Severity, { dot: string; badge: string; label: string; order: number }> = {
  critical: { dot: "bg-red-500", badge: "bg-red-100 text-red-700", label: "Critical", order: 0 },
  high:     { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700", label: "High", order: 1 },
  medium:   { dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700", label: "Medium", order: 2 },
  low:      { dot: "bg-sky-400", badge: "bg-sky-100 text-sky-700", label: "Low", order: 3 },
};

export function IssuesTab({ selectedClient, prompts, auditResults, setActiveTab }: IssuesTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("aeo");
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [search, setSearch] = useState("");

  // Derive AEO issues from real data
  const aeoIssues = useMemo((): Issue[] => {
    const issues: Issue[] = [];
    const runPromptIds = new Set(auditResults.map(r => r.prompt_id));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Zero visibility prompts
    const zeroVisPrompts = auditResults.filter(r => (r.summary?.share_of_voice ?? 0) === 0);
    if (zeroVisPrompts.length > 0) {
      issues.push({
        id: "zero-vis",
        title: "Zero Visibility Prompts",
        description: `${zeroVisPrompts.length} prompt${zeroVisPrompts.length > 1 ? "s have" : " has"} 0% visibility — your brand is not being mentioned in AI responses for these queries.`,
        severity: zeroVisPrompts.length > 5 ? "high" : "medium",
        count: zeroVisPrompts.length,
        action: "View Prompts",
        actionTab: "prompts",
      });
    }

    // 2. No recent audits
    const stalePrompts = prompts.filter(p => {
      const result = auditResults.find(r => r.prompt_id === p.id);
      if (!result) return runPromptIds.has(p.id) ? false : true;
      return new Date(result.created_at) < thirtyDaysAgo;
    });
    if (stalePrompts.length > 0) {
      issues.push({
        id: "stale-audits",
        title: "Stale Audit Data",
        description: `${stalePrompts.length} prompt${stalePrompts.length > 1 ? "s have" : " has"} not been audited in the last 30 days. AI responses change frequently — fresh data matters.`,
        severity: "medium",
        count: stalePrompts.length,
        action: "Run Audit",
        actionTab: "schedules",
      });
    }

    // 3. Prompts with no topic
    const noTopicPrompts = prompts.filter(p => p.is_active !== false && !p.topic);
    if (noTopicPrompts.length > 0) {
      issues.push({
        id: "no-topic",
        title: "Untagged Prompts",
        description: `${noTopicPrompts.length} prompt${noTopicPrompts.length > 1 ? "s have" : " has"} no topic assigned. Grouping prompts by topic helps track coverage across buyer journey stages.`,
        severity: "low",
        count: noTopicPrompts.length,
        action: "Assign Topics",
        actionTab: "topics",
      });
    }

    // 4. No prompts at all
    if (prompts.filter(p => p.is_active !== false).length === 0) {
      issues.push({
        id: "no-prompts",
        title: "No Active Prompts",
        description: "You have no active prompts. Add prompts to start tracking your brand's visibility in AI search engines.",
        severity: "critical",
        count: 1,
        action: "Add Prompts",
        actionTab: "prompts",
      });
    }

    // 5. Low overall SOV
    const totalAudits = auditResults.length;
    if (totalAudits > 3) {
      const avgSOV = auditResults.reduce((s, r) => s + (r.summary?.share_of_voice ?? 0), 0) / totalAudits;
      if (avgSOV < 20) {
        issues.push({
          id: "low-sov",
          title: "Low Share of Voice",
          description: `Your average visibility is ${Math.round(avgSOV)}% — below the 20% benchmark. Consider adding more brand-specific prompts and improving your content's AI-citation signals.`,
          severity: avgSOV < 10 ? "high" : "medium",
          count: 1,
          action: "View Overview",
          actionTab: "overview",
        });
      }
    }

    // 6. No competitors configured
    if ((selectedClient?.competitors || []).length === 0 && totalAudits > 0) {
      issues.push({
        id: "no-competitors",
        title: "No Competitors Configured",
        description: "Add competitors in your brand settings to enable Share of Voice tracking and competitive gap analysis.",
        severity: "low",
        count: 1,
      });
    }

    return issues.sort((a, b) => SEVERITY_STYLES[a.severity].order - SEVERITY_STYLES[b.severity].order);
  }, [prompts, auditResults, selectedClient]);

  const filteredIssues = useMemo(() => {
    let list = subTab === "aeo" ? aeoIssues : [];
    if (severity !== "all") list = list.filter(i => i.severity === severity);
    if (search.trim()) list = list.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [subTab, aeoIssues, severity, search]);

  const criticalCount = aeoIssues.filter(i => i.severity === "critical").length;
  const highCount = aeoIssues.filter(i => i.severity === "high").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Issues</h2>
        <p className="text-sm text-gray-500 mt-0.5">Detected issues across your AEO presence. Fixing these improves your AI search visibility.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issues", value: aeoIssues.length, color: "text-gray-900", bg: "bg-white" },
          { label: "Critical", value: criticalCount, color: "text-red-600", bg: "bg-red-50" },
          { label: "High", value: highCount, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Resolved", value: 0, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(stat => (
          <div key={stat.label} className={cn("rounded-xl border border-gray-200 p-4 shadow-sm", stat.bg)}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className={cn("text-3xl font-bold mt-2", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Sub-tabs */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          {(["aeo", "technical", "content"] as SubTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                subTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === "aeo" ? "AEO" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
          <SelectTrigger className="w-[160px] h-9 text-xs bg-white border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={`Search ${filteredIssues.length} issues...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white border-gray-200"
          />
        </div>
      </div>

      {/* Issues list */}
      {subTab === "aeo" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {filteredIssues.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredIssues.map((issue, i) => {
                const sev = SEVERITY_STYLES[issue.severity];
                return (
                  <div key={issue.id} className="flex items-start gap-4 p-5 hover:bg-gray-50/50 transition-colors">
                    <span className="text-xs font-medium text-gray-400 w-5 flex-shrink-0 pt-0.5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full", sev.badge)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", sev.dot)} />
                          {sev.label}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-900">{issue.title}</h4>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{issue.description}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 font-medium hidden sm:inline">{issue.count} affected</span>
                      {issue.action && setActiveTab && issue.actionTab && (
                        <button
                          onClick={() => setActiveTab!(issue.actionTab!)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 border border-blue-200 hover:border-blue-400 px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          {issue.action} <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : aeoIssues.length === 0 ? (
            /* All clear */
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-lg">You have 0 outstanding issues</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-sm">Your AEO is looking great — no issues detected. We'll continue monitoring for any new opportunities.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <Search className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No issues match your filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Technical tab placeholder */}
      {subTab === "technical" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Globe className="h-6 w-6 text-blue-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Connect Google Search Console</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Technical issues like crawl errors, indexing problems, and page speed issues will appear here once you connect Search Console.</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full">
            <Clock className="h-3 w-3" /> Coming Soon
          </span>
        </div>
      )}

      {/* Content tab */}
      {subTab === "content" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {(() => {
            const neverRun = prompts.filter(p => p.is_active !== false && !auditResults.find(r => r.prompt_id === p.id));
            if (neverRun.length === 0) {
              return (
                <div className="p-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No content issues found</p>
                  <p className="text-sm text-gray-500 mt-1">All your active prompts have audit data.</p>
                </div>
              );
            }
            return (
              <div className="p-5">
                <div className="flex items-start gap-3 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{neverRun.length} prompts have no content data</p>
                    <p className="text-xs text-amber-700 mt-0.5">These prompts have never been audited. Run them to see how AI models respond to these queries.</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {neverRun.slice(0, 10).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 py-3">
                      <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                      <Tag className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      <p className="text-sm text-gray-700 flex-1 truncate">{p.prompt_text}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">No data</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
