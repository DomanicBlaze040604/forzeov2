import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, Play, Plus, Trash2, Clock, BarChart3, Edit } from 'lucide-react';
import { toast } from 'sonner';
import AccountSelector from './scheduler/AccountSelector';
import PromptSelector from './scheduler/PromptSelector';
import ExecutionMonitor from './scheduler/ExecutionMonitor';
import ConditionalRulesEditor, { ConditionalRule } from './scheduler/ConditionalRulesEditor';
import AnalyticsDashboard from './scheduler/AnalyticsDashboard';
import { localTimeToUTC, utcToLocalTime, formatInTimezone } from '@/utils/timezone';
import { AI_MODELS } from '@/hooks/useClientDashboard';

interface Client {
  id: string;
  brand_name: string;
  industry?: string;
  target_region?: string;
  logo_url?: string;
}

interface MultiAccountSchedulerProps {
  clients: Client[];
  selectedModels: string[];
}

interface ScheduleForm {
  name: string;
  selectedClientIds: string[];
  promptSelectionType: 'all' | 'category' | 'custom';
  selectedCategories: string[];
  selectedPromptIds: string[];
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly';
  models: string[];
  concurrencyLimit: number;
  notifyOnCompletion: boolean;
  conditionalRules: ConditionalRule[];
}

interface Schedule {
  id: string;
  name: string;
  client_ids: string[];
  prompt_selection_type: string;
  selected_categories: string[] | null;
  models: string[];
  recurrence_type: string;
  next_run_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ScheduleRun {
  id: string;
  schedule_id: string;
  status: string;
  total_brands: number;
  completed_brands: number;
  failed_brands: number;
  total_prompts: number;
  prompts_completed: number;
  started_at: string;
  completed_at: string | null;
  prompt_schedules?: { name: string };
}

export default function MultiAccountScheduler({
  clients,
  selectedModels,
}: MultiAccountSchedulerProps) {
  const [activeTab, setActiveTab] = useState('create');
  const [currentStep, setCurrentStep] = useState(1);
  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleRuns, setScheduleRuns] = useState<ScheduleRun[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const [form, setForm] = useState<ScheduleForm>({
    name: '',
    selectedClientIds: [],
    promptSelectionType: 'all',
    selectedCategories: [],
    selectedPromptIds: [],
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Default to user's browser timezone
    recurrence: 'once',
    models: selectedModels.length > 0 ? selectedModels : ['gemini-2.0-flash', 'gpt-4o-mini'],
    concurrencyLimit: 3,
    notifyOnCompletion: true,
    conditionalRules: [],
  });

  // Fetch prompt counts for all clients
  useEffect(() => {
    fetchPromptCounts();
  }, [clients]);

  // Fetch existing schedules
  useEffect(() => {
    if (activeTab === 'active') {
      fetchSchedules();
    } else if (activeTab === 'history') {
      fetchScheduleRuns();
    }
  }, [activeTab]);

  const fetchPromptCounts = async () => {
    try {
      const counts: Record<string, number> = {};

      for (const client of clients) {
        const { count } = await supabase
          .from('prompts')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('is_active', true);

        counts[client.id] = count || 0;
      }

      setPromptCounts(counts);
    } catch (error) {
      console.error('Failed to fetch prompt counts:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('prompt_schedules')
        .select('*')
        .not('client_ids', 'is', null) // Only multi-account schedules
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      toast.error('Failed to load schedules');
    }
  };

  const fetchScheduleRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('schedule_runs')
        .select('*, prompt_schedules(name)')
        .not('client_ids', 'is', null) // Only multi-account runs
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setScheduleRuns(data || []);
    } catch (error) {
      console.error('Failed to fetch schedule runs:', error);
      toast.error('Failed to load execution history');
    }
  };

