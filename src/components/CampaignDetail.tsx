
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, BarChart3, Layers, Globe, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Run {
    id: string;
    prompt_text: string;
    sov_score: number;
    rank_list: string[];
    citations_count: number;
    created_at: string;
}

interface CampaignDetailProps {
    campaignId: string;
    onBack: () => void;
}

export function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
    const [campaign, setCampaign] = useState<any>(null);
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDetails();
    }, [campaignId]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            // Get Campaign Info
            const { data: campaignData, error: campError } = await supabase
                .from("campaigns")
                .select("*")
                .eq("id", campaignId)
                .single();

            if (campError) throw campError;
            setCampaign(campaignData);

            // Get Associated Audit Results from audit_results table
            // Campaign prompts are saved directly to audit_results with campaign_id
            const { data: resultsData, error: resultsError } = await supabase
                .from("audit_results")
                .select("id, prompt_id, prompts(prompt_text), share_of_voice, average_rank, total_citations, created_at")
                .eq("campaign_id", campaignId)
                .order("created_at", { ascending: true });

            if (resultsError) {
                console.log("Error fetching audit results:", resultsError);
                // Try alternative: fetch from schedule_runs if audit_results fails
                const { data: runsData, error: runsError } = await supabase
                    .from("schedule_runs")
                    .select("*")
                    .eq("campaign_id", campaignId)
                    .order("created_at", { ascending: true });

                if (runsError) console.log("Error fetching runs:", runsError);
                setRuns(runsData || []);
            } else {
                // Map audit_results to Run interface
                const mappedRuns: Run[] = (resultsData || []).map(r => ({
                    id: r.id,
                    prompt_text: (r.prompts as any)?.prompt_text || "Unknown prompt",
                    sov_score: r.share_of_voice || 0,
                    rank_list: [],
                    citations_count: r.total_citations || 0,
                    created_at: r.created_at,
                }));
                setRuns(mappedRuns);
            }

        } catch (err) {
            console.error("Error fetching campaign details:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading details...</div>;
    if (!campaign) return <div>Campaign not found</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{campaign.name}</h2>
                    <p className="text-sm text-gray-500">
                        {new Date(campaign.created_at).toLocaleDateString()} • {runs.length} Prompts Analyzed
                    </p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline">
                        <ExternalLink className="h-4 w-4 mr-2" /> Export Report
                    </Button>
                </div>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-blue-600 uppercase tracking-wider">Avg SOV</p>
                                <p className="text-3xl font-bold text-blue-900 mt-2">
                                    {campaign.avg_sov ? `${Number(campaign.avg_sov).toFixed(1)}%` : '-'}
                                </p>
                            </div>
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-purple-600 uppercase tracking-wider">Avg Rank</p>
                                <p className="text-3xl font-bold text-purple-900 mt-2">
                                    {campaign.avg_rank ? `#${Number(campaign.avg_rank).toFixed(1)}` : '-'}
                                </p>
                            </div>
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-green-600 uppercase tracking-wider">Total Citations</p>
                                <p className="text-3xl font-bold text-green-900 mt-2">
                                    {campaign.total_citations || 0}
                                </p>
                            </div>
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Globe className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-gray-200">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Completion</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {Math.round((campaign.completed_prompts / (campaign.total_prompts || 1)) * 100)}%
                                </p>
                            </div>
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <Layers className="h-5 w-5 text-gray-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Prompt Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Prompt Performance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {runs.map((run, i) => (
                            <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-medium">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-900 max-w-xl truncate">{run.prompt_text}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                            <span>{new Date(run.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right w-20">
                                        <p className="text-xs text-gray-400">SOV</p>
                                        <p className={`font-bold ${(run.sov_score || 0) > 50 ? 'text-green-600' :
                                            (run.sov_score || 0) > 20 ? 'text-blue-600' : 'text-gray-900'
                                            }`}>
                                            {run.sov_score !== null ? `${run.sov_score}%` : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="text-right w-20">
                                        <p className="text-xs text-gray-400">Citations</p>
                                        <p className="font-bold text-gray-900">{run.citations_count || 0}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
