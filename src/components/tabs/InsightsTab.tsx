import React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Lightbulb, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Client, AuditResult } from "@/hooks/useClientDashboard";

export interface AiInsights {
  recommendations: string[];
  priority: "high" | "medium" | "low";
  summary: string;
  keyActions: string[];
}

export interface InsightsTabProps {
  filteredAuditResults: AuditResult[];
  selectedClient: Client | null;
  tavilyResults: Record<string, any>;
  aiInsights: AiInsights | null;
  setAiInsights: React.Dispatch<React.SetStateAction<AiInsights | null>>;
  generatingAiInsights: boolean;
  setGeneratingAiInsights: React.Dispatch<React.SetStateAction<boolean>>;
  generateOverallRecommendations: (aggregatedData: {
    overallSov: number;
    totalPrompts: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    topCompetitors: { name: string; count: number }[];
    topDomains: string[];
    tavilyInsights: string[];
  }) => Promise<AiInsights | null>;
  setSelectedPromptDetail: (promptId: string | null) => void;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({
  filteredAuditResults,
  selectedClient,
  tavilyResults,
  aiInsights,
  setAiInsights,
  generatingAiInsights,
  setGeneratingAiInsights,
  generateOverallRecommendations,
  setSelectedPromptDetail,
}) => {
  // Calculate overall visibility metrics
  const overallSov = filteredAuditResults.length > 0
    ? Math.round(filteredAuditResults.reduce((sum, r) => sum + (r.summary?.share_of_voice || 0), 0) / filteredAuditResults.length)
    : 0;
  const overallPriority = overallSov < 30 ? 'high' : overallSov < 60 ? 'medium' : 'low';

  // Group prompts by priority
  const highPriorityPrompts = filteredAuditResults.filter(r => (r.summary?.share_of_voice || 0) < 30);
  const mediumPriorityPrompts = filteredAuditResults.filter(r => {
    const sov = r.summary?.share_of_voice || 0;
    return sov >= 30 && sov < 60;
  });
  const lowPriorityPrompts = filteredAuditResults.filter(r => (r.summary?.share_of_voice || 0) >= 60);

  // Aggregate recommendations
  const aggregatedRecommendations: string[] = [];

  // Add overall recommendations based on data
  if (overallSov < 30) {
    aggregatedRecommendations.push(`Critical: Overall brand visibility is very low (${overallSov}%). Focus on building authoritative content across all target queries.`);
  }

  // Find top competitors mentioned
  const allCompetitorMentions: Record<string, number> = {};
  filteredAuditResults.forEach(result => {
    result.model_results.forEach(mr => {
      const response = mr.raw_response?.toLowerCase() || '';
      selectedClient?.competitors.forEach(comp => {
        const matches = response.match(new RegExp(comp.toLowerCase(), 'gi'));
        if (matches) {
          allCompetitorMentions[comp] = (allCompetitorMentions[comp] || 0) + matches.length;
        }
      });
    });
  });
  const topCompetitors = Object.entries(allCompetitorMentions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topCompetitors.length > 0) {
    aggregatedRecommendations.push(`Top competitors appearing across audits: ${topCompetitors.map(([name, count]) => `${name} (${count}x)`).join(', ')}. Analyze their content strategies for differentiation opportunities.`);
  }

  // Find top cited domains across all audits
  const allDomains: Record<string, number> = {};
  filteredAuditResults.forEach(result => {
    result.model_results.forEach(mr => {
      mr.citations.forEach(c => {
        allDomains[c.domain] = (allDomains[c.domain] || 0) + 1;
      });
    });
  });
  const topDomains = Object.entries(allDomains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain]) => domain);
  if (topDomains.length > 0) {
    aggregatedRecommendations.push(`High-value citation sources to target: ${topDomains.join(', ')}. Build relationships and create content worthy of citation.`);
  }

  // Add Tavily-based insights
  const tavilyInsights: string[] = [];
  Object.values(tavilyResults).forEach((data: any) => {
    if (data?.analysis?.insights) {
      data.analysis.insights.forEach((insight: string) => {
        if (!tavilyInsights.includes(insight)) {
          tavilyInsights.push(insight);
        }
      });
    }
  });
  if (tavilyInsights.length > 0) {
    tavilyInsights.slice(0, 3).forEach(insight => {
      aggregatedRecommendations.push(`Discovery Engine insight: ${insight}`);
    });
  }

  // High-priority prompts need attention
  if (highPriorityPrompts.length > 0) {
    aggregatedRecommendations.push(`${highPriorityPrompts.length} prompt${highPriorityPrompts.length > 1 ? 's' : ''} with critical visibility gaps require immediate content creation attention.`);
  }

  // Handler to generate AI-powered pinpoint recommendations
  const handleGenerateAiInsights = async () => {
    setGeneratingAiInsights(true);
    try {
      const topComps = Object.entries(allCompetitorMentions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      const result = await generateOverallRecommendations({
        overallSov,
        totalPrompts: filteredAuditResults.length,
        highPriorityCount: highPriorityPrompts.length,
        mediumPriorityCount: mediumPriorityPrompts.length,
        lowPriorityCount: lowPriorityPrompts.length,
        topCompetitors: topComps,
        topDomains,
        tavilyInsights
      });
      if (result) setAiInsights(result);
    } catch (err) {
      console.error("Error generating AI insights:", err);
    } finally {
      setGeneratingAiInsights(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Overall Status Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-xl shadow-lg",
              overallPriority === 'high' ? "bg-gradient-to-br from-red-500 to-rose-600" :
                overallPriority === 'medium' ? "bg-gradient-to-br from-amber-500 to-orange-600" :
                  "bg-gradient-to-br from-green-500 to-emerald-600"
            )}>
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Visibility Insights</h2>
              <p className="text-sm text-gray-500">Aggregated analysis across {filteredAuditResults.length} audited prompts</p>
            </div>
          </div>
          <div className={cn(
            "px-4 py-2 rounded-full font-semibold text-sm",
            overallPriority === 'high' ? "bg-red-100 text-red-700" :
              overallPriority === 'medium' ? "bg-amber-100 text-amber-700" :
                "bg-green-100 text-green-700"
          )}>
            Priority: {overallPriority.toUpperCase()}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{overallSov}%</div>
            <div className="text-sm font-medium text-blue-600 mt-1">Avg Visibility</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-700">{highPriorityPrompts.length}</div>
            <div className="text-sm font-medium text-red-600 mt-1">Critical</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-700">{mediumPriorityPrompts.length}</div>
            <div className="text-sm font-medium text-amber-600 mt-1">Needs Work</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{lowPriorityPrompts.length}</div>
            <div className="text-sm font-medium text-green-600 mt-1">Good</div>
          </div>
        </div>
      </div>

      {/* AI-Powered Pinpoint Recommendations */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">

                AI-Powered Pinpoint Insights
              </h3>
              <p className="text-sm text-gray-500 mt-1">Strategic recommendations using Advanced AI + aggregated data</p>
            </div>
            <Button
              onClick={handleGenerateAiInsights}
              disabled={generatingAiInsights || filteredAuditResults.length === 0}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md"
            >
              {generatingAiInsights ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {generatingAiInsights ? "Generating..." : aiInsights ? "Refresh" : "Generate AI Insights"}
            </Button>
          </div>
        </div>
        <div className="p-5">
          {aiInsights ? (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">Executive Summary</span>
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-semibold",
                    aiInsights?.priority === 'high' ? "bg-red-100 text-red-700" :
                      aiInsights?.priority === 'medium' ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                  )}>{aiInsights?.priority?.toUpperCase() || 'N/A'}</span>
                </div>
                <p className="text-sm text-gray-700">{aiInsights?.summary || 'No summary available'}</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-purple-600" /> Strategic Recommendations</h4>
                {(aiInsights?.recommendations || []).map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100 hover:border-purple-200 transition-colors">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-gray-700">{rec}</p>
                  </div>
                ))}
              </div>

              {aiInsights?.keyActions && aiInsights.keyActions.length > 0 && (
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Target className="h-4 w-4 text-green-600" /> Key Actions</h4>
                  {aiInsights.keyActions.map((action, idx) => (
                    <p key={idx} className="text-sm text-gray-700 flex items-center gap-2 mb-1">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" /> {action}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Lightbulb className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900">Get AI-Powered Insights</h4>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                Click "Generate AI Insights" to get strategic, pinpoint recommendations combining your audit data with Groq AI analysis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Aggregated Recommendations */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            Top Recommendations
          </h3>
          <p className="text-sm text-gray-500 mt-1">Actionable insights aggregated from all audits</p>
        </div>
        <div className="p-5 space-y-3">
          {aggregatedRecommendations.length > 0 ? aggregatedRecommendations.map((rec, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-amber-200 transition-colors">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {idx + 1}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
            </div>
          )) : (
            <div className="text-center py-8 text-gray-500">
              <Lightbulb className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>Run audits to generate insights</p>
            </div>
          )}
        </div>
      </div>

      {/* Priority Breakdown */}
      {highPriorityPrompts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-red-50 to-rose-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Critical Visibility Gaps ({highPriorityPrompts.length})
            </h3>
            <p className="text-sm text-gray-500 mt-1">Prompts with &lt;30% visibility requiring immediate attention</p>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {highPriorityPrompts.slice(0, 10).map((result, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-red-50/50 rounded-lg border border-red-100 hover:bg-red-50 transition-colors cursor-pointer" onClick={() => setSelectedPromptDetail(result.prompt_id)}>
                <span className="text-sm text-gray-800 flex-1 truncate pr-4">{result.prompt_text}</span>
                <span className="text-sm font-semibold text-red-700 flex-shrink-0">{result.summary?.share_of_voice || 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsTab;
