/**
 * ============================================================================
 * SIGNALS DASHBOARD COMPONENT
 * ============================================================================
 * 
 * Dashboard for Fresh Signal Intelligence system:
 * - Recommendations panel (prioritized)
 * - Fresh signals timeline
 * - RSS feed management
 * - Correlation insights
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
    Rss, Sparkles, AlertTriangle, TrendingUp, ExternalLink,
    Plus, Trash2, RefreshCw, Clock, CheckCircle, XCircle,
    Lightbulb, Target, Building2, ChevronRight, Loader2
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface RSSFeed {
    id: string;
    name: string;
    rss_url: string;
    feed_type: string;
    topic: string | null;
    is_active: boolean;
    last_polled_at: string | null;
    last_poll_status: string | null;
    items_fetched_total: number;
}

interface FreshSignal {
    id: string;
    url: string;
    title: string;
    source_domain: string;
    published_at: string | null;
    discovered_at: string;
    brand_mentions: string[];
    competitor_mentions: string[];
    content_type: string;
    influence_score: number;
    processing_status: string;
}

interface Recommendation {
    id: string;
    recommendation_type: string;
    priority: string;
    title: string;
    description: string;
    evidence: string;
    action_items: string[];
    urgency_days: number;
    source_domain: string;
    source_url: string;
    is_read: boolean;
    is_dismissed: boolean;
    is_actioned: boolean;
    created_at: string;
}

interface SignalsDashboardProps {
    clientId: string;
    brandName: string;
}

// ============================================
// PRIORITY COLORS
// ============================================

const PRIORITY_STYLES = {
    critical: { bg: "bg-red-100", text: "text-red-700", badge: "bg-red-500" },
    high: { bg: "bg-orange-100", text: "text-orange-700", badge: "bg-orange-500" },
    medium: { bg: "bg-yellow-100", text: "text-yellow-700", badge: "bg-yellow-500" },
    low: { bg: "bg-gray-100", text: "text-gray-600", badge: "bg-gray-400" },
};

const TYPE_ICONS = {
    content_opportunity: Lightbulb,
    competitor_alert: Building2,
    visibility_gap: Target,
    source_emerging: TrendingUp,
};

// ============================================
// MAIN COMPONENT
// ============================================

export function SignalsDashboard({ clientId }: SignalsDashboardProps) {
    const [activeTab, setActiveTab] = useState<"recommendations" | "signals" | "feeds">("recommendations");
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [signals, setSignals] = useState<FreshSignal[]>([]);
    const [feeds, setFeeds] = useState<RSSFeed[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Feed dialog
    const [showAddFeed, setShowAddFeed] = useState(false);
    const [newFeed, setNewFeed] = useState({ name: "", rss_url: "", topic: "" });

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch recommendations
            const { data: recsData } = await supabase
                .from("recommendations")
                .select("*")
                .eq("client_id", clientId)
                .eq("is_dismissed", false)
                .order("priority", { ascending: true })
                .order("created_at", { ascending: false })
                .limit(20);

            setRecommendations(recsData || []);

            // Fetch signals
            const { data: signalsData } = await supabase
                .from("fresh_signals")
                .select("*")
                .eq("client_id", clientId)
                .order("discovered_at", { ascending: false })
                .limit(50);

            setSignals(signalsData || []);

            // Fetch feeds
            const { data: feedsData } = await supabase
                .from("rss_feeds")
                .select("*")
                .eq("client_id", clientId)
                .order("created_at", { ascending: false });

            setFeeds(feedsData || []);

        } catch (err) {
            console.error("[SignalsDashboard] Fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Add RSS feed
    const handleAddFeed = async () => {
        if (!newFeed.name || !newFeed.rss_url) return;

        try {
            const { error } = await supabase.from("rss_feeds").insert({
                client_id: clientId,
                name: newFeed.name,
                rss_url: newFeed.rss_url,
                topic: newFeed.topic || null,
                feed_type: newFeed.rss_url.includes("google.com/alerts") ? "google_alert" : "custom",
            });

            if (!error) {
                setShowAddFeed(false);
                setNewFeed({ name: "", rss_url: "", topic: "" });
                fetchData();
            }
        } catch (err) {
            console.error("[SignalsDashboard] Add feed error:", err);
        }
    };

    // Delete feed
    const handleDeleteFeed = async (feedId: string) => {
        try {
            await supabase.from("rss_feeds").delete().eq("id", feedId);
            fetchData();
        } catch (err) {
            console.error("[SignalsDashboard] Delete feed error:", err);
        }
    };

    // Poll feeds now
    const handlePollNow = async () => {
        setProcessing(true);
        try {
            await supabase.functions.invoke("rss-ingestor", {});
            // Also run scorer
            await supabase.functions.invoke("signal-scorer", {});
            fetchData();
        } catch (err) {
            console.error("[SignalsDashboard] Poll error:", err);
        } finally {
            setProcessing(false);
        }
    };

    // Dismiss recommendation
    const handleDismiss = async (recId: string) => {
        await supabase.from("recommendations").update({
            is_dismissed: true,
            dismissed_at: new Date().toISOString(),
        }).eq("id", recId);
        setRecommendations(prev => prev.filter(r => r.id !== recId));
    };

    // Mark recommendation as actioned
    const handleAction = async (recId: string) => {
        await supabase.from("recommendations").update({
            is_actioned: true,
            actioned_at: new Date().toISOString(),
        }).eq("id", recId);
        setRecommendations(prev => prev.map(r =>
            r.id === recId ? { ...r, is_actioned: true } : r
        ));
    };

    const unreadCount = recommendations.filter(r => !r.is_read).length;
    const highPriorityCount = recommendations.filter(r =>
        ["critical", "high"].includes(r.priority) && !r.is_actioned
    ).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Fresh Signal Intelligence</h2>
                    <p className="text-sm text-gray-500">Detect emerging content that may influence AI visibility</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={handlePollNow} disabled={processing}>
                        {processing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Scan Now
                    </Button>
                    <Button onClick={() => setShowAddFeed(true)} className="bg-gray-900 hover:bg-gray-800">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Feed
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-purple-50 to-white">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-purple-600 uppercase">Recommendations</p>
                                <p className="text-2xl font-bold text-purple-900">{recommendations.length}</p>
                            </div>
                            <Lightbulb className="h-8 w-8 text-purple-400" />
                        </div>
                        {highPriorityCount > 0 && (
                            <p className="text-xs text-purple-600 mt-2">{highPriorityCount} high priority</p>
                        )}
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-blue-600 uppercase">Fresh Signals</p>
                                <p className="text-2xl font-bold text-blue-900">{signals.length}</p>
                            </div>
                            <Sparkles className="h-8 w-8 text-blue-400" />
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                            {signals.filter(s => s.influence_score >= 0.6).length} high influence
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-white">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-green-600 uppercase">Active Feeds</p>
                                <p className="text-2xl font-bold text-green-900">{feeds.filter(f => f.is_active).length}</p>
                            </div>
                            <Rss className="h-8 w-8 text-green-400" />
                        </div>
                        <p className="text-xs text-green-600 mt-2">{feeds.length} total feeds</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-white">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-orange-600 uppercase">Competitor Alerts</p>
                                <p className="text-2xl font-bold text-orange-900">
                                    {signals.filter(s => s.competitor_mentions.length > 0).length}
                                </p>
                            </div>
                            <Building2 className="h-8 w-8 text-orange-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setActiveTab("recommendations")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "recommendations" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    Recommendations
                    {unreadCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-500 text-white rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("signals")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "signals" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    Fresh Signals
                </button>
                <button
                    onClick={() => setActiveTab("feeds")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "feeds" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    RSS Feeds
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <>
                    {/* Recommendations Tab */}
                    {activeTab === "recommendations" && (
                        <div className="space-y-4">
                            {recommendations.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <Lightbulb className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                        <h3 className="font-medium text-gray-700 mb-2">No Recommendations Yet</h3>
                                        <p className="text-sm text-gray-500">
                                            Add RSS feeds and we'll generate actionable insights as we detect fresh content.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                recommendations.map(rec => {
                                    const style = PRIORITY_STYLES[rec.priority as keyof typeof PRIORITY_STYLES] || PRIORITY_STYLES.medium;
                                    const Icon = TYPE_ICONS[rec.recommendation_type as keyof typeof TYPE_ICONS] || Lightbulb;

                                    return (
                                        <Card key={rec.id} className={`${rec.is_actioned ? "opacity-60" : ""}`}>
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-2 rounded-lg ${style.bg}`}>
                                                        <Icon className={`h-5 w-5 ${style.text}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white ${style.badge}`}>
                                                                {rec.priority}
                                                            </span>
                                                            {rec.urgency_days && (
                                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    Act within {rec.urgency_days} days
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="font-medium text-gray-900 mb-1">{rec.title}</h4>
                                                        <p className="text-sm text-gray-600 mb-2">{rec.description}</p>

                                                        {rec.evidence && (
                                                            <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mb-3">
                                                                {rec.evidence}
                                                            </p>
                                                        )}

                                                        {rec.action_items && rec.action_items.length > 0 && (
                                                            <ul className="text-sm text-gray-700 space-y-1 mb-3">
                                                                {rec.action_items.map((item, i) => (
                                                                    <li key={i} className="flex items-start gap-2">
                                                                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                                                        {item}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}

                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={rec.source_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                            >
                                                                {rec.source_domain}
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {!rec.is_actioned && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleAction(rec.id)}
                                                                className="text-green-600 border-green-200 hover:bg-green-50"
                                                            >
                                                                <CheckCircle className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDismiss(rec.id)}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Signals Tab */}
                    {activeTab === "signals" && (
                        <div className="space-y-3">
                            {signals.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                        <h3 className="font-medium text-gray-700 mb-2">No Signals Detected</h3>
                                        <p className="text-sm text-gray-500">
                                            Add RSS feeds (like Google Alerts) to start detecting fresh content.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                signals.map(signal => (
                                    <Card key={signal.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {signal.content_type}
                                                        </Badge>
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${signal.influence_score >= 0.7 ? "bg-green-100 text-green-700" :
                                                            signal.influence_score >= 0.5 ? "bg-yellow-100 text-yellow-700" :
                                                                "bg-gray-100 text-gray-600"
                                                            }`}>
                                                            {(signal.influence_score * 100).toFixed(0)}% influence
                                                        </span>
                                                        {signal.brand_mentions.length > 0 && (
                                                            <Badge className="bg-blue-500 text-[10px]">
                                                                Brand mentioned
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <a
                                                        href={signal.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                                                    >
                                                        {signal.title}
                                                    </a>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                        <span>{signal.source_domain}</span>
                                                        <span>•</span>
                                                        <span>{signal.published_at ? new Date(signal.published_at).toLocaleDateString() : "Unknown date"}</span>
                                                        {signal.competitor_mentions.length > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-orange-600">
                                                                    Competitors: {signal.competitor_mentions.join(", ")}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <a
                                                    href={signal.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    <ExternalLink className="h-4 w-4 text-gray-400" />
                                                </a>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}

                    {/* Feeds Tab */}
                    {activeTab === "feeds" && (
                        <div className="space-y-4">
                            {feeds.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <Rss className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                        <h3 className="font-medium text-gray-700 mb-2">No RSS Feeds</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Add Google Alerts or other RSS feeds to monitor fresh content.
                                        </p>
                                        <Button onClick={() => setShowAddFeed(true)}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Your First Feed
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {feeds.map(feed => (
                                        <Card key={feed.id}>
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-lg ${feed.is_active ? "bg-green-100" : "bg-gray-100"}`}>
                                                            <Rss className={`h-4 w-4 ${feed.is_active ? "text-green-600" : "text-gray-400"}`} />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium text-gray-900">{feed.name}</h4>
                                                            {feed.topic && (
                                                                <p className="text-xs text-gray-500">{feed.topic}</p>
                                                            )}
                                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                                                <span className="flex items-center gap-1">
                                                                    {feed.last_poll_status === "success" ? (
                                                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                                                    ) : feed.last_poll_status === "error" ? (
                                                                        <AlertTriangle className="h-3 w-3 text-red-500" />
                                                                    ) : (
                                                                        <Clock className="h-3 w-3" />
                                                                    )}
                                                                    {feed.last_polled_at
                                                                        ? new Date(feed.last_polled_at).toLocaleString()
                                                                        : "Never polled"
                                                                    }
                                                                </span>
                                                                <span>{feed.items_fetched_total} items</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteFeed(feed.id)}
                                                        className="text-gray-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Add Feed Dialog */}
            <Dialog open={showAddFeed} onOpenChange={setShowAddFeed}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add RSS Feed</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Feed Name</Label>
                            <Input
                                value={newFeed.name}
                                onChange={(e) => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Dating Apps India Alert"
                            />
                        </div>
                        <div>
                            <Label>RSS URL</Label>
                            <Input
                                value={newFeed.rss_url}
                                onChange={(e) => setNewFeed(prev => ({ ...prev, rss_url: e.target.value }))}
                                placeholder="paste Google Alerts RSS URL"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Get this from Google Alerts → Create Alert → Deliver to: RSS feed
                            </p>
                        </div>
                        <div>
                            <Label>Topic (optional)</Label>
                            <Input
                                value={newFeed.topic}
                                onChange={(e) => setNewFeed(prev => ({ ...prev, topic: e.target.value }))}
                                placeholder="e.g., Best dating apps in India"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Used for Tavily correlation and recommendations
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddFeed(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddFeed} disabled={!newFeed.name || !newFeed.rss_url}>
                            Add Feed
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default SignalsDashboard;
