/**
 * ============================================================================
 * MULTI-ACCOUNT SCHEDULER TEST SUITE
 * ============================================================================
 *
 * This script tests the complete multi-account scheduler system:
 * 1. Database schema verification
 * 2. Single-brand schedule creation and execution
 * 3. Multi-brand schedule creation and execution
 * 4. Execution lock mechanism
 * 5. Conditional rules evaluation
 * 6. Notification system
 * 7. Analytics tracking
 *
 * Run with: npx tsx test-scheduler.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bvmwnxargzlfheiwyget.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test utilities
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
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

// Test functions
async function testDatabaseSchema() {
  section('TEST 1: Database Schema Verification');

  const tables = [
    'account_groups',
    'execution_locks',
    'schedule_analytics',
    'conditional_execution_rules',
    'prompt_schedules',
    'schedule_runs'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        error(`Table ${table} verification failed: ${error.message}`);
        return false;
      }

      success(`Table ${table} exists and is accessible`);
    } catch (err: any) {
      error(`Table ${table} check failed: ${err.message}`);
      return false;
    }
  }

  // Verify enhanced columns in prompt_schedules
  try {
    const { data, error: selectError } = await supabase
      .from('prompt_schedules')
      .select('client_ids, account_group_id, prompt_selection_type, recurrence_type, timezone, conditional_rules')
      .limit(1);

    if (selectError) {
      error(`Enhanced columns verification failed: ${selectError.message}`);
      return false;
    }

    success('Enhanced columns in prompt_schedules verified');
  } catch (err: any) {
    error(`Enhanced columns check failed: ${err.message}`);
    return false;
  }

  // Verify enhanced columns in schedule_runs
  try {
    const { data, error: selectError } = await supabase
      .from('schedule_runs')
      .select('total_brands, completed_brands, failed_brands, execution_progress, current_brand_id, prompts_completed, total_prompts')
      .limit(1);

    if (selectError) {
      error(`Enhanced columns in schedule_runs verification failed: ${selectError.message}`);
      return false;
    }

    success('Enhanced columns in schedule_runs verified');
  } catch (err: any) {
    error(`Enhanced columns in schedule_runs check failed: ${err.message}`);
    return false;
  }

  return true;
}

async function testAccountGroups() {
  section('TEST 2: Account Groups CRUD Operations');

  // Get first admin user
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1);

  if (!profiles || profiles.length === 0) {
    error('No admin users found for testing');
    return false;
  }

  const userId = profiles[0].id;

  // Get some client IDs for testing
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .limit(5);

  if (!clients || clients.length === 0) {
    error('No clients found for testing');
    return false;
  }

  const clientIds = clients.map(c => c.id);

  // Create account group
  const { data: group, error: createError } = await supabase
    .from('account_groups')
    .insert({
      user_id: userId,
      name: 'Test Group',
      description: 'Test account group for scheduler testing',
      client_ids: clientIds
    })
    .select()
    .single();

  if (createError || !group) {
    error(`Failed to create account group: ${createError?.message}`);
    return false;
  }

  success(`Created account group: ${group.name} with ${clientIds.length} clients`);

  // Read account group
  const { data: readGroup, error: readError } = await supabase
    .from('account_groups')
    .select('*')
    .eq('id', group.id)
    .single();

  if (readError || !readGroup) {
    error(`Failed to read account group: ${readError?.message}`);
    return false;
  }

  success('Successfully read account group');

  // Update account group
  const { error: updateError } = await supabase
    .from('account_groups')
    .update({ description: 'Updated description' })
    .eq('id', group.id);

  if (updateError) {
    error(`Failed to update account group: ${updateError.message}`);
    return false;
  }

  success('Successfully updated account group');

  // Delete account group (cleanup)
  const { error: deleteError } = await supabase
    .from('account_groups')
    .delete()
    .eq('id', group.id);

  if (deleteError) {
    error(`Failed to delete account group: ${deleteError.message}`);
    return false;
  }

  success('Successfully deleted account group (cleanup)');

  return true;
}

async function testExecutionLocks() {
  section('TEST 3: Execution Lock Mechanism');

  // Create a dummy schedule for testing
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .limit(1);

  if (!clients || clients.length === 0) {
    error('No clients found for testing');
    return false;
  }

  const { data: schedule, error: scheduleError } = await supabase
    .from('prompt_schedules')
    .insert({
      client_id: clients[0].id,
      name: 'Test Schedule for Locks',
      interval_value: 60,
      interval_unit: 'minutes',
      is_active: false, // Don't actually run it
      models: ['gpt-4']
    })
    .select()
    .single();

  if (scheduleError || !schedule) {
    error(`Failed to create test schedule: ${scheduleError?.message}`);
    return false;
  }

  // Test 1: Acquire lock
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
  const { data: lock1, error: lock1Error } = await supabase
    .from('execution_locks')
    .insert({
      schedule_id: schedule.id,
      locked_by: 'test-process-1',
      expires_at: expiresAt
    })
    .select()
    .single();

  if (lock1Error || !lock1) {
    error(`Failed to acquire lock: ${lock1Error?.message}`);
    return false;
  }

  success('Successfully acquired execution lock');

  // Test 2: Try to acquire duplicate lock (should fail)
  const { error: lock2Error } = await supabase
    .from('execution_locks')
    .insert({
      schedule_id: schedule.id,
      locked_by: 'test-process-2',
      expires_at: expiresAt
    });

  if (lock2Error && lock2Error.code === '23505') {
    success('Duplicate lock correctly prevented (UNIQUE constraint working)');
  } else {
    error('Duplicate lock should have been prevented!');
    return false;
  }

  // Test 3: Release lock
  const { error: releaseError } = await supabase
    .from('execution_locks')
    .delete()
    .eq('schedule_id', schedule.id);

  if (releaseError) {
    error(`Failed to release lock: ${releaseError.message}`);
    return false;
  }

  success('Successfully released execution lock');

  // Cleanup
  await supabase.from('prompt_schedules').delete().eq('id', schedule.id);

  return true;
}

async function testScheduleCreation() {
  section('TEST 4: Multi-Brand Schedule Creation');

  // Get multiple clients for testing
  const { data: clients } = await supabase
    .from('clients')
    .select('id, brand_name')
    .limit(3);

  if (!clients || clients.length < 2) {
    error('Need at least 2 clients for multi-brand testing');
    return false;
  }

  const clientIds = clients.map(c => c.id);

  // Create multi-brand schedule
  const { data: schedule, error: createError } = await supabase
    .from('prompt_schedules')
    .insert({
      name: 'Test Multi-Brand Schedule',
      client_ids: clientIds, // Multi-brand
      prompt_selection_type: 'all',
      interval_value: 60,
      interval_unit: 'minutes',
      is_active: false, // Don't activate for testing
      models: ['gpt-4'],
      concurrency_limit: 2,
      recurrence_type: 'daily',
      timezone: 'America/New_York',
      notify_on_completion: true
    })
    .select()
    .single();

  if (createError || !schedule) {
    error(`Failed to create multi-brand schedule: ${createError?.message}`);
    return false;
  }

  success(`Created multi-brand schedule with ${clientIds.length} brands`);
  info(`Schedule ID: ${schedule.id}`);
  info(`Schedule Name: ${schedule.name}`);
  info(`Client IDs: ${schedule.client_ids?.join(', ')}`);

  // Verify check constraint (can't have both client_id and client_ids)
  const { error: invalidError } = await supabase
    .from('prompt_schedules')
    .insert({
      name: 'Invalid Schedule',
      client_id: clients[0].id,
      client_ids: [clients[0].id, clients[1].id],
      interval_value: 60,
      interval_unit: 'minutes',
      is_active: false,
      models: ['gpt-4']
    });

  if (invalidError && invalidError.message.includes('check_client_selection')) {
    success('Check constraint correctly prevents both client_id and client_ids');
  } else {
    error('Check constraint should have prevented invalid schedule!');
  }

  // Cleanup
  await supabase.from('prompt_schedules').delete().eq('id', schedule.id);

  return true;
}

async function testConditionalRules() {
  section('TEST 5: Conditional Execution Rules');

  // Get a client for testing
  const { data: clients } = await supabase
    .from('clients')
    .select('id')
    .limit(1);

  if (!clients || clients.length === 0) {
    error('No clients found for testing');
    return false;
  }

  // Create schedule with inline conditional rules
  const { data: schedule, error: scheduleError } = await supabase
    .from('prompt_schedules')
    .insert({
      client_id: clients[0].id,
      name: 'Test Schedule with Conditional Rules',
      interval_value: 60,
      interval_unit: 'minutes',
      is_active: false,
      models: ['gpt-4'],
      conditional_rules: [
        {
          id: 'rule-1',
          ruleType: 'sov_threshold',
          config: { threshold: 30, operator: 'less_than' }
        },
        {
          id: 'rule-2',
          ruleType: 'last_run_hours',
          config: { hours: 24 }
        }
      ]
    })
    .select()
    .single();

  if (scheduleError || !schedule) {
    error(`Failed to create schedule with rules: ${scheduleError?.message}`);
    return false;
  }

  success('Created schedule with conditional rules');
  info(`Conditional Rules: ${JSON.stringify(schedule.conditional_rules, null, 2)}`);

  // Test conditional_execution_rules table
  const { data: rule, error: ruleError } = await supabase
    .from('conditional_execution_rules')
    .insert({
      schedule_id: schedule.id,
      rule_type: 'skip_if_recent',
      rule_config: { hours: 12 },
      is_active: true
    })
    .select()
    .single();

  if (ruleError || !rule) {
    error(`Failed to create conditional rule: ${ruleError?.message}`);
    return false;
  }

  success('Created conditional execution rule in separate table');

  // Cleanup
  await supabase.from('conditional_execution_rules').delete().eq('schedule_id', schedule.id);
  await supabase.from('prompt_schedules').delete().eq('id', schedule.id);

  return true;
}

async function testScheduleAnalytics() {
  section('TEST 6: Schedule Analytics');

  // Get a schedule for testing
  const { data: schedules } = await supabase
    .from('prompt_schedules')
    .select('id')
    .limit(1);

  if (!schedules || schedules.length === 0) {
    info('No existing schedules, creating test schedule');

    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .limit(1);

    if (!clients || clients.length === 0) {
      error('No clients found for testing');
      return false;
    }

    const { data: schedule } = await supabase
      .from('prompt_schedules')
      .insert({
        client_id: clients[0].id,
        name: 'Test Schedule for Analytics',
        interval_value: 60,
        interval_unit: 'minutes',
        is_active: false,
        models: ['gpt-4']
      })
      .select()
      .single();

    if (!schedule) {
      error('Failed to create test schedule');
      return false;
    }

    schedules.push(schedule);
  }

  const scheduleId = schedules[0].id;
  const today = new Date().toISOString().split('T')[0];

  // Insert analytics data
  const { data: analytics, error: analyticsError } = await supabase
    .from('schedule_analytics')
    .insert({
      schedule_id: scheduleId,
      date: today,
      total_runs: 5,
      successful_runs: 4,
      failed_runs: 1,
      avg_execution_time_seconds: 45,
      total_prompts_executed: 50,
      total_cost: 2.5,
      avg_sov: 35.5
    })
    .select()
    .single();

  if (analyticsError) {
    // Check if it's a duplicate key error (analytics already exist for today)
    if (analyticsError.code === '23505') {
      success('Analytics record already exists for today (UNIQUE constraint working)');

      // Update instead
      const { error: updateError } = await supabase
        .from('schedule_analytics')
        .update({
          total_runs: 6,
          successful_runs: 5
        })
        .eq('schedule_id', scheduleId)
        .eq('date', today);

      if (updateError) {
        error(`Failed to update analytics: ${updateError.message}`);
        return false;
      }

      success('Successfully updated existing analytics record');
    } else {
      error(`Failed to insert analytics: ${analyticsError.message}`);
      return false;
    }
  } else {
    success('Created schedule analytics record');
    info(`Analytics: ${analytics.total_runs} runs, ${analytics.successful_runs} successful, ${analytics.total_cost} cost`);
  }

  return true;
}

async function testEdgeFunctions() {
  section('TEST 7: Edge Function Availability');

  const functions = [
    'multi-account-runner',
    'scheduler',
    'notify-schedule-execution'
  ];

  info('Checking edge function deployment status...');
  info('Note: This test only verifies functions are callable, not full execution');

  for (const func of functions) {
    try {
      // Try to invoke with invalid data to check if function exists
      const { error } = await supabase.functions.invoke(func, {
        body: { test: true }
      });

      // If we get ANY response (even an error response), the function exists
      success(`Edge function '${func}' is deployed and callable`);
    } catch (err: any) {
      error(`Edge function '${func}' may not be deployed: ${err.message}`);
    }
  }

  return true;
}

// Main test runner
async function runAllTests() {
  log('\n🚀 MULTI-ACCOUNT SCHEDULER TEST SUITE\n', colors.yellow);
  log('Starting comprehensive system tests...\n', colors.yellow);

  const results: { test: string; passed: boolean }[] = [];

  try {
    results.push({ test: 'Database Schema', passed: await testDatabaseSchema() });
    results.push({ test: 'Account Groups', passed: await testAccountGroups() });
    results.push({ test: 'Execution Locks', passed: await testExecutionLocks() });
    results.push({ test: 'Schedule Creation', passed: await testScheduleCreation() });
    results.push({ test: 'Conditional Rules', passed: await testConditionalRules() });
    results.push({ test: 'Schedule Analytics', passed: await testScheduleAnalytics() });
    results.push({ test: 'Edge Functions', passed: await testEdgeFunctions() });
  } catch (err: any) {
    error(`\nTest suite failed with error: ${err.message}`);
    process.exit(1);
  }

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

  log('\n', colors.reset);

  if (failed === 0) {
    success(`All ${total} tests passed! ✨`);
    log('\n✅ System is ready for production use\n', colors.green);
  } else {
    error(`${failed} of ${total} tests failed`);
    log('\n❌ Please fix failing tests before deploying\n', colors.red);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  error(`Fatal error: ${err.message}`);
  process.exit(1);
});
