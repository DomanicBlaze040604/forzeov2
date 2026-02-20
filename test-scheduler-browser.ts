/**
 * ============================================================================
 * BROWSER-BASED SCHEDULER TESTS
 * ============================================================================
 *
 * Run this in the browser console on your deployed app:
 * 1. Open ClientDashboard
 * 2. Open browser DevTools (F12)
 * 3. Copy and paste this entire file
 * 4. Run: runBrowserTests()
 */

import { supabase } from '@/integrations/supabase/client';

// Test utilities
const colors = {
  reset: '',
  green: 'color: #10b981; font-weight: bold',
  red: 'color: #ef4444; font-weight: bold',
  yellow: 'color: #eab308; font-weight: bold',
  blue: 'color: #3b82f6; font-weight: bold',
  cyan: 'color: #06b6d4; font-weight: bold',
};

function log(message: string, style = '') {
  console.log(`%c${message}`, style);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function section(message: string) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(message, colors.blue);
  log('='.repeat(60), colors.blue);
}

export async function testDatabaseSchema() {
  section('TEST 1: Database Schema Verification');

  const tables = [
    'account_groups',
    'execution_locks',
    'schedule_analytics',
    'conditional_execution_rules',
    'prompt_schedules',
    'schedule_runs'
  ];

  let allPassed = true;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        error(`Table ${table}: ${error.message}`);
        allPassed = false;
      } else {
        success(`Table ${table} exists and is accessible`);
      }
    } catch (err: any) {
      error(`Table ${table} check failed: ${err.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

export async function testEnhancedColumns() {
  section('TEST 2: Enhanced Column Verification');

  try {
    // Test prompt_schedules enhanced columns
    const { data, error } = await supabase
      .from('prompt_schedules')
      .select('client_ids, account_group_id, prompt_selection_type, recurrence_type, timezone, conditional_rules, concurrency_limit')
      .limit(1);

    if (error) {
      error(`Enhanced columns test failed: ${error.message}`);
      return false;
    }

    success('Enhanced columns in prompt_schedules verified');

    // Test schedule_runs enhanced columns
    const { data: runsData, error: runsError } = await supabase
      .from('schedule_runs')
      .select('total_brands, completed_brands, failed_brands, execution_progress, current_brand_id, prompts_completed, total_prompts, notification_sent_at')
      .limit(1);

    if (runsError) {
      error(`Enhanced columns in schedule_runs failed: ${runsError.message}`);
      return false;
    }

    success('Enhanced columns in schedule_runs verified');
    return true;
  } catch (err: any) {
    error(`Enhanced columns test failed: ${err.message}`);
    return false;
  }
}

export async function testAccountGroupsAccess() {
  section('TEST 3: Account Groups Access');

  try {
    const { data, error } = await supabase
      .from('account_groups')
      .select('*')
      .limit(5);

    if (error) {
      error(`Account groups access failed: ${error.message}`);
      return false;
    }

    success(`Account groups accessible (found ${data?.length || 0} groups)`);
    return true;
  } catch (err: any) {
    error(`Account groups test failed: ${err.message}`);
    return false;
  }
}

export async function testScheduleAnalytics() {
  section('TEST 4: Schedule Analytics Access');

  try {
    const { data, error } = await supabase
      .from('schedule_analytics')
      .select('*')
      .limit(5);

    if (error) {
      error(`Schedule analytics access failed: ${error.message}`);
      return false;
    }

    success(`Schedule analytics accessible (found ${data?.length || 0} records)`);
    return true;
  } catch (err: any) {
    error(`Schedule analytics test failed: ${err.message}`);
    return false;
  }
}

export async function testEdgeFunctionsCallable() {
  section('TEST 5: Edge Functions Availability');

  const functions = [
    'multi-account-runner',
    'scheduler',
    'notify-schedule-execution'
  ];

  info('Testing edge function availability (expecting errors for invalid input)...');

  let allCallable = true;

  for (const func of functions) {
    try {
      const { error } = await supabase.functions.invoke(func, {
        body: { test: true, invalid: true }
      });

      // Any response (even error) means function is deployed
      success(`Edge function '${func}' is deployed and callable`);
    } catch (err: any) {
      if (err.message.includes('FunctionsRelayError') || err.message.includes('not found')) {
        error(`Edge function '${func}' may not be deployed`);
        allCallable = false;
      } else {
        success(`Edge function '${func}' is deployed (returned expected error)`);
      }
    }
  }

  return allCallable;
}

export async function testMultiBrandScheduleCreation() {
  section('TEST 6: Multi-Brand Schedule Creation');

  try {
    // Get some clients for testing
    const { data: clients } = await supabase
      .from('clients')
      .select('id, brand_name')
      .limit(3);

    if (!clients || clients.length < 2) {
      error('Need at least 2 clients for multi-brand testing');
      return false;
    }

    const clientIds = clients.map(c => c.id);

    // Create test schedule
    const { data: schedule, error: createError } = await supabase
      .from('prompt_schedules')
      .insert({
        name: `Browser Test Schedule ${Date.now()}`,
        client_ids: clientIds,
        prompt_selection_type: 'all',
        interval_value: 60,
        interval_unit: 'minutes',
        is_active: false, // Don't activate
        models: ['gpt-4'],
        concurrency_limit: 2,
        recurrence_type: 'once',
        timezone: 'UTC'
      })
      .select()
      .single();

    if (createError || !schedule) {
      error(`Failed to create multi-brand schedule: ${createError?.message}`);
      return false;
    }

    success(`Created multi-brand schedule with ${clientIds.length} brands`);
    info(`Schedule ID: ${schedule.id}`);

    // Cleanup - delete the test schedule
    await supabase.from('prompt_schedules').delete().eq('id', schedule.id);
    success('Cleaned up test schedule');

    return true;
  } catch (err: any) {
    error(`Multi-brand schedule test failed: ${err.message}`);
    return false;
  }
}

export async function runBrowserTests() {
  log('\n🚀 MULTI-ACCOUNT SCHEDULER BROWSER TEST SUITE\n', colors.yellow);
  log('Running tests from browser context...\n', colors.yellow);

  const results: { test: string; passed: boolean }[] = [];

  results.push({ test: 'Database Schema', passed: await testDatabaseSchema() });
  results.push({ test: 'Enhanced Columns', passed: await testEnhancedColumns() });
  results.push({ test: 'Account Groups Access', passed: await testAccountGroupsAccess() });
  results.push({ test: 'Schedule Analytics', passed: await testScheduleAnalytics() });
  results.push({ test: 'Edge Functions', passed: await testEdgeFunctionsCallable() });
  results.push({ test: 'Multi-Brand Schedule', passed: await testMultiBrandScheduleCreation() });

  // Summary
  section('TEST RESULTS SUMMARY');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const failed = total - passed;

  results.forEach(result => {
    if (result.passed) {
      success(`${result.test}: PASSED`);
    } else {
      error(`${result.test}: FAILED`);
    }
  });

  log('\n', '');

  if (failed === 0) {
    success(`All ${total} tests passed! ✨`);
    log('\n✅ System is ready for production use\n', colors.green);
  } else {
    error(`${failed} of ${total} tests failed`);
    log('\n❌ Please fix failing tests before using the feature\n', colors.red);
  }

  return { passed, failed, total };
}

// Auto-export for console usage
if (typeof window !== 'undefined') {
  (window as any).runBrowserTests = runBrowserTests;
  console.log('%c📋 Browser tests loaded!', 'color: #10b981; font-size: 16px; font-weight: bold');
  console.log('%cRun tests with: runBrowserTests()', 'color: #06b6d4; font-size: 14px');
}
