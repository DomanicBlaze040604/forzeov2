import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Port of calculateNextRun from supabase/functions/scheduler/index.ts
// for local testing (Deno edge function can't be imported directly)
// ============================================================================

interface Schedule {
  id: string;
  interval_value: number;
  interval_unit: string;
  next_run_at: string | null;
  recurrence_type: string;
  recurrence_days_of_week: number[] | null;
  recurrence_day_of_month: number | null;
}

function calculateNextRun(schedule: Schedule): Date {
  const now = new Date();
  const baseTime = schedule.next_run_at ? new Date(schedule.next_run_at) : now;

  if (schedule.interval_unit && !schedule.recurrence_type) {
    let ms = 0;
    switch (schedule.interval_unit) {
      case 'seconds': ms = schedule.interval_value * 1000; break;
      case 'minutes': ms = schedule.interval_value * 60 * 1000; break;
      case 'hours': ms = schedule.interval_value * 60 * 60 * 1000; break;
      case 'days': ms = schedule.interval_value * 24 * 60 * 60 * 1000; break;
      default: ms = schedule.interval_value * 60 * 1000;
    }
    let next = new Date(baseTime.getTime() + ms);
    while (next <= now) {
      next = new Date(next.getTime() + ms);
    }
    return next;
  }

  switch (schedule.recurrence_type) {
    case 'daily': {
      let next = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);
      while (next <= now) {
        next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      }
      return next;
    }

    case 'weekly': {
      const daysOfWeek = schedule.recurrence_days_of_week || [baseTime.getUTCDay()];
      const currentDay = now.getUTCDay();

      for (let i = 0; i <= 7; i++) {
        const checkDay = (currentDay + i) % 7;
        if (daysOfWeek.includes(checkDay)) {
          const candidate = new Date(now);
          candidate.setUTCDate(candidate.getUTCDate() + i);
          candidate.setUTCHours(baseTime.getUTCHours(), baseTime.getUTCMinutes(), 0, 0);
          if (candidate > now) {
            return candidate;
          }
        }
      }
      const fallback = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      fallback.setUTCHours(baseTime.getUTCHours(), baseTime.getUTCMinutes(), 0, 0);
      return fallback;
    }

    case 'monthly': {
      const dayOfMonth = schedule.recurrence_day_of_month || baseTime.getUTCDate();
      const nextMonth = new Date(baseTime);
      nextMonth.setUTCDate(1); // Prevent month overflow (e.g., March 31 + 1 → May 1)
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      const maxDay = new Date(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0).getDate();
      nextMonth.setUTCDate(Math.min(dayOfMonth, maxDay));
      nextMonth.setUTCHours(baseTime.getUTCHours(), baseTime.getUTCMinutes(), 0, 0);
      if (nextMonth <= now) {
        nextMonth.setUTCDate(1);
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
        const maxDay2 = new Date(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0).getDate();
        nextMonth.setUTCDate(Math.min(dayOfMonth, maxDay2));
      }
      return nextMonth;
    }

    case 'once':
    default:
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('calculateNextRun', () => {
  // Fix "now" to Feb 20 2026, 14:30 UTC for deterministic tests
  const FIXED_NOW = new Date('2026-02-20T14:30:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to make a schedule object
  function makeSchedule(overrides: Partial<Schedule>): Schedule {
    return {
      id: 'test-id',
      interval_value: 1,
      interval_unit: 'days',
      next_run_at: null,
      recurrence_type: '',
      recurrence_days_of_week: null,
      recurrence_day_of_month: null,
      ...overrides,
    };
  }

  // =====================
  // DAILY RECURRENCE
  // =====================

  describe('daily recurrence', () => {
    it('preserves the original time-of-day from next_run_at', () => {
      // Schedule was set for 4:00 PM UTC (9:30 PM IST)
      const schedule = makeSchedule({
        recurrence_type: 'daily',
        next_run_at: '2026-02-20T16:00:00.000Z', // today at 4:00 PM UTC
      });

      const next = calculateNextRun(schedule);
      // Next run should be tomorrow at 4:00 PM UTC (same time of day)
      expect(next.toISOString()).toBe('2026-02-21T16:00:00.000Z');
    });

    it('skips past "now" if baseTime + 1 day is still in the past', () => {
      // Schedule was set for a date 3 days ago
      const schedule = makeSchedule({
        recurrence_type: 'daily',
        next_run_at: '2026-02-17T10:00:00.000Z',
      });

      const next = calculateNextRun(schedule);
      // Should skip to Feb 21 (next future occurrence at 10:00 UTC)
      expect(next.toISOString()).toBe('2026-02-21T10:00:00.000Z');
    });

    it('does NOT drift — running at 4:05 PM still schedules next at 4:00 PM', () => {
      // Simulate: schedule was at 4:00 PM, cron ran at 4:05 PM
      vi.setSystemTime(new Date('2026-02-20T16:05:00.000Z'));

      const schedule = makeSchedule({
        recurrence_type: 'daily',
        next_run_at: '2026-02-20T16:00:00.000Z',
      });

      const next = calculateNextRun(schedule);
      // Next should be tomorrow at exactly 4:00 PM, not 4:05 PM
      expect(next.toISOString()).toBe('2026-02-21T16:00:00.000Z');
    });

    it('handles no next_run_at — uses now as base', () => {
      const schedule = makeSchedule({
        recurrence_type: 'daily',
        next_run_at: null,
      });

      const next = calculateNextRun(schedule);
      // Should be ~24h from now
      expect(next.getTime()).toBe(FIXED_NOW.getTime() + 24 * 60 * 60 * 1000);
    });
  });

  // =====================
  // WEEKLY RECURRENCE
  // =====================

  describe('weekly recurrence', () => {
    it('finds the next matching day of week', () => {
      // Feb 20 2026 is a Friday (day 5)
      // Schedule runs on Monday (1) and Wednesday (3)
      const schedule = makeSchedule({
        recurrence_type: 'weekly',
        recurrence_days_of_week: [1, 3], // Mon, Wed
        next_run_at: '2026-02-18T16:00:00.000Z', // Wed Feb 18 (was set at 4PM UTC)
      });

      const next = calculateNextRun(schedule);
      // Next Monday is Feb 23, at 4:00 PM UTC (preserved time)
      expect(next.getUTCDay()).toBe(1); // Monday
      expect(next.getUTCHours()).toBe(16);
      expect(next.getUTCMinutes()).toBe(0);
    });

    it('preserves original time-of-day', () => {
      // Schedule at 10:30 PM UTC on certain days
      const schedule = makeSchedule({
        recurrence_type: 'weekly',
        recurrence_days_of_week: [0, 3, 6], // Sun, Wed, Sat
        next_run_at: '2026-02-15T22:30:00.000Z',
      });

      const next = calculateNextRun(schedule);
      expect(next.getUTCHours()).toBe(22);
      expect(next.getUTCMinutes()).toBe(30);
    });
  });

  // =====================
  // MONTHLY RECURRENCE
  // =====================

  describe('monthly recurrence', () => {
    it('schedules for the same day of month, next month', () => {
      const schedule = makeSchedule({
        recurrence_type: 'monthly',
        recurrence_day_of_month: 15,
        next_run_at: '2026-02-15T16:00:00.000Z',
      });

      const next = calculateNextRun(schedule);
      expect(next.getUTCMonth()).toBe(2); // March (0-indexed)
      expect(next.getUTCDate()).toBe(15);
      expect(next.getUTCHours()).toBe(16);
    });

    it('clamps to last day of month (e.g., day 31 in April → 30)', () => {
      // Set now to April 1
      vi.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));

      const schedule = makeSchedule({
        recurrence_type: 'monthly',
        recurrence_day_of_month: 31,
        next_run_at: '2026-03-31T16:00:00.000Z',
      });

      const next = calculateNextRun(schedule);
      // April has 30 days, so should clamp to 30
      expect(next.getUTCDate()).toBe(30);
      expect(next.getUTCHours()).toBe(16);
    });

    it('preserves time-of-day across months', () => {
      const schedule = makeSchedule({
        recurrence_type: 'monthly',
        recurrence_day_of_month: 1,
        next_run_at: '2026-02-01T06:30:00.000Z', // 6:30 AM UTC (noon IST)
      });

      const next = calculateNextRun(schedule);
      expect(next.getUTCHours()).toBe(6);
      expect(next.getUTCMinutes()).toBe(30);
    });
  });

  // =====================
  // LEGACY INTERVAL
  // =====================

  describe('legacy interval-based schedules', () => {
    it('interval_unit=hours adds correct interval', () => {
      const schedule = makeSchedule({
        interval_value: 6,
        interval_unit: 'hours',
        recurrence_type: '', // legacy — no recurrence_type
        next_run_at: '2026-02-20T12:00:00.000Z',
      });

      const next = calculateNextRun(schedule);
      // 12:00 + 6h = 18:00, which is after now (14:30)
      expect(next.toISOString()).toBe('2026-02-20T18:00:00.000Z');
    });

    it('interval_unit=days skips past now', () => {
      const schedule = makeSchedule({
        interval_value: 1,
        interval_unit: 'days',
        recurrence_type: '', // legacy
        next_run_at: '2026-02-18T10:00:00.000Z', // 2 days ago
      });

      const next = calculateNextRun(schedule);
      // 18th + 1d = 19th (past), + 1d = 20th 10:00 (past, now is 14:30), + 1d = 21st 10:00
      expect(next.toISOString()).toBe('2026-02-21T10:00:00.000Z');
    });
  });

  // =====================
  // ONE-TIME SCHEDULE
  // =====================

  describe('one-time schedule', () => {
    it('returns far future date', () => {
      const schedule = makeSchedule({
        recurrence_type: 'once',
        next_run_at: '2026-02-19T16:00:00.000Z',
      });

      const next = calculateNextRun(schedule);
      const oneYearFromNow = FIXED_NOW.getTime() + 365 * 24 * 60 * 60 * 1000;
      expect(next.getTime()).toBe(oneYearFromNow);
    });
  });
});