  const createSchedule = async () => {
    try {
      // Validation
      if (!form.name.trim()) {
        toast.error('Please enter a schedule name');
        return;
      }

      if (form.selectedClientIds.length === 0) {
        toast.error('Please select at least one brand');
        return;
      }

      if (form.models.length === 0) {
        toast.error('Please select at least one model');
        return;
      }

      // Prepare schedule data
      // Map recurrence to interval (for backward compatibility with existing scheduler)
      // Note: Database has check constraint that interval_value must be > 0
      const intervalMapping = {
        once: { value: 999, unit: 'days' as const }, // Large value for one-time (won't actually repeat due to recurrence_type)
        daily: { value: 1, unit: 'days' as const },
        weekly: { value: 7, unit: 'days' as const },
        monthly: { value: 30, unit: 'days' as const },
      };

      const interval = intervalMapping[form.recurrence];

      // Convert scheduled time from selected timezone to UTC for storage
      // Use Intl API for DST-aware timezone conversion
      const next_run_at = localTimeToUTC(form.scheduledDate, form.scheduledTime, form.timezone);

      console.log('[MultiAccountScheduler] Timezone conversion:', {
        selected_timezone: form.timezone,
        local_time: `${form.scheduledDate} ${form.scheduledTime}`,
        utc_time: next_run_at,
      });

      const scheduleData = {
        name: form.name,
        client_ids: form.selectedClientIds,
        prompt_selection_type: form.promptSelectionType,
        selected_categories: form.selectedCategories.length > 0 ? form.selectedCategories : null,
        selected_prompt_ids: form.selectedPromptIds.length > 0 ? form.selectedPromptIds : null,
        models: form.models,
        interval_value: interval.value, // Required by original schema
        interval_unit: interval.unit, // Required by original schema
        recurrence_type: form.recurrence,
        timezone: form.timezone, // Store timezone for scheduler to use
        concurrency_limit: form.concurrencyLimit,
        notify_on_completion: form.notifyOnCompletion,
        conditional_rules: form.conditionalRules.length > 0 ? form.conditionalRules : null,
        is_active: true,
        next_run_at: next_run_at, // Converted to UTC from selected timezone
      };

      console.log('[MultiAccountScheduler] Saving schedule with data:', scheduleData);

      let data, error;

      if (editingScheduleId) {
        // Update existing schedule
        const result = await supabase
          .from('prompt_schedules')
          .update(scheduleData)
          .eq('id', editingScheduleId)
          .select()
          .single();

        data = result.data;
        error = result.error;

        if (!error) {
          console.log('[MultiAccountScheduler] Schedule updated successfully:', data);
          toast.success(`Schedule updated: ${form.name}`);
        }
      } else {
        // Create new schedule
        const result = await supabase
          .from('prompt_schedules')
          .insert(scheduleData)
          .select()
          .single();

        data = result.data;
        error = result.error;

        if (!error) {
          console.log('[MultiAccountScheduler] Schedule created successfully:', data);
          toast.success(`Schedule created: ${form.name}`);
        }
      }

      if (error) {
        console.error('[MultiAccountScheduler] Database error:', error);
        throw error;
      }

      // Reset form
      setForm({
        name: '',
        selectedClientIds: [],
        promptSelectionType: 'all',
        selectedCategories: [],
        selectedPromptIds: [],
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '09:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Default to user's browser timezone
        recurrence: 'once',
        models: selectedModels.length > 0 ? selectedModels : ['gemini-2.0-flash', 'gpt-4o-mini'],
        concurrencyLimit: 3,
        notifyOnCompletion: true,
        conditionalRules: [],
      });

      setEditingScheduleId(null); // Clear editing state
      setCurrentStep(1);
      setActiveTab('active');
      fetchSchedules();
    } catch (error: any) {
      console.error('[MultiAccountScheduler] Failed to create schedule:', error);
      console.error('[MultiAccountScheduler] Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      toast.error(`Failed to create schedule: ${error?.message || 'Unknown error'}`);
    }
  };

  const runScheduleNow = async (scheduleId: string, scheduleName: string) => {
    if (runningScheduleId) return; // Prevent concurrent executions
    setRunningScheduleId(scheduleId);
    try {
      // Fetch schedule data
      const { data: schedule, error: scheduleError } = await supabase
        .from('prompt_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !schedule) {
        throw new Error('Schedule not found');
      }

      toast.info(`Starting execution: ${scheduleName}`);

      // Invoke multi-account-runner edge function
      const { data, error } = await supabase.functions.invoke('multi-account-runner', {
        body: {
          schedule: schedule,
          force: true, // Skip conditional rules when running manually
        },
      });

      if (error) throw error;

      if (data?.run_id) {
        toast.success(`Execution started for ${scheduleName}`);
        setCurrentRunId(data.run_id);
        setActiveTab('monitor');
      } else {
        toast.warning('Execution was skipped due to conditional rules');
      }
    } catch (error: any) {
      console.error('Failed to run schedule:', error);
      toast.error(`Failed to start execution: ${error?.message || 'Unknown error'}`);
    } finally {
      setRunningScheduleId(null);
    }
  };

  const editSchedule = async (schedule: Schedule) => {
    try {
      const timezone = (schedule as any).timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Convert UTC time back to local time for display using DST-aware conversion
      const localTime = schedule.next_run_at
        ? utcToLocalTime(schedule.next_run_at, timezone)
        : { date: new Date().toISOString().split('T')[0], time: '09:00' };

      setForm({
        name: schedule.name,
        selectedClientIds: schedule.client_ids,
        promptSelectionType: schedule.prompt_selection_type as any,
        selectedCategories: schedule.selected_categories || [],
        selectedPromptIds: [],
        scheduledDate: localTime.date,
        scheduledTime: localTime.time,
        timezone: timezone,
        recurrence: schedule.recurrence_type as any,
        models: schedule.models,
        concurrencyLimit: (schedule as any).concurrency_limit || 3,
        notifyOnCompletion: true,
        conditionalRules: [],
      });

      setEditingScheduleId(schedule.id);
      setCurrentStep(1);
      setActiveTab('create');
      toast.info(`Editing schedule: ${schedule.name}`);
    } catch (error) {
      console.error('Failed to load schedule for editing:', error);
      toast.error('Failed to load schedule');
    }
  };

  const deleteSchedule = async (scheduleId: string, scheduleName: string) => {
    if (!confirm(`Delete schedule "${scheduleName}"?`)) return;

    try {
      const { error } = await supabase
        .from('prompt_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      toast.success(`Deleted schedule: ${scheduleName}`);
      fetchSchedules();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const toggleScheduleActive = async (scheduleId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('prompt_schedules')
        .update({ is_active: !currentActive })
        .eq('id', scheduleId);

      if (error) throw error;

      toast.success(currentActive ? 'Schedule paused' : 'Schedule activated');
      fetchSchedules();
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'completed_with_errors':
        return <Badge className="bg-yellow-600">Completed with Errors</Badge>;
      case 'running':
        return <Badge className="bg-blue-600 animate-pulse">Running</Badge>;
      case 'failed':
        return <Badge className="bg-red-600">Failed</Badge>;
      case 'skipped':
        return <Badge variant="outline">Skipped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Multi-Account Scheduler</h2>
        <p className="text-gray-600 mt-1">
          Schedule and run prompts across multiple brands automatically
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create">
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </TabsTrigger>
          <TabsTrigger value="active">
            <Clock className="h-4 w-4 mr-2" />
            Active Schedules
          </TabsTrigger>
          <TabsTrigger value="history">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Execution History
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          {currentRunId && (
            <TabsTrigger value="monitor">
              <Play className="h-4 w-4 mr-2" />
              Monitor
            </TabsTrigger>
          )}
        </TabsList>

        {/* CREATE SCHEDULE TAB */}
        <TabsContent value="create" className="space-y-6">
          {/* Wizard Steps */}
          <div className="flex items-center justify-center gap-4">
            {[1, 2, 3, 4].map(step => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                <span
                  className={`ml-2 text-sm ${
                    currentStep >= step ? 'text-blue-600 font-medium' : 'text-gray-500'
                  }`}
                >
                  {step === 1 && 'Brands'}
                  {step === 2 && 'Prompts'}
                  {step === 3 && 'Schedule'}
                  {step === 4 && 'Review'}
                </span>
                {step < 4 && <div className="w-12 h-0.5 bg-gray-200 mx-2" />}
              </div>
            ))}
          </div>

          {/* Step 1: Select Brands */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Select Brands</CardTitle>
                <CardDescription>
                  Choose which brand accounts to include in this schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccountSelector
                  clients={clients}
                  selectedClientIds={form.selectedClientIds}
                  onSelectionChange={(ids) => setForm({ ...form, selectedClientIds: ids })}
                  promptCounts={promptCounts}
                />
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={form.selectedClientIds.length === 0}
                  >
                    Next: Select Prompts
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Prompts */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Select Prompts</CardTitle>
                <CardDescription>
                  Choose which prompts to run for the selected brands
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PromptSelector
                  selectedClientIds={form.selectedClientIds}
                  selectionType={form.promptSelectionType}
                  selectedCategories={form.selectedCategories}
                  selectedPromptIds={form.selectedPromptIds}
                  onSelectionTypeChange={(type) =>
                    setForm({ ...form, promptSelectionType: type })
                  }
                  onCategoriesChange={(cats) => setForm({ ...form, selectedCategories: cats })}
                  onPromptIdsChange={(ids) => setForm({ ...form, selectedPromptIds: ids })}
                />
                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep(3)}>Next: Set Schedule</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Set Schedule */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3: Set Schedule</CardTitle>
                <CardDescription>Configure when and how the prompts should run</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="schedule-name">Schedule Name *</Label>
                  <Input
                    id="schedule-name"
                    placeholder="e.g., Daily Priority Brand Audit"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="scheduled-date">Date</Label>
                    <Input
                      id="scheduled-date"
                      type="date"
                      value={form.scheduledDate}
                      onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="scheduled-time">Time</Label>
                    <Input
                      id="scheduled-time"
                      type="time"
                      value={form.scheduledTime}
                      onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="recurrence">Recurrence</Label>
                  <Select
                    value={form.recurrence}
                    onValueChange={(value: any) => setForm({ ...form, recurrence: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">One Time</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(value: string) => setForm({ ...form, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                      <SelectItem value="America/New_York">US Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">US Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">US Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">US Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">UK Time (GMT/BST)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                      <SelectItem value="Asia/Dubai">Dubai Time (GST)</SelectItem>
                      <SelectItem value="Asia/Singapore">Singapore Time (SGT)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan Time (JST)</SelectItem>
                      <SelectItem value="Australia/Sydney">Australian Eastern Time (AEDT)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    The schedule will run at the specified time in this timezone
                  </p>
                </div>

                <div>
                  <Label htmlFor="concurrency">Concurrency Limit</Label>
                  <Input
                    id="concurrency"
                    type="number"
                    min="1"
                    max="10"
                    value={form.concurrencyLimit}
                    onChange={(e) =>
                      setForm({ ...form, concurrencyLimit: parseInt(e.target.value) })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of brands to process in parallel (recommended: 3)
                  </p>
                </div>

                <div>
                  <Label className="mb-2 block">AI Models</Label>
                  <p className="text-xs text-gray-500 mb-3">
                    Select which models to run. At least one must be selected.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {AI_MODELS.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
                      >
                        <Checkbox
                          id={`model-${model.id}`}
                          checked={form.models.includes(model.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setForm({ ...form, models: [...form.models, model.id] });
                            } else {
                              if (form.models.length > 1) {
                                setForm({ ...form, models: form.models.filter(m => m !== model.id) });
                              }
                            }
                          }}
                        />
                        <Label htmlFor={`model-${model.id}`} className="flex-1 cursor-pointer">
                          <span className="text-sm font-medium">{model.name}</span>
                        </Label>
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: model.color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify"
                    checked={form.notifyOnCompletion}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, notifyOnCompletion: checked as boolean })
                    }
                  />
                  <Label htmlFor="notify" className="cursor-pointer">
                    Send notification when execution completes
                  </Label>
                </div>

                {/* Conditional Rules */}
                <div className="mt-6">
                  <ConditionalRulesEditor
                    rules={form.conditionalRules}
                    onRulesChange={(rules) => setForm({ ...form, conditionalRules: rules })}
                  />
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep(4)} disabled={!form.name}>
                    Next: Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 4: Review & Create</CardTitle>
                <CardDescription>Review your schedule configuration before creating</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div>
                    <strong>Name:</strong> {form.name}
                  </div>
                  <div>
                    <strong>Brands:</strong> {form.selectedClientIds.length} selected
                  </div>
                  <div>
                    <strong>Prompts:</strong> {form.promptSelectionType}
                    {form.promptSelectionType === 'category' &&
                      ` (${form.selectedCategories.length} categories)`}
                  </div>
                  <div>
                    <strong>Schedule:</strong> {form.scheduledDate} at {form.scheduledTime} {form.timezone.split('/').pop()} ({form.recurrence})
                  </div>
                  <div>
                    <strong>Concurrency:</strong> {form.concurrencyLimit} brands in parallel
                  </div>
                  <div>
                    <strong>Models:</strong>{' '}
                    {form.models
                      .map(id => AI_MODELS.find(m => m.id === id)?.name || id)
                      .join(', ')}
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    Back
                  </Button>
                  <Button onClick={createSchedule}>
                    {editingScheduleId ? 'Update Schedule' : 'Create Schedule'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ACTIVE SCHEDULES TAB */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Schedules</CardTitle>
              <CardDescription>Manage your scheduled multi-account executions</CardDescription>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No schedules created yet. Create your first schedule in the "Create Schedule" tab.
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{schedule.name}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {schedule.client_ids.length} brands •{' '}
                          {schedule.prompt_selection_type} prompts •{' '}
                          {schedule.recurrence_type}
                          {schedule.next_run_at && (
                            <span> • Next run: {formatInTimezone(schedule.next_run_at, (schedule as any).timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                          {schedule.is_active ? 'Active' : 'Paused'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runScheduleNow(schedule.id, schedule.name)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Run Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleScheduleActive(schedule.id, schedule.is_active)}
                        >
                          {schedule.is_active ? 'Pause' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editSchedule(schedule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteSchedule(schedule.id, schedule.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXECUTION HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>View past multi-account executions</CardDescription>
            </CardHeader>
            <CardContent>
              {scheduleRuns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No execution history yet
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduleRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {run.prompt_schedules?.name || 'Unnamed Schedule'}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {run.completed_brands}/{run.total_brands} brands •{' '}
                          {run.prompts_completed}/{run.total_prompts} prompts •{' '}
                          Started: {new Date(run.started_at).toLocaleString()}
                          {run.completed_at &&
                            ` • Duration: ${Math.ceil(
                              (new Date(run.completed_at).getTime() -
                                new Date(run.started_at).getTime()) /
                                60000
                            )}m`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(run.status)}
                        {run.status === 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCurrentRunId(run.id);
                              setActiveTab('monitor');
                            }}
                          >
                            View Progress
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <AnalyticsDashboard scheduleIds={schedules.map(s => s.id)} />
        </TabsContent>

        {/* EXECUTION MONITOR TAB */}
        {currentRunId && (
          <TabsContent value="monitor">
            <ExecutionMonitor
              runId={currentRunId}
              onCancel={() => {
                setCurrentRunId(null);
                setActiveTab('history');
                fetchScheduleRuns();
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
