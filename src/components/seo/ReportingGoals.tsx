import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Calendar, Target, Flag, FileText, Loader2, Plus, X, Check,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
  Download, Mail, Clock, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { callGroq, parseAIJson, fmtNum, fmtPct, fmtDate, callSEOFunction } from "./helpers";
import type { KPIGoal, Annotation, WeeklyReport } from "./types";
import type { SEORow, SEOMetricSummary, TopQuery } from "@/hooks/useSEOConnector";

interface ReportingGoalsProps {
  clientId: string;
  siteUrl: string | null;
  brandName: string;
  metrics: SEOMetricSummary;
  topQueries: TopQuery[];
  gscData: SEORow[];
  dateRange: number;
}

export default function ReportingGoals({
  clientId, brandName, metrics, topQueries, dateRange,
}: ReportingGoalsProps) {
  const [activePanel, setActivePanel] = useState<"report" | "goals" | "annotations">("report");

  // ── Weekly Report ───────────────────────────────────────────────────────
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportHistory, setReportHistory] = useState<WeeklyReport[]>([]);

  // ── KPI Goals ───────────────────────────────────────────────────────────
  const [goals, setGoals] = useState<KPIGoal[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalKeyword, setGoalKeyword] = useState("");
  const [goalMetric, setGoalMetric] = useState<"position" | "clicks" | "ctr" | "impressions">("position");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  // ── Annotations ─────────────────────────────────────────────────────────
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showAnnotForm, setShowAnnotForm] = useState(false);
  const [annotDate, setAnnotDate] = useState(new Date().toISOString().split("T")[0]);
  const [annotLabel, setAnnotLabel] = useState("");
  const [annotCategory, setAnnotCategory] = useState<Annotation["category"]>("content");

  // ── Auto-load Cache ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    const loadCache = async () => {
      try {
        const res = await callSEOFunction("seo-tools", "get_all_audits", clientId, {});
        const audits = res.audits || [];

        const cachedReport = audits.find((a: any) => a.audit_type === "weekly_report");
        if (cachedReport) setReport(cachedReport.data);

        const cachedGoals = audits.find((a: any) => a.audit_type === "kpi_goals");
        if (cachedGoals) setGoals(cachedGoals.data.goals || []);

        const cachedAnnots = audits.find((a: any) => a.audit_type === "annotations");
        if (cachedAnnots) setAnnotations(cachedAnnots.data.annotations || []);

      } catch (err) {
        console.error("Failed to load reporting cache:", err);
      }
    };
    loadCache();
  }, [clientId]);

  // ── Generate Weekly Report ──────────────────────────────────────────────

  const generateReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const queriesStr = topQueries.slice(0, 15).map(q =>
        `"${q.query}" (clicks: ${q.clicks}, pos: ${q.position.toFixed(1)})`
      ).join("\n");

      const prompt = `Generate a concise weekly SEO performance report.

CURRENT METRICS:
- Total Clicks: ${metrics.totalClicks}
- Total Impressions: ${metrics.totalImpressions}
- Avg CTR: ${metrics.avgCTR.toFixed(2)}%
- Avg Position: ${metrics.avgPosition.toFixed(1)}
- Brand: ${brandName || "the website"}
- Date Range: Last ${dateRange} days

TOP QUERIES:
${queriesStr || "No data"}

Return ONLY a JSON object:
{
  "summary": "3-4 sentence executive summary of SEO performance this week",
  "clicksChange": 5,
  "impressionsChange": 12,
  "avgPositionChange": -0.3,
  "topMoversUp": [{"query": "keyword", "change": 3}],
  "topMoversDown": [{"query": "keyword", "change": -2}],
  "newKeywords": 5,
  "lostKeywords": 2
}`;

      const response = await callGroq(prompt,
        "You are an SEO analyst. Generate concise, insightful weekly reports. Return ONLY valid JSON.",
        1500
      );
      const parsed = parseAIJson<any>(response);

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      const reportObj: WeeklyReport = {
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: now.toISOString().split("T")[0],
        summary: parsed.summary || "",
        clicksChange: parsed.clicksChange || 0,
        impressionsChange: parsed.impressionsChange || 0,
        avgPositionChange: parsed.avgPositionChange || 0,
        topMoversUp: parsed.topMoversUp || [],
        topMoversDown: parsed.topMoversDown || [],
        newKeywords: parsed.newKeywords || 0,
        lostKeywords: parsed.lostKeywords || 0,
        generatedAt: now.toISOString(),
      };

      setReport(reportObj);
      setReportHistory(prev => [reportObj, ...prev].slice(0, 10));

        // Save to seo_site_audit for historic persistence
        try {
          await callSEOFunction("seo-tools", "save_audit", clientId, {
            audit_type: "weekly_report",
            data: reportObj
          });
        } catch (e) { console.error("Failed to save report:", e); }

      } catch (err: any) {
        toast.error("Report generation failed: " + err.message);
      } finally {
        setReportLoading(false);
      }
    }, [metrics, topQueries, brandName, dateRange, clientId]);

  const copyReport = useCallback(() => {
    if (!report) return;
    const text = `SEO Weekly Report (${report.weekStart} → ${report.weekEnd})\n\n${report.summary}\n\nKey Changes:\n• Clicks: ${report.clicksChange > 0 ? "+" : ""}${report.clicksChange}%\n• Impressions: ${report.impressionsChange > 0 ? "+" : ""}${report.impressionsChange}%\n• Avg Position: ${report.avgPositionChange > 0 ? "+" : ""}${report.avgPositionChange}\n\nTop Movers Up: ${report.topMoversUp.map(m => `${m.query} (+${m.change})`).join(", ") || "None"}\nTop Movers Down: ${report.topMoversDown.map(m => `${m.query} (${m.change})`).join(", ") || "None"}\n\nNew Keywords: ${report.newKeywords} | Lost Keywords: ${report.lostKeywords}\n\nGenerated by Forzeo SEO Dashboard`;
    navigator.clipboard.writeText(text);
    toast.success("Report copied to clipboard!");
  }, [report]);

  const emailReport = useCallback(() => {
    if (!report) return;
    const text = `SEO Weekly Report (${report.weekStart} → ${report.weekEnd})\n\n${report.summary}\n\nKey Changes:\n• Clicks: ${report.clicksChange > 0 ? "+" : ""}${report.clicksChange}%\n• Impressions: ${report.impressionsChange > 0 ? "+" : ""}${report.impressionsChange}%\n• Avg Position: ${report.avgPositionChange > 0 ? "+" : ""}${report.avgPositionChange}\n\nTop Movers Up: ${report.topMoversUp.map(m => `${m.query} (+${m.change})`).join(", ") || "None"}\nTop Movers Down: ${report.topMoversDown.map(m => `${m.query} (${m.change})`).join(", ") || "None"}\n\nNew Keywords: ${report.newKeywords} | Lost Keywords: ${report.lostKeywords}`;
    const subject = encodeURIComponent(`Weekly SEO Performance Report - ${brandName || "Update"}`);
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }, [report, brandName]);

  // ── KPI Goal Management ─────────────────────────────────────────────────

  const addGoal = useCallback(async () => {
    if (!goalKeyword || !goalTarget) { toast.error("Fill in all fields"); return; }
    const currentQuery = topQueries.find(q => q.query.toLowerCase() === goalKeyword.toLowerCase());

    const newGoal: KPIGoal = {
      id: Date.now().toString(),
      keyword: goalKeyword,
      metric: goalMetric,
      targetValue: parseFloat(goalTarget),
      currentValue: goalMetric === "position" ? (currentQuery?.position || 0)
        : goalMetric === "clicks" ? (currentQuery?.clicks || 0)
        : goalMetric === "ctr" ? (currentQuery?.ctr || 0)
        : (currentQuery?.impressions || 0),
      deadline: goalDeadline || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      status: "on_track",
    };

    // Determine status
    const progress = goalMetric === "position"
      ? newGoal.currentValue <= newGoal.targetValue ? 100 : ((newGoal.targetValue / newGoal.currentValue) * 100)
      : (newGoal.currentValue / newGoal.targetValue) * 100;
    newGoal.status = progress >= 100 ? "achieved" : progress >= 60 ? "on_track" : "at_risk";

    const updated = [...goals, newGoal];
    setGoals(updated);
    
    // Save for historic data
    try {
      await callSEOFunction("seo-tools", "save_audit", clientId, {
        audit_type: "kpi_goals",
        data: { goals: updated }
      });
    } catch {}

    setGoalKeyword("");
    setGoalTarget("");
    setGoalDeadline("");
    setShowGoalForm(false);
    toast.success("Goal added!");
  }, [goalKeyword, goalMetric, goalTarget, goalDeadline, topQueries, goals]);

  const removeGoal = useCallback(async (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    try {
      await callSEOFunction("seo-tools", "save_audit", clientId, {
        audit_type: "kpi_goals",
        data: { goals: updated }
      });
    } catch {}
  }, [goals]);

  // ── Annotation Management ──────────────────────────────────────────────

  const addAnnotation = useCallback(async () => {
    if (!annotLabel) { toast.error("Enter a label"); return; }
    const newAnnot: Annotation = {
      id: Date.now().toString(),
      date: annotDate,
      label: annotLabel,
      color: annotCategory === "algorithm" ? "#ef4444"
        : annotCategory === "content" ? "#3b82f6"
        : annotCategory === "technical" ? "#f59e0b"
        : annotCategory === "campaign" ? "#8b5cf6"
        : "#64748b",
      category: annotCategory,
      createdAt: new Date().toISOString(),
    };
    const updated = [...annotations, newAnnot].sort((a, b) => b.date.localeCompare(a.date));
    setAnnotations(updated);

    // Save for historic data
    try {
      await callSEOFunction("seo-tools", "save_audit", clientId, {
        audit_type: "annotations",
        data: { annotations: updated }
      });
    } catch {}

    setAnnotLabel("");
    setShowAnnotForm(false);
    toast.success("Annotation added!");
  }, [annotDate, annotLabel, annotCategory, annotations]);

  const removeAnnotation = useCallback(async (id: string) => {
    const updated = annotations.filter(a => a.id !== id);
    setAnnotations(updated);
    try {
      await callSEOFunction("seo-tools", "save_audit", clientId, {
        audit_type: "annotations",
        data: { annotations: updated }
      });
    } catch {}
  }, [annotations]);

  const ANNOTATION_CATEGORIES = [
    { id: "content", label: "Content", color: "bg-blue-100 text-blue-700" },
    { id: "technical", label: "Technical", color: "bg-amber-100 text-amber-700" },
    { id: "algorithm", label: "Algorithm", color: "bg-rose-100 text-rose-700" },
    { id: "campaign", label: "Campaign", color: "bg-purple-100 text-purple-700" },
    { id: "other", label: "Other", color: "bg-gray-100 text-gray-700" },
  ] as const;

  const panels = [
    { id: "report", label: "Weekly Report", icon: FileText },
    { id: "goals", label: "KPI Goals", icon: Target },
    { id: "annotations", label: "Annotations", icon: Calendar },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-fit flex-wrap">
        {panels.map(p => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activePanel === p.id ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700")}>
            <p.icon className="h-3.5 w-3.5" />{p.label}
          </button>
        ))}
      </div>

      {/* ── Weekly Report ────────────────────────────────────────────────── */}
      {activePanel === "report" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Weekly SEO Report</h3>
              <p className="text-xs text-gray-500 mt-0.5">AI-generated performance summary</p>
            </div>
            <div className="flex gap-2">
              {report && (
                <>
                  <Button variant="outline" size="sm" onClick={emailReport} className="gap-2 text-xs h-8">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyReport} className="gap-2 text-xs h-8">
                    <Download className="h-3.5 w-3.5" /> Copy
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={generateReport} disabled={reportLoading} className="gap-2 text-xs h-8">
                {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate Report
              </Button>
            </div>
          </div>

          {!report ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Generate Report" to create an AI-powered weekly SEO summary</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h4 className="text-base font-bold text-gray-900">SEO Performance Report</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{report.weekStart} → {report.weekEnd}</p>
                </div>
                <Clock className="h-5 w-5 text-gray-300" />
              </div>

              {/* Summary */}
              <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>

              {/* Changes */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Clicks", value: report.clicksChange, suffix: "%" },
                  { label: "Impressions", value: report.impressionsChange, suffix: "%" },
                  { label: "Avg Position", value: report.avgPositionChange, suffix: "", invert: true },
                  { label: "New Keywords", value: report.newKeywords, suffix: "", raw: true },
                ].map((c, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 p-3">
                    <span className="text-[10px] text-gray-500 uppercase">{c.label}</span>
                    <div className="flex items-center gap-1 mt-1">
                      {!c.raw && (
                        c.invert
                          ? (c.value < 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> : c.value > 0 ? <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" /> : <Minus className="h-3 w-3 text-gray-400" />)
                          : (c.value > 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> : c.value < 0 ? <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" /> : <Minus className="h-3 w-3 text-gray-400" />)
                      )}
                      <span className={cn("text-lg font-bold",
                        c.raw ? "text-blue-600"
                        : (c.invert ? c.value <= 0 : c.value >= 0) ? "text-emerald-600" : "text-rose-600")}>
                        {c.raw ? c.value : `${c.value > 0 ? "+" : ""}${c.value}${c.suffix}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Movers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <h5 className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Top Movers Up
                  </h5>
                  {report.topMoversUp.length > 0 ? (
                    <div className="space-y-1.5">
                      {report.topMoversUp.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-emerald-700">{m.query}</span>
                          <span className="font-bold text-emerald-600">+{m.change}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-emerald-600">No significant movers</p>}
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-xs font-bold text-rose-800 mb-2 flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5" /> Top Movers Down
                  </h5>
                  {report.topMoversDown.length > 0 ? (
                    <div className="space-y-1.5">
                      {report.topMoversDown.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-rose-700">{m.query}</span>
                          <span className="font-bold text-rose-600">{m.change}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-rose-600">No significant declines</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Goals ────────────────────────────────────────────────────── */}
      {activePanel === "goals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">SEO Goals</h3>
              <p className="text-xs text-gray-500 mt-0.5">Set targets and track progress</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowGoalForm(!showGoalForm)} className="gap-2 text-xs h-8">
              <Plus className="h-3.5 w-3.5" /> Add Goal
            </Button>
          </div>

          {showGoalForm && (
            <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Keyword</Label>
                  <Input placeholder="e.g. seo tools" value={goalKeyword} onChange={e => setGoalKeyword(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Metric</Label>
                  <select value={goalMetric} onChange={e => setGoalMetric(e.target.value as any)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 h-9">
                    <option value="position">Position</option>
                    <option value="clicks">Clicks</option>
                    <option value="ctr">CTR (%)</option>
                    <option value="impressions">Impressions</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Target</Label>
                  <Input type="number" placeholder="e.g. 3" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Deadline</Label>
                  <Input type="date" value={goalDeadline} onChange={e => setGoalDeadline(e.target.value)} className="text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addGoal} className="gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <Check className="h-3.5 w-3.5" /> Save Goal
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowGoalForm(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {goals.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No goals set yet. Click "Add Goal" to set SEO targets.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map(g => {
                const progress = g.metric === "position"
                  ? g.currentValue > 0 ? Math.min(100, (g.targetValue / g.currentValue) * 100) : 0
                  : g.targetValue > 0 ? Math.min(100, (g.currentValue / g.targetValue) * 100) : 0;
                return (
                  <div key={g.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full",
                          g.status === "achieved" ? "bg-emerald-500"
                          : g.status === "on_track" ? "bg-blue-500"
                          : "bg-amber-500")} />
                        <span className="text-sm font-bold text-gray-800">"{g.keyword}"</span>
                        <span className="text-xs text-gray-500 capitalize">{g.metric}</span>
                      </div>
                      <button onClick={() => removeGoal(g.id!)} className="text-gray-400 hover:text-rose-500 p-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-gray-500">Current: <b>{g.metric === "ctr" ? fmtPct(g.currentValue) : g.currentValue}</b></span>
                      <span className="text-gray-300">→</span>
                      <span className="text-xs text-blue-600 font-bold">Target: {g.metric === "ctr" ? fmtPct(g.targetValue) : g.targetValue}</span>
                      {g.deadline && <span className="text-[10px] text-gray-400 ml-auto">by {fmtDate(g.deadline)}</span>}
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, progress)}%`,
                          backgroundColor: progress >= 100 ? "#10b981" : progress >= 60 ? "#3b82f6" : "#f59e0b",
                        }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{Math.round(progress)}% complete</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Annotations ──────────────────────────────────────────────────── */}
      {activePanel === "annotations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Chart Annotations</h3>
              <p className="text-xs text-gray-500 mt-0.5">Mark important dates on your SEO charts</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAnnotForm(!showAnnotForm)} className="gap-2 text-xs h-8">
              <Plus className="h-3.5 w-3.5" /> Add Note
            </Button>
          </div>

          {showAnnotForm && (
            <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Date</Label>
                  <Input type="date" value={annotDate} onChange={e => setAnnotDate(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Label</Label>
                  <Input placeholder="e.g. Published blog post" value={annotLabel} onChange={e => setAnnotLabel(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Category</Label>
                  <select value={annotCategory} onChange={e => setAnnotCategory(e.target.value as any)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 h-9">
                    {ANNOTATION_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addAnnotation} className="gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <Check className="h-3.5 w-3.5" /> Add
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAnnotForm(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {annotations.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No annotations yet. Add notes to mark important dates on your charts.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {annotations.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: a.color }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{a.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">{fmtDate(a.date)}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                          ANNOTATION_CATEGORIES.find(c => c.id === a.category)?.color || "bg-gray-100 text-gray-600")}>
                          {a.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeAnnotation(a.id!)} className="text-gray-400 hover:text-rose-500 p-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
