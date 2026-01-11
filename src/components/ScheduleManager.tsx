/**
 * ============================================================================
 * SCHEDULE MANAGER COMPONENT
 * ============================================================================
 * 
 * UI for managing auto-run schedules:
 * - Create new schedules with custom intervals
 * - View active schedules with next run time
 * - Enable/disable toggle
 * - Edit/delete schedules
 * - Run now button
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Clock, Play, Trash2, Edit2, RefreshCw, Calendar, Zap } from "lucide-react";
import { Prompt } from "@/hooks/useClientDashboard";

// ============================================
// TYPES
// ============================================

interface Schedule {
    id: string;
    client_id: string;
    prompt_id: string | null;
    name: string;
    interval_value: number;
    interval_unit: "seconds" | "minutes" | "hours" | "days";
    is_active: boolean;
    include_tavily: boolean;
    models: string[];
    last_run_at: string | null;
    next_run_at: string | null;
    total_runs: number;
    created_at: string;
}

interface ScheduleManagerProps {
    clientId: string;
    prompts: Prompt[];
    selectedModels: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatInterval(value: number, unit: string): string {
    if (value === 1) {
        return `Every ${unit.slice(0, -1)}`;
    }
    return `Every ${value} ${unit}`;
}

function formatTimeUntil(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return "Overdue";

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `in ${days}d ${hours % 24}h`;
    if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `in ${minutes}m ${seconds % 60}s`;
    return `in ${seconds}s`;
}

function calculateNextRun(intervalValue: number, intervalUnit: string): Date {
    const now = new Date();
    let ms = 0;

    switch (intervalUnit) {
        case "seconds": ms = intervalValue * 1000; break;
        case "minutes": ms = intervalValue * 60 * 1000; break;
        case "hours": ms = intervalValue * 60 * 60 * 1000; break;
        case "days": ms = intervalValue * 24 * 60 * 60 * 1000; break;
    }

    return new Date(now.getTime() + ms);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ScheduleManager({ clientId, prompts, selectedModels }: ScheduleManagerProps) {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);
    const [, setTick] = useState(0);

    // Form state
    const [formName, setFormName] = useState("");
    const [formPromptId, setFormPromptId] = useState<string>("");
    const [formIntervalValue, setFormIntervalValue] = useState(30);
    const [formIntervalUnit, setFormIntervalUnit] = useState<"seconds" | "minutes" | "hours" | "days">("minutes");
    const [formIncludeTavily, setFormIncludeTavily] = useState(true);

    // Fetch schedules
    const fetchSchedules = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("prompt_schedules")
                .select("*")
                .eq("client_id", clientId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setSchedules(data || []);
        } catch (err) {
            console.error("[ScheduleManager] Error:", err);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchSchedules();

        // Refresh next_run_at display every second
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [fetchSchedules]);

    // Reset form
    const resetForm = () => {
        setFormName("");
        setFormPromptId("");
        setFormIntervalValue(30);
        setFormIntervalUnit("minutes");
        setFormIncludeTavily(true);
        setEditingSchedule(null);
    };

    // Create/Edit schedule
    const handleSave = async () => {
        if (!formName.trim()) return;

        const prompt = prompts.find(p => p.id === formPromptId);
        const nextRun = calculateNextRun(formIntervalValue, formIntervalUnit);

        const scheduleData = {
            client_id: clientId,
            prompt_id: formPromptId || null,
            name: formName.trim() || prompt?.prompt_text?.substring(0, 50) || "Unnamed Schedule",
            interval_value: formIntervalValue,
            interval_unit: formIntervalUnit,
            include_tavily: formIncludeTavily,
            models: selectedModels,
            is_active: true,
            next_run_at: nextRun.toISOString(),
        };

        try {
            if (editingSchedule) {
                await supabase
                    .from("prompt_schedules")
                    .update(scheduleData)
                    .eq("id", editingSchedule.id);
            } else {
                await supabase
                    .from("prompt_schedules")
                    .insert(scheduleData);
            }

            fetchSchedules();
            setShowCreateDialog(false);
            resetForm();
        } catch (err) {
            console.error("[ScheduleManager] Save error:", err);
        }
    };

    // Toggle active
    const toggleActive = async (schedule: Schedule) => {
        try {
            const nextRun = schedule.is_active ? null : calculateNextRun(schedule.interval_value, schedule.interval_unit);

            await supabase
                .from("prompt_schedules")
                .update({
                    is_active: !schedule.is_active,
                    next_run_at: nextRun?.toISOString() || null,
                })
                .eq("id", schedule.id);

            fetchSchedules();
        } catch (err) {
            console.error("[ScheduleManager] Toggle error:", err);
        }
    };

    // Delete schedule
    const handleDelete = async (scheduleId: string) => {
        if (!confirm("Delete this schedule? Run history will be preserved.")) return;

        try {
            await supabase
                .from("prompt_schedules")
                .delete()
                .eq("id", scheduleId);

            fetchSchedules();
        } catch (err) {
            console.error("[ScheduleManager] Delete error:", err);
        }
    };

    // Run now
    const handleRunNow = async (schedule: Schedule) => {
        setRunningScheduleId(schedule.id);
        try {
            const { error } = await supabase.functions.invoke("scheduler", {
                body: { schedule_id: schedule.id, force: true },
            });
            if (error) throw error;
            fetchSchedules();
        } catch (err) {
            console.error("[ScheduleManager] Run error:", err);
        } finally {
            setRunningScheduleId(null);
        }
    };

    // Edit schedule
    const handleEdit = (schedule: Schedule) => {
        setFormName(schedule.name);
        setFormPromptId(schedule.prompt_id || "");
        setFormIntervalValue(schedule.interval_value);
        setFormIntervalUnit(schedule.interval_unit);
        setFormIncludeTavily(schedule.include_tavily);
        setEditingSchedule(schedule);
        setShowCreateDialog(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Auto-Run Schedules</h2>
                    <p className="text-sm text-gray-500">Automate prompt audits at regular intervals</p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Schedule
                </Button>
            </div>

            {/* Schedules List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : schedules.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-gray-400">
                            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-gray-600 mb-2">No schedules yet</h3>
                            <p className="text-sm mb-4">Create a schedule to automatically run prompts at regular intervals</p>
                            <Button onClick={() => setShowCreateDialog(true)} variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Schedule
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {schedules.map((schedule) => {
                        const prompt = prompts.find(p => p.id === schedule.prompt_id);
                        const nextRunDate = schedule.next_run_at ? new Date(schedule.next_run_at) : null;
                        const isOverdue = nextRunDate && nextRunDate.getTime() < Date.now();

                        return (
                            <Card key={schedule.id} className={schedule.is_active ? "" : "opacity-60"}>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Active Toggle */}
                                            <Switch
                                                checked={schedule.is_active}
                                                onCheckedChange={() => toggleActive(schedule)}
                                            />

                                            {/* Info */}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                                                    {schedule.include_tavily && (
                                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                                            <Zap className="h-3 w-3 mr-1" />
                                                            Tavily
                                                        </Badge>
                                                    )}
                                                </div>
                                                {prompt && (
                                                    <p className="text-sm text-gray-500 truncate max-w-md">{prompt.prompt_text}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            {/* Interval */}
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-gray-600">
                                                    {formatInterval(schedule.interval_value, schedule.interval_unit)}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {schedule.total_runs} runs total
                                                </div>
                                            </div>

                                            {/* Next Run */}
                                            {schedule.is_active && nextRunDate && (
                                                <div className="text-right min-w-[100px]">
                                                    <div className={`text-sm font-medium ${isOverdue ? "text-orange-600" : "text-gray-600"}`}>
                                                        {formatTimeUntil(nextRunDate)}
                                                    </div>
                                                    <div className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                                                        <Calendar className="h-3 w-3" />
                                                        {nextRunDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRunNow(schedule)}
                                                    disabled={runningScheduleId === schedule.id}
                                                >
                                                    {runningScheduleId === schedule.id ? (
                                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Play className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(schedule)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(schedule.id)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingSchedule ? "Edit Schedule" : "Create Schedule"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Name */}
                        <div>
                            <Label htmlFor="name">Schedule Name</Label>
                            <Input
                                id="name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Daily Visibility Check"
                            />
                        </div>

                        {/* Prompt */}
                        <div>
                            <Label htmlFor="prompt">Prompt (Optional)</Label>
                            <Select value={formPromptId || "__none__"} onValueChange={(v) => setFormPromptId(v === "__none__" ? "" : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a prompt or use schedule name as query" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Use schedule name as query</SelectItem>
                                    {prompts.filter(p => p.is_active).map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.prompt_text.substring(0, 50)}...
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>


                        {/* Interval */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="interval">Run Every</Label>
                                <Input
                                    id="interval"
                                    type="number"
                                    min={1}
                                    value={formIntervalValue}
                                    onChange={(e) => setFormIntervalValue(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="unit">Unit</Label>
                                <Select value={formIntervalUnit} onValueChange={(v) => setFormIntervalUnit(v as typeof formIntervalUnit)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="seconds">Seconds</SelectItem>
                                        <SelectItem value="minutes">Minutes</SelectItem>
                                        <SelectItem value="hours">Hours</SelectItem>
                                        <SelectItem value="days">Days</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Tavily */}
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <Label>Include Tavily Search</Label>
                                <p className="text-sm text-gray-500">Get AI source analysis with each run</p>
                            </div>
                            <Switch
                                checked={formIncludeTavily}
                                onCheckedChange={setFormIncludeTavily}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!formName.trim()}>
                            {editingSchedule ? "Save Changes" : "Create Schedule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ScheduleManager;
