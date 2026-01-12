/**
 * ============================================================================
 * CITATION INTELLIGENCE COMPONENT
 * ============================================================================
 * 
 * Dashboard for Citation-Level Brand & Competitor Intelligence Engine.
 * Using available UI components only (Button, Card, Badge, Dialog, Textarea).
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    Brain,
    AlertTriangle,
    CheckCircle,
    XCircle,
    MessageSquare,
    Newspaper,
    Loader2,
    RefreshCw,
    Copy,
    ExternalLink,
    Sparkles,
    TrendingUp,
    Target,
    Zap
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface CitationIntelligenceData {
    id: string;
    url: string;
    domain: string;
    title: string | null;
    model: string | null;
    is_reachable: boolean | null;
    http_status: number | null;
    is_hallucinated: boolean;
    hallucination_type: string | null;
    hallucination_reason: string | null;
    citation_category: string;
    subcategory: string | null;
    opportunity_level: string;
    brand_mentioned_in_source: boolean;
    ai_analysis: object;
    analysis_status: string;
    created_at: string;
}

interface CitationRecommendation {
    id: string;
    citation_intelligence_id: string;
    recommendation_type: string;
    priority: string;
    title: string;
    description: string | null;
    generated_content: string | null;
    content_type: string | null;
    action_items: string[];
    estimated_effort: string | null;
    is_actioned: boolean;
    created_at: string;
}

interface IntelligenceSummary {
    total_analyzed: number;
    hallucinated: number;
    verified: number;
    categories: {
        ugc: number;
        competitor_blog: number;
        press_media: number;
        app_store: number;
        wikipedia: number;
        other: number;
    };
    opportunities: {
        easy: number;
        medium: number;
        difficult: number;
    };
    recommendations: {
        total: number;
        pending: number;
    };
}

interface CitationIntelligenceProps {
    clientId: string;
    brandName: string;
    competitors?: string[];
}

// ============================================
// CATEGORY CONFIG
// ============================================

const CATEGORY_CONFIG: Record<string, {
    label: string;
    color: string;
    bgColor: string;
}> = {
    ugc: { label: "UGC / Social", color: "text-blue-600", bgColor: "bg-blue-50" },
    competitor_blog: { label: "Competitor", color: "text-orange-600", bgColor: "bg-orange-50" },
    press_media: { label: "Press & Media", color: "text-purple-600", bgColor: "bg-purple-50" },
    app_store: { label: "App Stores", color: "text-green-600", bgColor: "bg-green-50" },
    wikipedia: { label: "Wikipedia", color: "text-gray-600", bgColor: "bg-gray-50" },
    brand_owned: { label: "Brand Owned", color: "text-emerald-600", bgColor: "bg-emerald-50" },
    other: { label: "Other", color: "text-slate-600", bgColor: "bg-slate-50" }
};

const PRIORITY_COLORS: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500"
};

// ============================================
// TABS COMPONENT (Custom implementation)
// ============================================

type TabId = "overview" | "ugc" | "competitor" | "press" | "recommendations";

const TabButton = ({
    label,
    active,
    onClick,
    badge
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    badge?: number;
}) => (
    <button
        onClick={onClick}
        className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-all",
            active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
        )}
    >
        {label}
        {badge !== undefined && badge > 0 && (
            <span className={cn(
                "ml-2 px-1.5 py-0.5 text-xs rounded",
                active ? "bg-white/20 text-white" : "bg-red-100 text-red-600"
            )}>
                {badge}
            </span>
        )}
    </button>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function CitationIntelligence({
    clientId,
    brandName,
    competitors = []
}: CitationIntelligenceProps) {
    // State
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [summary, setSummary] = useState<IntelligenceSummary | null>(null);
    const [intelligence, setIntelligence] = useState<CitationIntelligenceData[]>([]);
    const [recommendations, setRecommendations] = useState<CitationRecommendation[]>([]);
    const [selectedTab, setSelectedTab] = useState<TabId>("overview");
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Content generation state
    const [generatingContent, setGeneratingContent] = useState<string | null>(null);
    const [contentDialog, setContentDialog] = useState<{
        open: boolean;
        recommendation: CitationRecommendation | null;
        content: string;
    }>({ open: false, recommendation: null, content: "" });

    // Show message temporarily
    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    // ============================================
    // DATA FETCHING
    // ============================================

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch intelligence data
            const { data: intelligenceData, error: intError } = await supabase
                .from('citation_intelligence')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });

            if (intError) throw intError;
            setIntelligence(intelligenceData || []);

            // Fetch recommendations
            const { data: recData, error: recError } = await supabase
                .from('citation_recommendations')
                .select('*')
                .eq('client_id', clientId)
                .order('priority', { ascending: true });

            if (recError) throw recError;
            setRecommendations(recData || []);

            // Calculate summary
            if (intelligenceData) {
                const cats = intelligenceData.reduce((acc, item) => {
                    acc[item.citation_category] = (acc[item.citation_category] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const opps = intelligenceData.reduce((acc, item) => {
                    const level = item.opportunity_level || 'medium';
                    acc[level] = (acc[level] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                setSummary({
                    total_analyzed: intelligenceData.length,
                    hallucinated: intelligenceData.filter(i => i.is_hallucinated).length,
                    verified: intelligenceData.filter(i => i.is_reachable).length,
                    categories: {
                        ugc: cats.ugc || 0,
                        competitor_blog: cats.competitor_blog || 0,
                        press_media: cats.press_media || 0,
                        app_store: cats.app_store || 0,
                        wikipedia: cats.wikipedia || 0,
                        other: (cats.other || 0) + (cats.brand_owned || 0)
                    },
                    opportunities: {
                        easy: opps.easy || 0,
                        medium: opps.medium || 0,
                        difficult: opps.difficult || 0
                    },
                    recommendations: {
                        total: recData?.length || 0,
                        pending: recData?.filter(r => !r.is_actioned).length || 0
                    }
                });
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            showMessage('error', 'Failed to fetch citation intelligence data');
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ============================================
    // ANALYSIS FUNCTIONS
    // ============================================

    const analyzeAllCitations = async () => {
        setAnalyzing(true);

        try {
            // Get latest audit result
            const { data: audits } = await supabase
                .from('audit_results')
                .select('id')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!audits || audits.length === 0) {
                showMessage('error', 'Run an audit first to generate citations to analyze');
                setAnalyzing(false);
                return;
            }

            const auditResultId = audits[0].id;

            // Call the citation-analyzer edge function
            const { data, error } = await supabase.functions.invoke('citation-analyzer', {
                body: {
                    action: 'analyze',
                    client_id: clientId,
                    audit_result_id: auditResultId,
                    brand_name: brandName,
                    competitors: competitors,
                    analyze_all: true
                }
            });

            if (error) throw error;

            showMessage('success', `Analyzed ${data.summary?.total_analyzed || 0} citations, found ${data.summary?.hallucinated || 0} potential hallucinations`);
            await fetchData();

        } catch (error) {
            console.error("Analysis error:", error);
            showMessage('error', String(error));
        } finally {
            setAnalyzing(false);
        }
    };

    // ============================================
    // CONTENT GENERATION
    // ============================================

    const generateContent = async (recommendation: CitationRecommendation) => {
        setGeneratingContent(recommendation.id);

        try {
            const { data, error } = await supabase.functions.invoke('citation-analyzer', {
                body: {
                    action: 'generate_content',
                    content_type: recommendation.content_type,
                    recommendation_id: recommendation.id,
                    context: {
                        brandName: brandName,
                        competitors: competitors,
                        topic: recommendation.title
                    }
                }
            });

            if (error) throw error;

            setContentDialog({
                open: true,
                recommendation,
                content: data.content
            });

            setRecommendations(prev =>
                prev.map(r =>
                    r.id === recommendation.id
                        ? { ...r, generated_content: data.content }
                        : r
                )
            );

            showMessage('success', 'AI-generated content is ready!');

        } catch (error) {
            console.error("Content generation error:", error);
            showMessage('error', String(error));
        } finally {
            setGeneratingContent(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showMessage('success', 'Content copied to clipboard');
    };

    const markAsActioned = async (recommendationId: string) => {
        try {
            await supabase
                .from('citation_recommendations')
                .update({
                    is_actioned: true,
                    actioned_at: new Date().toISOString()
                })
                .eq('id', recommendationId);

            setRecommendations(prev =>
                prev.map(r =>
                    r.id === recommendationId ? { ...r, is_actioned: true } : r
                )
            );

            showMessage('success', 'Recommendation marked as actioned');
        } catch (error) {
            console.error("Error marking as actioned:", error);
        }
    };

    // ============================================
    // RENDER HELPERS
    // ============================================

    const renderCitationsTable = (category?: string) => {
        const filtered = category
            ? intelligence.filter(i => i.citation_category === category)
            : intelligence;

        if (filtered.length === 0) {
            return (
                <div className="text-center py-12 text-gray-500">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No citations in this category</p>
                    <p className="text-sm">Analyze citations to populate this view</p>
                </div>
            );
        }

        return (
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">URL</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Model</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Opportunity</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    {item.is_hallucinated ? (
                                        <div className="flex items-center gap-1">
                                            <XCircle className="w-4 h-4 text-red-500" />
                                            <span className="text-xs text-red-600">Hallucinated</span>
                                        </div>
                                    ) : item.is_reachable ? (
                                        <div className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-xs text-green-600">Verified</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                            <span className="text-xs text-yellow-600">Unknown</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 max-w-xs">
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        {item.domain}
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                    {item.title && (
                                        <p className="text-xs text-gray-500 truncate">{item.title}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn("text-sm", CATEGORY_CONFIG[item.citation_category]?.color)}>
                                        {CATEGORY_CONFIG[item.citation_category]?.label || item.citation_category}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant="outline" className="text-xs">{item.model || "Unknown"}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "px-2 py-1 text-xs rounded-full",
                                        item.opportunity_level === 'easy' ? 'bg-green-100 text-green-700' :
                                            item.opportunity_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                    )}>
                                        {item.opportunity_level === 'easy' ? 'Easy Win' :
                                            item.opportunity_level === 'medium' ? 'Medium' : 'Difficult'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button size="sm" variant="ghost" onClick={() => window.open(item.url, '_blank')}>
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <div className="space-y-6">
            {/* Message Banner */}
            {message && (
                <div className={cn(
                    "p-3 rounded-lg flex items-center gap-2 animate-in fade-in",
                    message.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                )}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Brain className="w-6 h-6 text-blue-600" />
                        Citation Intelligence
                    </h2>
                    <p className="text-gray-500">AI-powered analysis of citation sources with actionable recommendations</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button onClick={analyzeAllCitations} disabled={analyzing}>
                        {analyzing ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                        ) : (
                            <><Brain className="w-4 h-4 mr-2" />Analyze Citations</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Analyzing Progress */}
            {analyzing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <div>
                        <p className="font-medium text-blue-900">Analyzing citations with AI...</p>
                        <p className="text-sm text-blue-700">Verifying URLs, detecting hallucinations, classifying sources</p>
                    </div>
                </div>
            )}

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Citations Analyzed</p>
                                <p className="text-3xl font-bold">{summary?.total_analyzed || 0}</p>
                            </div>
                            <Brain className="w-8 h-8 text-blue-600 opacity-20" />
                        </div>
                    </CardContent>
                </Card>

                <Card className={summary?.hallucinated ? "border-red-200 bg-red-50/50" : ""}>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Hallucinated</p>
                                <p className="text-3xl font-bold text-red-600">{summary?.hallucinated || 0}</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Verified</p>
                                <p className="text-3xl font-bold text-green-600">{summary?.verified || 0}</p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50/50">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Actionable</p>
                                <p className="text-3xl font-bold text-purple-600">{summary?.recommendations.pending || 0}</p>
                            </div>
                            <Zap className="w-8 h-8 text-purple-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-fit">
                <TabButton label="Overview" active={selectedTab === "overview"} onClick={() => setSelectedTab("overview")} />
                <TabButton label={`UGC (${summary?.categories.ugc || 0})`} active={selectedTab === "ugc"} onClick={() => setSelectedTab("ugc")} />
                <TabButton label={`Competitor (${summary?.categories.competitor_blog || 0})`} active={selectedTab === "competitor"} onClick={() => setSelectedTab("competitor")} />
                <TabButton label={`Press (${summary?.categories.press_media || 0})`} active={selectedTab === "press"} onClick={() => setSelectedTab("press")} />
                <TabButton label="Recommendations" active={selectedTab === "recommendations"} onClick={() => setSelectedTab("recommendations")} badge={summary?.recommendations.pending} />
            </div>

            {/* Tab Content */}
            {selectedTab === "overview" && (
                <div className="space-y-6">
                    {/* Category Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                Citation Categories
                            </CardTitle>
                            <CardDescription>Distribution by source type and opportunity level</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {Object.entries(CATEGORY_CONFIG).slice(0, 5).map(([key, config]) => {
                                    const count = summary?.categories[key as keyof typeof summary.categories] || 0;
                                    return (
                                        <div key={key} className={cn("p-4 rounded-lg border", config.bgColor)}>
                                            <p className={cn("font-medium text-sm", config.color)}>{config.label}</p>
                                            <p className="text-2xl font-bold mt-1">{count}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Opportunity Level Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Target className="w-5 h-5" />
                                Opportunity Levels
                            </CardTitle>
                            <CardDescription>How easy it is to action these citations</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 rounded-lg border bg-green-50 border-green-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <p className="font-semibold text-green-700">Easy Wins</p>
                                    </div>
                                    <p className="text-3xl font-bold text-green-600">{summary?.opportunities.easy || 0}</p>
                                    <p className="text-xs text-green-600 mt-1">UGC, Forums, Competitor blogs</p>
                                </div>
                                <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                        <p className="font-semibold text-yellow-700">Medium Effort</p>
                                    </div>
                                    <p className="text-3xl font-bold text-yellow-600">{summary?.opportunities.medium || 0}</p>
                                    <p className="text-xs text-yellow-600 mt-1">Press, App stores</p>
                                </div>
                                <div className="p-4 rounded-lg border bg-red-50 border-red-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="w-5 h-5 text-red-600" />
                                        <p className="font-semibold text-red-700">Difficult</p>
                                    </div>
                                    <p className="text-3xl font-bold text-red-600">{summary?.opportunities.difficult || 0}</p>
                                    <p className="text-xs text-red-600 mt-1">Wikipedia (advisory only)</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Priority Recommendations Preview */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Sparkles className="w-5 h-5" />
                                    Priority Recommendations
                                </CardTitle>
                                <CardDescription>{summary?.recommendations.pending || 0} pending actions</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setSelectedTab("recommendations")}>View All</Button>
                        </CardHeader>
                        <CardContent>
                            {recommendations.filter(r => !r.is_actioned).length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>No pending recommendations</p>
                                    <p className="text-sm">Analyze citations to generate recommendations</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recommendations.filter(r => !r.is_actioned).slice(0, 5).map(rec => (
                                        <div key={rec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-2 h-8 rounded-full", PRIORITY_COLORS[rec.priority])} />
                                                <div>
                                                    <p className="font-medium text-sm">{rec.title}</p>
                                                    <p className="text-xs text-gray-500">{rec.recommendation_type.replace(/_/g, ' ')} • {rec.estimated_effort}</p>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="ghost" onClick={() => generateContent(rec)} disabled={generatingContent === rec.id}>
                                                {generatingContent === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {selectedTab === "ugc" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                            User-Generated Content
                        </CardTitle>
                        <CardDescription>Social media discussions, forums, and review sites</CardDescription>
                    </CardHeader>
                    <CardContent>{renderCitationsTable('ugc')}</CardContent>
                </Card>
            )}

            {selectedTab === "competitor" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-orange-600" />
                            Competitor Content
                        </CardTitle>
                        <CardDescription>Competitor pages cited by AI - opportunities to create counter-content</CardDescription>
                    </CardHeader>
                    <CardContent>{renderCitationsTable('competitor_blog')}</CardContent>
                </Card>
            )}

            {selectedTab === "press" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Newspaper className="w-5 h-5 text-purple-600" />
                            Press & Media
                        </CardTitle>
                        <CardDescription>News and editorial sources - targets for press releases</CardDescription>
                    </CardHeader>
                    <CardContent>{renderCitationsTable('press_media')}</CardContent>
                </Card>
            )}

            {selectedTab === "recommendations" && (
                <div className="space-y-4">
                    {recommendations.filter(r => !r.is_actioned).length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p className="text-gray-500">No pending recommendations</p>
                                <p className="text-sm text-gray-400">Analyze citations to generate AI-powered recommendations</p>
                            </CardContent>
                        </Card>
                    ) : (
                        recommendations.filter(r => !r.is_actioned).map(rec => (
                            <Card key={rec.id} className="overflow-hidden">
                                <div className={cn("h-1", PRIORITY_COLORS[rec.priority])} />
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-base">{rec.title}</CardTitle>
                                            <CardDescription className="mt-1">{rec.description}</CardDescription>
                                        </div>
                                        <Badge className={cn(PRIORITY_COLORS[rec.priority], "text-white")}>{rec.priority}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {rec.action_items && rec.action_items.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium mb-2">Action Steps:</p>
                                                <ul className="space-y-1">
                                                    {rec.action_items.map((item, idx) => (
                                                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                                            <span className="text-blue-500">•</span>{item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {rec.generated_content && (
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-blue-500" />
                                                    AI-Generated Content
                                                </p>
                                                <p className="text-sm text-gray-600 line-clamp-3">{rec.generated_content}</p>
                                                <Button size="sm" variant="link" className="p-0 mt-2" onClick={() => setContentDialog({ open: true, recommendation: rec, content: rec.generated_content || "" })}>
                                                    View Full Content
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-2 border-t">
                                            <div className="text-xs text-gray-500">
                                                Effort: {rec.estimated_effort} • Type: {rec.content_type?.replace(/_/g, ' ')}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => generateContent(rec)} disabled={generatingContent === rec.id}>
                                                    {generatingContent === rec.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                                                    {rec.generated_content ? 'Regenerate' : 'Generate Content'}
                                                </Button>
                                                <Button size="sm" onClick={() => markAsActioned(rec.id)}>
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Mark Done
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Content Dialog */}
            <Dialog open={contentDialog.open} onOpenChange={(open) => setContentDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-500" />
                            Generated Content
                        </DialogTitle>
                        <DialogDescription>
                            {contentDialog.recommendation?.content_type?.replace(/_/g, ' ')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Textarea
                            value={contentDialog.content}
                            onChange={(e) => setContentDialog(prev => ({ ...prev, content: e.target.value }))}
                            className="min-h-[300px] font-mono text-sm"
                        />

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => copyToClipboard(contentDialog.content)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                            </Button>
                            {contentDialog.recommendation && (
                                <Button onClick={() => {
                                    markAsActioned(contentDialog.recommendation!.id);
                                    setContentDialog(prev => ({ ...prev, open: false }));
                                }}>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Use & Mark Done
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
