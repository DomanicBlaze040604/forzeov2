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
    Zap,
    Trash2,
    Download,
    ChevronUp,
    ChevronDown,
    Settings,
    Save,
    Grid,
    List,
    ArrowUpDown
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

type TabId = "overview" | "ugc" | "competitor" | "press" | "recommendations" | "all";

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
    const [opportunityFilter, setOpportunityFilter] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // New Configuration State
    const [analysisScope, setAnalysisScope] = useState<'latest' | '24h' | '7d' | 'all'>('latest');
    const [useDeepAnalysis, setUseDeepAnalysis] = useState(false);

    // Delete functionality state
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
    const [deleting, setDeleting] = useState(false);

    // Advanced filtering state
    const [filters, setFilters] = useState({
        category: 'all' as string,
        status: 'all' as 'all' | 'verified' | 'hallucinated' | 'unknown',
        model: 'all' as string,
        search: ''
    });

    // Personalization state
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [visibleColumns, setVisibleColumns] = useState({
        status: true,
        url: true,
        category: true,
        model: true,
        opportunity: true
    });
    const [savedPresets, setSavedPresets] = useState<Array<{ id: string; name: string; filters: typeof filters }>>([]);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

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
            console.log("Fetching intelligence for client:", clientId);
            const { data: intelligenceData, error: intError } = await supabase
                .from('citation_intelligence')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });

            console.log("Fetched intelligence data:", intelligenceData?.length, "records", intError);

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
                    audit_result_id: analysisScope === 'latest' ? auditResultId : undefined,
                    scope: analysisScope, // Pass the selected scope
                    use_tavily: useDeepAnalysis, // Pass the deep analysis flag
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
    // DELETE HANDLERS
    // ============================================

    const handleDeleteSelected = () => {
        const ids = Array.from(selectedRows);
        if (ids.length === 0) {
            showMessage('error', 'No items selected');
            return;
        }
        setDeleteDialog({ open: true, ids });
    };

    const handleDeleteSingle = (id: string) => {
        setDeleteDialog({ open: true, ids: [id] });
    };

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            const { error } = await supabase
                .from('citation_intelligence')
                .delete()
                .in('id', deleteDialog.ids);

            if (error) throw error;

            // Update local state
            setIntelligence(prev => prev.filter(i => !deleteDialog.ids.includes(i.id)));
            setSelectedRows(new Set());
            setDeleteDialog({ open: false, ids: [] });
            showMessage('success', `Deleted ${deleteDialog.ids.length} record(s)`);

            // Refresh data
            fetchData();
        } catch (error) {
            console.error("Delete error:", error);
            showMessage('error', 'Failed to delete records');
        } finally {
            setDeleting(false);
        }
    };

    const toggleRowSelection = (id: string) => {
        const newSet = new Set(selectedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedRows(newSet);
    };

    const toggleSelectAll = (filtered: CitationIntelligenceData[]) => {
        if (selectedRows.size === filtered.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filtered.map(i => i.id)));
        }
    };

    // ============================================
    // FILTER HELPERS
    // ============================================

    const applyFilters = (data: CitationIntelligenceData[]) => {
        let result = data;

        // Category filter
        if (filters.category !== 'all') {
            result = result.filter(i => i.citation_category === filters.category);
        }

        // Status filter
        if (filters.status !== 'all') {
            if (filters.status === 'verified') {
                result = result.filter(i => i.is_reachable);
            } else if (filters.status === 'hallucinated') {
                result = result.filter(i => i.is_hallucinated);
            } else if (filters.status === 'unknown') {
                result = result.filter(i => !i.is_reachable && !i.is_hallucinated);
            }
        }

        // Model filter
        if (filters.model !== 'all') {
            result = result.filter(i => i.model === filters.model);
        }

        // Search filter
        if (filters.search.trim()) {
            const search = filters.search.toLowerCase();
            result = result.filter(i =>
                i.url.toLowerCase().includes(search) ||
                i.domain.toLowerCase().includes(search) ||
                (i.title && i.title.toLowerCase().includes(search))
            );
        }

        return result;
    };

    const clearFilters = () => {
        setFilters({
            category: 'all',
            status: 'all',
            model: 'all',
            search: ''
        });
        setOpportunityFilter(null);
    };

    // ============================================
    // PERSONALIZATION HELPERS
    // ============================================

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1); // Reset to first page on sort
    };

    const applySorting = (data: CitationIntelligenceData[]) => {
        if (!sortConfig) return data;

        return [...data].sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof CitationIntelligenceData];
            let bValue: any = b[sortConfig.key as keyof CitationIntelligenceData];

            // Handle null/undefined
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            // String comparison
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = (bValue as string).toLowerCase();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const applyPagination = (data: CitationIntelligenceData[]) => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return data.slice(startIndex, endIndex);
    };

    const totalPages = (dataLength: number) => Math.ceil(dataLength / itemsPerPage);

    const saveFilterPreset = () => {
        const name = prompt('Enter a name for this filter preset:');
        if (!name) return;

        const newPreset = {
            id: Date.now().toString(),
            name,
            filters: { ...filters }
        };

        setSavedPresets(prev => [...prev, newPreset]);
        showMessage('success', `Preset "${name}" saved`);
    };

    const loadFilterPreset = (presetId: string) => {
        const preset = savedPresets.find(p => p.id === presetId);
        if (preset) {
            setFilters(preset.filters);
            showMessage('success', `Loaded preset "${preset.name}"`);
        }
    };

    const deleteFilterPreset = (presetId: string) => {
        setSavedPresets(prev => prev.filter(p => p.id !== presetId));
        showMessage('success', 'Preset deleted');
    };

    const toggleColumn = (column: keyof typeof visibleColumns) => {
        setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
    };

    // ============================================
    // EXPORT FUNCTION
    // ============================================

    const exportReport = () => {
        const timestamp = new Date().toLocaleString();
        const filtered = applyFilters(intelligence);

        const content = `
=====================================================
FORZEO CITATION INTELLIGENCE REPORT
=====================================================
Generated: ${timestamp}
Client ID: ${clientId}
Total Citations Analyzed: ${intelligence.length}
Filtered Results: ${filtered.length}

=====================================================
SUMMARY STATISTICS  
=====================================================

Verification Status:
  - Verified Sources: ${intelligence.filter(i => i.is_reachable).length} (${((intelligence.filter(i => i.is_reachable).length / intelligence.length) * 100).toFixed(1)}%)
  - Hallucinated URLs: ${intelligence.filter(i => i.is_hallucinated).length} (${((intelligence.filter(i => i.is_hallucinated).length / intelligence.length) * 100).toFixed(1)}%)
  - Unknown Status: ${intelligence.filter(i => !i.is_reachable && !i.is_hallucinated).length}

=====================================================
CITATION CATEGORIES
=====================================================

${Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = intelligence.filter(i => i.citation_category === key).length;
            if (count === 0) return '';
            return `  - ${config.label}: ${count} citations`;
        }).filter(Boolean).join('\n')}

=====================================================
OPPORTUNITY LEVELS
=====================================================

  - Easy Wins: ${intelligence.filter(i => i.opportunity_level === 'easy').length} citations
    (UGC forums, Competitor blogs - Direct response opportunities)
    
  - Medium Effort: ${intelligence.filter(i => i.opportunity_level === 'medium').length} citations
    (Press, App stores - Requires outreach/coordination)
    
  - Difficult: ${intelligence.filter(i => i.opportunity_level === 'difficult').length} citations
    (Wikipedia - High barriers to entry)

=====================================================
TOP RECOMMENDATIONS (${recommendations.length > 0 ? 'First 10' : 'None'})
=====================================================

${recommendations.slice(0, 10).map((rec, idx) => `
${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.title}
   Type: ${rec.recommendation_type.replace(/_/g, ' ')}
   Effort: ${rec.estimated_effort}
   ${(rec.description || '').substring(0, 200)}${rec.description && rec.description.length > 200 ? '...' : ''}
`).join('\n')}

=====================================================
DETAILED CITATION LIST
=====================================================

${filtered.map((item, idx) => `
${idx + 1}. ${item.domain}
   URL: ${item.url}
   Status: ${item.is_hallucinated ? '❌ Hallucinated' : item.is_reachable ? '✅ Verified' : '⚠️ Unknown'}
   Category: ${CATEGORY_CONFIG[item.citation_category]?.label || item.citation_category}
   Model: ${item.model || 'Unknown'}
   Opportunity: ${item.opportunity_level === 'easy' ? 'Easy Win' : item.opportunity_level === 'medium' ? 'Medium' : 'Difficult'}
   ${item.title ? `Title: ${item.title}` : ''}
`).join('\n')}

=====================================================
END OF REPORT
=====================================================
`;

        // Create download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `citation-intelligence-${clientId}-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showMessage('success', 'Report exported successfully');
    };

    // ============================================
    // RENDER HELPERS
    // ============================================

    const renderCitationsTable = (category?: string) => {
        let filtered = intelligence;

        // Apply category from tab
        if (category && category !== 'all') {
            filtered = filtered.filter(i => i.citation_category === category);
        }

        // Apply opportunity filter (from cards)
        if (opportunityFilter) {
            filtered = filtered.filter(i => i.opportunity_level === opportunityFilter);
        }

        // Apply advanced filters
        filtered = applyFilters(filtered);

        //Apply sorting
        filtered = applySorting(filtered);

        const hasActiveFilters = opportunityFilter || filters.category !== 'all' || filters.status !== 'all' ||
            filters.model !== 'all' || filters.search.trim() !== '';

        // Calculate pagination
        const totalPagesCount = totalPages(filtered.length);
        const paginatedData = applyPagination(filtered);

        if (filtered.length === 0) {
            return (
                <div className="text-center py-12 text-gray-500">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No citations found matching the criteria</p>
                    {hasActiveFilters && (
                        <Button variant="link" onClick={clearFilters} className="mt-2 text-blue-600">
                            Clear all filters
                        </Button>
                    )}
                </div>
            );
        }

        // Get unique models for filter dropdown
        const uniqueModels = Array.from(new Set(intelligence.map(i => i.model).filter(Boolean)));

        // Helper for sort icons
        const SortIcon = ({ column }: { column: string }) => {
            if (!sortConfig || sortConfig.key !== column) {
                return <ArrowUpDown className="w-3 h-3 opacity-30" />;
            }
            return sortConfig.direction === 'asc' ?
                <ChevronUp className="w-3 h-3" /> :
                <ChevronDown className="w-3 h-3" />;
        };

        return (
            <div className="space-y-4">
                {/* Toolbar with Settings */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-medium">
                            {filtered.length} citations
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Saved Presets Dropdown */}
                        {savedPresets.length > 0 && (
                            <select
                                value=""
                                onChange={(e) => e.target.value && loadFilterPreset(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Load Preset...</option>
                                {savedPresets.map(preset => (
                                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                                ))}
                            </select>
                        )}
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={saveFilterPreset}
                                className="flex items-center gap-1"
                            >
                                <Save className="w-3 h-3" />
                                Save Preset
                            </Button>
                        )}
                        {/* Column Toggle Dropdown */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const btn = document.getElementById('column-toggle-menu');
                                    btn?.classList.toggle('hidden');
                                }}
                                className="flex items-center gap-1"
                            >
                                <Settings className="w-3 h-3" />
                                Columns
                            </Button>
                            <div
                                id="column-toggle-menu"
                                className="hidden absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2"
                            >
                                {Object.entries(visibleColumns).map(([col, visible]) => (
                                    <label
                                        key={col}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={visible}
                                            onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-sm capitalize">{col}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                                Clear All
                            </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Category Filter */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
                            <select
                                value={filters.category}
                                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Categories</option>
                                <option value="ugc">UGC / Social</option>
                                <option value="competitor_blog">Competitor</option>
                                <option value="press_media">Press & Media</option>
                                <option value="app_store">App Stores</option>
                                <option value="wikipedia">Wikipedia</option>
                                <option value="brand_owned">Brand Owned</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="verified">Verified Only</option>
                                <option value="hallucinated">Hallucinated Only</option>
                                <option value="unknown">Unknown Status</option>
                            </select>
                        </div>

                        {/* Model Filter */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Model</label>
                            <select
                                value={filters.model}
                                onChange={(e) => setFilters(prev => ({ ...prev, model: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Models</option>
                                {uniqueModels.map(model => (
                                    <option key={model!} value={model!}>{model}</option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Search</label>
                            <input
                                type="text"
                                placeholder="Search URL, domain..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filter Badge */}
                {opportunityFilter && (
                    <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-blue-800 font-medium">
                            Opportunity: <span className="capitalize">{opportunityFilter.replace('_', ' ')} Effort</span>
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpportunityFilter(null)}
                            className="h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                        >
                            Clear
                        </Button>
                    </div>
                )}

                {/* Bulk Actions Bar */}
                {selectedRows.size > 0 && (
                    <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">
                            {selectedRows.size} item(s) selected
                        </span>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected
                        </Button>
                    </div>
                )}

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                            <tr>
                                <th className="text-left px-4 py-3 w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                                        onChange={() => toggleSelectAll(paginatedData)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </th>
                                {visibleColumns.status && (
                                    <th
                                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('is_reachable')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Status
                                            <SortIcon column="is_reachable" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.url && (
                                    <th
                                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('domain')}
                                    >
                                        <div className="flex items-center gap-1">
                                            URL
                                            <SortIcon column="domain" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.category && (
                                    <th
                                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('citation_category')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Category
                                            <SortIcon column="citation_category" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.model && (
                                    <th
                                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('model')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Model
                                            <SortIcon column="model" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.opportunity && (
                                    <th
                                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSort('opportunity_level')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Opportunity
                                            <SortIcon column="opportunity_level" />
                                        </div>
                                    </th>
                                )}
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {paginatedData.map((item, idx) => (
                                <tr
                                    key={item.id}
                                    className={cn(
                                        "hover:bg-gray-50 transition-colors",
                                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                                    )}
                                >
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedRows.has(item.id)}
                                            onChange={() => toggleRowSelection(item.id)}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                    </td>
                                    {visibleColumns.status && (
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
                                    )}
                                    {visibleColumns.url && (
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
                                    )}
                                    {visibleColumns.category && (
                                        <td className="px-4 py-3">
                                            <span className={cn("text-sm", CATEGORY_CONFIG[item.citation_category]?.color)}>
                                                {CATEGORY_CONFIG[item.citation_category]?.label || item.citation_category}
                                            </span>
                                        </td>
                                    )}
                                    {visibleColumns.model && (
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className="text-xs">{item.model || "Unknown"}</Badge>
                                        </td>
                                    )}
                                    {visibleColumns.opportunity && (
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "px-2 py-1 text-xs rounded-full font-medium",
                                                item.opportunity_level === 'easy' ? 'bg-green-100 text-green-700' :
                                                    item.opportunity_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                            )}>
                                                {item.opportunity_level === 'easy' ? 'Easy Win' :
                                                    item.opportunity_level === 'medium' ? 'Medium' : 'Difficult'}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => window.open(item.url, '_blank')}
                                                className="h-8 w-8 p-0"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeleteSingle(item.id)}
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPagesCount > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} results
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPagesCount) }, (_, i) => {
                                    let pageNum;
                                    if (totalPagesCount <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPagesCount - 2) {
                                        pageNum = totalPagesCount - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className="w-8 h-8 p-0"
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPagesCount, p + 1))}
                                disabled={currentPage === totalPagesCount}
                            >
                                Next
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Per page:</label>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                )}
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
                <div className="flex items-center gap-4">
                    {/* Analysis Controls */}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm mr-2">
                        <select
                            value={analysisScope}
                            onChange={(e) => setAnalysisScope(e.target.value as any)}
                            className="bg-transparent text-sm font-medium text-gray-600 border-none outline-none cursor-pointer hover:text-gray-900"
                        >
                            <option value="latest">Latest Run Only</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="all">All Time (Slow)</option>
                        </select>
                        <div className="h-4 w-px bg-gray-200" />
                        <button
                            onClick={() => setUseDeepAnalysis(!useDeepAnalysis)}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
                                useDeepAnalysis ? "bg-purple-100 text-purple-700" : "text-gray-500 hover:bg-gray-50"
                            )}
                            title="Uses 1 Discovery credit per citation for deep content analysis"
                        >
                            <span className={cn("w-2 h-2 rounded-full", useDeepAnalysis ? "bg-purple-500" : "bg-gray-300")} />
                            Deep Analysis
                        </button>
                    </div>

                    <Button
                        onClick={() => fetchData()}
                        variant="outline"
                        className="bg-white"
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button
                        onClick={exportReport}
                        variant="outline"
                        className="bg-white"
                        disabled={intelligence.length === 0}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export Report
                    </Button>
                    <Button
                        onClick={analyzeAllCitations}
                        disabled={analyzing}
                        className={cn("text-white shadow-lg shadow-blue-500/20", analyzing ? "bg-gray-700" : "bg-blue-600 hover:bg-blue-700")}
                    >
                        {analyzing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {useDeepAnalysis ? "Deep Analyzing..." : "Analyzing..."}
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                {useDeepAnalysis ? "Run Deep Analysis" : "Analyze Citations"}
                            </>
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
                <TabButton label="All Sources" active={selectedTab === "all"} onClick={() => setSelectedTab("all")} />
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
                                <div
                                    onClick={() => { setSelectedTab('all'); setOpportunityFilter('easy'); }}
                                    className="p-4 rounded-lg border bg-green-50 border-green-200 cursor-pointer hover:bg-green-100 transition-colors group"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform" />
                                        <p className="font-semibold text-green-700">Easy Wins</p>
                                    </div>
                                    <p className="text-3xl font-bold text-green-600">{summary?.opportunities.easy || 0}</p>
                                    <p className="text-xs text-green-600 mt-1">UGC, Forums, Competitor blogs</p>
                                </div>
                                <div
                                    onClick={() => { setSelectedTab('all'); setOpportunityFilter('medium'); }}
                                    className="p-4 rounded-lg border bg-yellow-50 border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors group"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-5 h-5 text-yellow-600 group-hover:scale-110 transition-transform" />
                                        <p className="font-semibold text-yellow-700">Medium Effort</p>
                                    </div>
                                    <p className="text-3xl font-bold text-yellow-600">{summary?.opportunities.medium || 0}</p>
                                    <p className="text-xs text-yellow-600 mt-1">Press, App stores</p>
                                </div>
                                <div
                                    onClick={() => { setSelectedTab('all'); setOpportunityFilter('difficult'); }}
                                    className="p-4 rounded-lg border bg-red-50 border-red-200 cursor-pointer hover:bg-red-100 transition-colors group"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" />
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

            {selectedTab === "all" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-gray-600" />
                            All Citations
                        </CardTitle>
                        <CardDescription>Comprehensive list of all analyzed sources</CardDescription>
                    </CardHeader>
                    <CardContent>{renderCitationsTable('all')}</CardContent>
                </Card>
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, ids: [] })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete {deleteDialog.ids.length} record(s)? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialog({ open: false, ids: [] })}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleting}
                            className="flex items-center gap-2"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
