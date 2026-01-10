
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, ChevronRight, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Campaign {
    id: string;
    name: string;
    status: string;
    created_at: string;
    total_prompts: number;
    completed_prompts: number;
    avg_sov: number | null;
    avg_rank: number | null;
    total_citations: number | null;
}

interface CampaignsListProps {
    clientId: string;
    onSelectCampaign: (campaignId: string) => void;
}

export function CampaignsList({ clientId, onSelectCampaign }: CampaignsListProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCampaigns();
    }, [clientId]);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("campaigns")
                .select("*")
                .eq("client_id", clientId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setCampaigns(data || []);
        } catch (err) {
            console.error("Error fetching campaigns:", err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed": return "bg-green-100 text-green-700";
            case "running": return "bg-blue-100 text-blue-700";
            case "error": return "bg-red-100 text-red-700";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Campaign Runs</h2>
                    <p className="text-sm text-gray-500">Track batched audits and historical performance.</p>
                </div>
                {/* <Button onClick={() => {}}>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    New Campaign
                </Button> */}
            </div>

            {campaigns.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="font-medium text-gray-700 mb-2">No Campaigns Yet</h3>
                        <p className="text-sm text-gray-500">
                            Run a batch of prompts from the Generator to create your first campaign.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {campaigns.map((campaign) => (
                        <Card
                            key={campaign.id}
                            className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500"
                            onClick={() => onSelectCampaign(campaign.id)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-lg text-gray-900">{campaign.name}</h3>
                                            <Badge variant="secondary" className={getStatusColor(campaign.status)}>
                                                {campaign.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(campaign.created_at).toLocaleDateString()}
                                            </span>
                                            <span>•</span>
                                            <span>{campaign.completed_prompts} / {campaign.total_prompts} Prompts</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-medium">Avg SOV</p>
                                            <p className={`text-xl font-bold ${(campaign.avg_sov || 0) > 50 ? 'text-green-600' :
                                                (campaign.avg_sov || 0) > 20 ? 'text-blue-600' : 'text-gray-900'
                                                }`}>
                                                {campaign.avg_sov ? `${campaign.avg_sov.toFixed(1)}%` : '-'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-medium">Avg Rank</p>
                                            <p className="text-xl font-bold text-gray-900">
                                                {campaign.avg_rank ? `#${campaign.avg_rank.toFixed(1)}` : '-'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-medium">Citations</p>
                                            <p className="text-xl font-bold text-gray-900">
                                                {campaign.total_citations || 0}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-300" />
                                    </div>
                                </div>

                                {/* Progress Bar if running */}
                                {campaign.status === 'running' && (
                                    <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-500"
                                            style={{ width: `${(campaign.completed_prompts / (campaign.total_prompts || 1)) * 100}%` }}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
