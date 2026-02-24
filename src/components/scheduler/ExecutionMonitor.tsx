import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// Performance constant based on measured data
const AVERAGE_SECONDS_PER_PROMPT = 37; // 121 prompts = 70-77 min
const STALL_WARNING_THRESHOLD = 300_000; // 5 minutes (ms) without update = warning
const STALL_CRITICAL_THRESHOLD = 600_000; // 10 minutes (ms) without update = critical

interface ExecutionProgress {
  completedBrands: number;
  totalBrands: number;
  currentBrandId: string | null;
  promptsCompleted: number;
  totalPrompts: number;
  executionProgress: Record<string, BrandProgress>;
  status: string;
  startedAt: string | null;
}

interface BrandProgress {
  brand_name: string;
  total_prompts: number;
  completed_prompts: number;
  failed_prompts: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  prompts: PromptProgress[];
}

interface PromptProgress {
  id: string;
  prompt_text: string;
  status: 'completed' | 'failed' | 'running';
}

interface ExecutionMonitorProps {
  runId: string | null;
  onCancel?: () => void;
}

export default function ExecutionMonitor({ runId, onCancel }: ExecutionMonitorProps) {
  const [progress, setProgress] = useState<ExecutionProgress>({
    completedBrands: 0,
    totalBrands: 0,
    currentBrandId: null,
    promptsCompleted: 0,
    totalPrompts: 0,
    executionProgress: {},
    status: 'pending',
    startedAt: null,
  });
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [stallStatus, setStallStatus] = useState<'normal' | 'warning' | 'critical'>('normal');

  // Subscribe to real-time updates
  useEffect(() => {
    if (!runId) return;

    // Initial fetch
    fetchProgress();

    // Subscribe to changes
    const channel = supabase
      .channel(`schedule-run-${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schedule_runs',
          filter: `id=eq.${runId}`,
        },
        (payload: any) => {
          const newData = payload.new;
          setProgress({
            completedBrands: newData.completed_brands || 0,
            totalBrands: newData.total_brands || 0,
            currentBrandId: newData.current_brand_id,
            promptsCompleted: newData.prompts_completed || 0,
            totalPrompts: newData.total_prompts || 0,
            executionProgress: newData.execution_progress || {},
            status: newData.status,
            startedAt: newData.started_at,
          });

          // Reset stall detection
          setLastUpdateTime(Date.now());
          setStallStatus('normal');

          // Auto-expand currently running brand
          if (newData.current_brand_id) {
            setOpenBrands(prev => new Set([...prev, newData.current_brand_id]));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [runId]);

  // Stall detection - monitor for lack of updates
  useEffect(() => {
    if (!runId || progress.status !== 'running') return;

    const interval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;

      if (timeSinceLastUpdate > STALL_CRITICAL_THRESHOLD) {
        setStallStatus('critical');
      } else if (timeSinceLastUpdate > STALL_WARNING_THRESHOLD) {
        setStallStatus('warning');
      } else {
        setStallStatus('normal');
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [runId, progress.status, lastUpdateTime]);

  const fetchProgress = async () => {
    if (!runId) return;

    try {
      const { data, error } = await supabase
        .from('schedule_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (error) throw error;

      if (data) {
        setProgress({
          completedBrands: data.completed_brands || 0,
          totalBrands: data.total_brands || 0,
          currentBrandId: data.current_brand_id,
          promptsCompleted: data.prompts_completed || 0,
          totalPrompts: data.total_prompts || 0,
          executionProgress: data.execution_progress || {},
          status: data.status,
          startedAt: data.started_at,
        });
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
      toast.error('Failed to load execution progress');
    }
  };

  const calculateETA = (): string => {
    if (!progress.startedAt || !progress.promptsCompleted || !progress.totalPrompts) {
      return 'Calculating...';
    }

    const elapsedMs = Date.now() - new Date(progress.startedAt).getTime();
    const elapsedSeconds = elapsedMs / 1000;
    const avgSecondsPerPrompt = elapsedSeconds / progress.promptsCompleted;

    // Use actual average if > 5 prompts completed, else use historical 37s
    const effectiveAvg =
      progress.promptsCompleted > 5 ? avgSecondsPerPrompt : AVERAGE_SECONDS_PER_PROMPT;

    const remainingPrompts = progress.totalPrompts - progress.promptsCompleted;
    const etaSeconds = remainingPrompts * effectiveAvg;

    const minutes = Math.floor(etaSeconds / 60);
    const seconds = Math.floor(etaSeconds % 60);

    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `~${hours}h ${remainingMinutes}m`;
    }

    return `~${minutes}m ${seconds}s`;
  };

  const getElapsedTime = (): string => {
    if (!progress.startedAt) return '0m';

    const elapsedMs = Date.now() - new Date(progress.startedAt).getTime();
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);

    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const getAvgSecondsPerPrompt = (): number => {
    if (!progress.startedAt || !progress.promptsCompleted) return 0;

    const elapsedMs = Date.now() - new Date(progress.startedAt).getTime();
    return Math.floor(elapsedMs / 1000 / progress.promptsCompleted);
  };

  const getPromptsPerMinute = (): number => {
    if (!progress.startedAt || !progress.promptsCompleted) return 0;

    const elapsedMs = Date.now() - new Date(progress.startedAt).getTime();
    const elapsedMinutes = elapsedMs / 60000;
    return elapsedMinutes > 0 ? progress.promptsCompleted / elapsedMinutes : 0;
  };

  const toggleBrand = (brandId: string) => {
    setOpenBrands(prev => {
      const newSet = new Set(prev);
      if (newSet.has(brandId)) {
        newSet.delete(brandId);
      } else {
        newSet.add(brandId);
      }
      return newSet;
    });
  };

  const handleCancel = async () => {
    if (!runId) return;

    if (!confirm('Are you sure you want to cancel this execution?')) return;

    try {
      // Update run status to cancelled
      const { error } = await supabase
        .from('schedule_runs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (error) throw error;

      toast.success('Execution cancelled');
      onCancel?.();
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      toast.error('Failed to cancel execution');
    }
  };

  const handleResume = async () => {
    if (!runId) return;

    if (!confirm('Attempt to resume this execution? This will restart the multi-account runner.')) return;

    try {
      // Fetch current run to get schedule info
      const { data: run, error: fetchError } = await supabase
        .from('schedule_runs')
        .select('schedule_id, metadata')
        .eq('id', runId)
        .single();

      if (fetchError || !run) throw new Error('Failed to fetch run details');

      // Try to resume from saved state in metadata
      const resumeState = run.metadata?.resume_state;

      if (resumeState) {
        // Resume from saved state
        const { error: invokeError } = await supabase.functions.invoke('multi-account-runner', {
          body: { resume_state: resumeState }
        });

        if (invokeError) throw invokeError;

        toast.success('Resume triggered - execution will continue shortly');
        setLastUpdateTime(Date.now());
        setStallStatus('normal');
      } else {
        // No resume state - restart entire execution
        const { error: invokeError } = await supabase.functions.invoke('multi-account-runner', {
          body: { schedule_id: run.schedule_id, force: true }
        });

        if (invokeError) throw invokeError;

        toast.success('Execution restarted');
      }
    } catch (error) {
      console.error('Failed to resume execution:', error);
      toast.error('Failed to resume execution');
    }
  };

  if (!runId) {
    return null;
  }

  const progressPercentage =
    progress.totalBrands > 0 ? (progress.completedBrands / progress.totalBrands) * 100 : 0;

  const isRunning = progress.status === 'running';
  const isCompleted = progress.status === 'completed' || progress.status === 'completed_with_errors';
  const isFailed = progress.status === 'failed';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isRunning && '⏳ Execution in Progress'}
            {isCompleted && '✅ Execution Completed'}
            {isFailed && '❌ Execution Failed'}
            {!isRunning && !isCompleted && !isFailed && 'Execution Status'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isRunning && stallStatus !== 'normal' && (
              <Button variant="outline" size="sm" onClick={handleResume}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}
            {isRunning && (
              <Button variant="destructive" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Stall Warning Alert */}
        {isRunning && stallStatus === 'warning' && (
          <Alert className="mt-3 border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Execution appears slow</AlertTitle>
            <AlertDescription className="text-yellow-700">
              No updates received for {Math.floor((Date.now() - lastUpdateTime) / 60000)} minutes.
              The execution may be processing a slow prompt or experiencing issues.
            </AlertDescription>
          </Alert>
        )}

        {/* Stall Critical Alert */}
        {isRunning && stallStatus === 'critical' && (
          <Alert className="mt-3 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Execution may be stalled</AlertTitle>
            <AlertDescription className="text-red-700">
              No updates for {Math.floor((Date.now() - lastUpdateTime) / 60000)} minutes.
              Click "Resume" to attempt recovery or "Cancel" to stop execution.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Progress Bar */}
        <div className="space-y-2 mt-4">
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {progress.completedBrands} / {progress.totalBrands} brands completed •{' '}
              {progress.promptsCompleted} / {progress.totalPrompts} prompts
              {isRunning && <span> • ETA: {calculateETA()}</span>}
            </span>
            {isRunning && (
              <Badge variant="secondary" className="animate-pulse">
                Running
              </Badge>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        {isRunning && progress.promptsCompleted > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-gray-500">
            <span>
              <strong>Avg:</strong> {getAvgSecondsPerPrompt()}s/prompt
            </span>
            <span>
              <strong>Elapsed:</strong> {getElapsedTime()}
            </span>
            <span>
              <strong>Speed:</strong> {getPromptsPerMinute().toFixed(1)} prompts/min
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Per-brand Progress */}
        <div className="space-y-2">
          {Object.entries(progress.executionProgress).map(([clientId, brandProgress]) => {
            const isOpen = openBrands.has(clientId);
            const isCurrent = progress.currentBrandId === clientId;

            return (
              <Collapsible key={clientId} open={isOpen} onOpenChange={() => toggleBrand(clientId)}>
                <CollapsibleTrigger className="w-full">
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isCurrent ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Status Icon */}
                    {brandProgress.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : brandProgress.status === 'running' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600 flex-shrink-0" />
                    ) : brandProgress.status === 'failed' ? (
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}

                    {/* Brand Name */}
                    <span className="font-medium flex-1 text-left">{brandProgress.brand_name}</span>

                    {/* Progress Badge */}
                    <Badge variant={brandProgress.failed_prompts > 0 ? 'destructive' : 'secondary'}>
                      {brandProgress.completed_prompts}/{brandProgress.total_prompts}
                      {brandProgress.failed_prompts > 0 && ` (${brandProgress.failed_prompts} failed)`}
                    </Badge>

                    {/* Expand Icon */}
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="pl-10 pr-3 pt-2 pb-3 space-y-1">
                    {brandProgress.prompts.length === 0 ? (
                      <div className="text-sm text-gray-500 py-2">No prompts executed yet</div>
                    ) : (
                      brandProgress.prompts.map((prompt, idx) => (
                        <div key={`${prompt.id}-${idx}`} className="flex items-start gap-2 text-sm py-1">
                          {prompt.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : prompt.status === 'failed' ? (
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-gray-700 line-clamp-1">{prompt.prompt_text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Completion Summary */}
        {isCompleted && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-900">
              <strong>✅ Execution Complete</strong>
              <div className="mt-2 space-y-1">
                <div>Total brands: {progress.totalBrands}</div>
                <div>
                  Total prompts: {progress.totalPrompts} (
                  {progress.promptsCompleted} completed)
                </div>
                {progress.startedAt && (
                  <div>
                    Duration: {getElapsedTime()} (
                    {getAvgSecondsPerPrompt()}s per prompt)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Failure Summary */}
        {isFailed && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-900">
              <strong>❌ Execution Failed</strong>
              <div className="mt-2">
                Please check the logs for more details or contact support.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
