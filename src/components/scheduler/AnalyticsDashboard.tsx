import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduleMetrics {
  scheduleId: string;
  scheduleName: string;
  totalRuns: number;
  successRate: number;
  avgExecutionTime: number;
  totalCost: number;
  avgSOV: number;
  failureRate: number;
  lastRun: string | null;
  totalPrompts: number;
}

interface AnalyticsData {
  date: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  avg_execution_time_seconds: number;
  total_prompts_executed: number;
  total_cost: number;
  avg_sov: number;
}

interface AnalyticsDashboardProps {
  scheduleIds?: string[];
}

export default function AnalyticsDashboard({ scheduleIds }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<ScheduleMetrics[]>([]);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [scheduleIds, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch schedule analytics
      let query = supabase
        .from('schedule_analytics')
        .select('*, prompt_schedules(name)')
        .gte('date', dateRange.from.toISOString().split('T')[0])
        .lte('date', dateRange.to.toISOString().split('T')[0]);

      if (scheduleIds && scheduleIds.length > 0) {
        query = query.in('schedule_id', scheduleIds);
      }

      const { data: analyticsData, error } = await query;

      if (error) throw error;

      // Aggregate metrics by schedule
      const scheduleMap = new Map<string, ScheduleMetrics>();

      for (const record of (analyticsData || []) as any[]) {
        const scheduleId = record.schedule_id;

        if (!scheduleMap.has(scheduleId)) {
          scheduleMap.set(scheduleId, {
            scheduleId,
            scheduleName: record.prompt_schedules?.name || 'Unknown',
            totalRuns: 0,
            successRate: 0,
            avgExecutionTime: 0,
            totalCost: 0,
            avgSOV: 0,
            failureRate: 0,
            lastRun: null,
            totalPrompts: 0,
          });
        }

        const metric = scheduleMap.get(scheduleId)!;
        metric.totalRuns += record.total_runs || 0;
        metric.totalCost += record.total_cost || 0;
        metric.totalPrompts += record.total_prompts_executed || 0;

        // Running averages
        const totalExecutions = metric.totalRuns;
        if (totalExecutions > 0) {
          metric.avgExecutionTime =
            (metric.avgExecutionTime * (totalExecutions - 1) +
              (record.avg_execution_time_seconds || 0)) /
            totalExecutions;
          metric.avgSOV =
            (metric.avgSOV * (totalExecutions - 1) + (record.avg_sov || 0)) /
            totalExecutions;
        }

        const successfulRuns = record.successful_runs || 0;
        const failedRuns = record.failed_runs || 0;
        const totalRunsForRecord = successfulRuns + failedRuns;

        if (totalRunsForRecord > 0) {
          metric.successRate =
            ((metric.successRate * (metric.totalRuns - totalRunsForRecord)) +
              (successfulRuns / totalRunsForRecord) * 100) /
            metric.totalRuns;
          metric.failureRate = 100 - metric.successRate;
        }
      }

      // Fetch last run dates
      for (const [scheduleId, metric] of scheduleMap.entries()) {
        const { data: lastRunData } = await supabase
          .from('schedule_runs')
          .select('completed_at')
          .eq('schedule_id', scheduleId)
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();

        if (lastRunData) {
          metric.lastRun = lastRunData.completed_at;
        }
      }

      setMetrics(Array.from(scheduleMap.values()));
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const getTrendIcon = (value: number, threshold: number) => {
    if (value > threshold) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value < threshold) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Range Picker */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Schedule Analytics</h3>
          <p className="text-sm text-gray-500">
            Performance metrics and trends for scheduled executions
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from && dateRange.to ? (
                <>
                  {format(dateRange.from, 'LLL dd, y')} -{' '}
                  {format(dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range: any) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.reduce((sum, m) => sum + m.totalRuns, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {metrics.length > 0
                  ? (
                      metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length
                    ).toFixed(1)
                  : 0}
                %
              </div>
              {getTrendIcon(
                metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length,
                95
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.reduce((sum, m) => sum + m.totalCost, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Prompts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.reduce((sum, m) => sum + m.totalPrompts, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading analytics...</div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No analytics data available for selected date range
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Success Rate</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead className="text-right">Avg SOV</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Last Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics
                  .sort((a, b) => b.totalRuns - a.totalRuns)
                  .map(metric => (
                    <TableRow key={metric.scheduleId}>
                      <TableCell className="font-medium">{metric.scheduleName}</TableCell>
                      <TableCell className="text-right">{metric.totalRuns}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            metric.successRate >= 95
                              ? 'default'
                              : metric.successRate >= 80
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {metric.successRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTime(metric.avgExecutionTime)}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.avgSOV > 0 ? `${metric.avgSOV.toFixed(1)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${metric.totalCost.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {metric.lastRun
                          ? format(new Date(metric.lastRun), 'MMM dd, HH:mm')
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
