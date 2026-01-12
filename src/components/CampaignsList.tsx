
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Calendar, ChevronRight, BarChart3, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
    const [newName, setNewName] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

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

    const handleEdit = (campaign: Campaign, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCampaign(campaign);
        setNewName(campaign.name);
    };

    const handleDelete = (campaign: Campaign, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingCampaign(campaign);
    };

    const confirmEdit = async () => {
        if (!editingCampaign || !newName.trim()) return;
        setIsUpdating(true);

        try {
            const { error } = await supabase
                .from("campaigns")
                .update({ name: newName.trim() })
                .eq("id", editingCampaign.id);

            if (error) throw error;

            setCampaigns(prev =>
                prev.map(c => c.id === editingCampaign.id ? { ...c, name: newName.trim() } : c)
            );
            console.log(`Campaign renamed to "${newName.trim()}"`);
            setEditingCampaign(null);
        } catch (err) {
            console.error("Error updating campaign:", err);
            alert("Failed to rename campaign");
        } finally {
            setIsUpdating(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingCampaign) return;
        setIsUpdating(true);

        try {
            // Delete associated audit results first
            await supabase
                .from("audit_results")
                .delete()
                .eq("campaign_id", deletingCampaign.id);

            // Then delete the campaign
            const { error } = await supabase
                .from("campaigns")
                .delete()
                .eq("id", deletingCampaign.id);

            if (error) throw error;

            setCampaigns(prev => prev.filter(c => c.id !== deletingCampaign.id));
            console.log(`Campaign "${deletingCampaign.name}" deleted`);
            setDeletingCampaign(null);
        } catch (err) {
            console.error("Error deleting campaign:", err);
            alert("Failed to delete campaign");
        } finally {
            setIsUpdating(false);
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

                                    <div className="flex items-center gap-6">
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

                                        {/* Actions Menu */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => handleEdit(campaign, e as unknown as React.MouseEvent)}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={(e) => handleDelete(campaign, e as unknown as React.MouseEvent)}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

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

            {/* Edit Dialog */}
            <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Campaign</DialogTitle>
                        <DialogDescription>Enter a new name for this campaign.</DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Campaign name"
                        onKeyDown={(e) => e.key === "Enter" && confirmEdit()}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingCampaign(null)}>Cancel</Button>
                        <Button onClick={confirmEdit} disabled={isUpdating || !newName.trim()}>
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingCampaign} onOpenChange={() => setDeletingCampaign(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Campaign</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{deletingCampaign?.name}"? This will also delete all associated audit results. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingCampaign(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
