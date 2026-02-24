import { describe, it, expect } from 'vitest';
import { localTimeToUTC, utcToLocalTime, formatInTimezone } from './timezone';

// ============================================================================
// localTimeToUTC — Convert local time in a timezone to UTC
// ============================================================================

describe('localTimeToUTC', () => {
  it('IST (UTC+5:30): 9:30 PM on Feb 19 → 4:00 PM UTC', () => {
    const result = localTimeToUTC('2026-02-19', '21:30', 'Asia/Kolkata');
    expect(result).toBe('2026-02-19T16:00:00.000Z');
  });

  it('IST: midnight → previous day 6:30 PM UTC', () => {
    const result = localTimeToUTC('2026-02-20', '00:00', 'Asia/Kolkata');
    expect(result).toBe('2026-02-19T18:30:00.000Z');
  });

  it('IST: 3:00 AM on Feb 20 → Feb 19 9:30 PM UTC', () => {
    const result = localTimeToUTC('2026-02-20', '03:00', 'Asia/Kolkata');
    expect(result).toBe('2026-02-19T21:30:00.000Z');
  });

  it('UTC: time stays the same', () => {
    const result = localTimeToUTC('2026-02-19', '14:00', 'UTC');
    expect(result).toBe('2026-02-19T14:00:00.000Z');
  });

  it('US Eastern (winter, UTC-5): 10:00 AM → 3:00 PM UTC', () => {
    const result = localTimeToUTC('2026-02-19', '10:00', 'America/New_York');
    expect(result).toBe('2026-02-19T15:00:00.000Z');
  });

  it('US Pacific (winter, UTC-8): 6:00 PM → next day 2:00 AM UTC', () => {
    const result = localTimeToUTC('2026-02-19', '18:00', 'America/Los_Angeles');
    expect(result).toBe('2026-02-20T02:00:00.000Z');
  });

  it('Japan (UTC+9): 9:00 AM → midnight UTC', () => {
    const result = localTimeToUTC('2026-02-19', '09:00', 'Asia/Tokyo');
    expect(result).toBe('2026-02-19T00:00:00.000Z');
  });

  it('Dubai (UTC+4): 8:00 PM → 4:00 PM UTC', () => {
    const result = localTimeToUTC('2026-02-19', '20:00', 'Asia/Dubai');
    expect(result).toBe('2026-02-19T16:00:00.000Z');
  });

  it('Singapore (UTC+8): 1:00 AM Feb 20 → 5:00 PM Feb 19 UTC', () => {
    const result = localTimeToUTC('2026-02-20', '01:00', 'Asia/Singapore');
    expect(result).toBe('2026-02-19T17:00:00.000Z');
  });

  it('Australia/Sydney (AEDT, UTC+11 in Feb): 10:00 PM → 11:00 AM UTC', () => {
    const result = localTimeToUTC('2026-02-19', '22:00', 'Australia/Sydney');
    expect(result).toBe('2026-02-19T11:00:00.000Z');
  });

  it('Europe/London (winter, UTC+0): same as UTC', () => {
    const result = localTimeToUTC('2026-02-19', '15:00', 'Europe/London');
    expect(result).toBe('2026-02-19T15:00:00.000Z');
  });

  it('Europe/Paris (winter, UTC+1): 3:00 PM → 2:00 PM UTC', () => {
    const result = localTimeToUTC('2026-02-19', '15:00', 'Europe/Paris');
    expect(result).toBe('2026-02-19T14:00:00.000Z');
  });
});

// ============================================================================
// utcToLocalTime — Convert UTC to local date/time parts
// ============================================================================

describe('utcToLocalTime', () => {
  it('IST: 4:00 PM UTC → 9:30 PM Feb 19 IST', () => {
    const result = utcToLocalTime('2026-02-19T16:00:00.000Z', 'Asia/Kolkata');
    expect(result.date).toBe('2026-02-19');
    expect(result.time).toBe('21:30');
  });

  it('IST: 6:30 PM UTC → midnight Feb 20 IST', () => {
    const result = utcToLocalTime('2026-02-19T18:30:00.000Z', 'Asia/Kolkata');
    expect(result.date).toBe('2026-02-20');
    expect(result.time).toBe('00:00');
  });

  it('UTC: time stays the same', () => {
    const result = utcToLocalTime('2026-02-19T14:00:00.000Z', 'UTC');
    expect(result.date).toBe('2026-02-19');
    expect(result.time).toBe('14:00');
  });

  it('US Eastern (winter): 3:00 PM UTC → 10:00 AM ET', () => {
    const result = utcToLocalTime('2026-02-19T15:00:00.000Z', 'America/New_York');
    expect(result.date).toBe('2026-02-19');
    expect(result.time).toBe('10:00');
  });

  it('US Pacific (winter): 2:00 AM Feb 20 UTC → 6:00 PM Feb 19 PT', () => {
    const result = utcToLocalTime('2026-02-20T02:00:00.000Z', 'America/Los_Angeles');
    expect(result.date).toBe('2026-02-19');
    expect(result.time).toBe('18:00');
  });

  it('Japan: midnight UTC → 9:00 AM JST', () => {
    const result = utcToLocalTime('2026-02-19T00:00:00.000Z', 'Asia/Tokyo');
    expect(result.date).toBe('2026-02-19');
    expect(result.time).toBe('09:00');
  });
});

// ============================================================================
// Round-trip: localTimeToUTC → utcToLocalTime should preserve values
// ============================================================================

describe('round-trip: localTimeToUTC → utcToLocalTime', () => {
  const testCases = [
    { date: '2026-02-19', time: '21:30', tz: 'Asia/Kolkata', label: 'IST 9:30 PM' },
    { date: '2026-02-19', time: '09:00', tz: 'Asia/Kolkata', label: 'IST 9:00 AM' },
    { date: '2026-02-19', time: '00:00', tz: 'Asia/Kolkata', label: 'IST midnight' },
    { date: '2026-02-19', time: '14:00', tz: 'UTC', label: 'UTC 2:00 PM' },
    { date: '2026-02-19', time: '10:00', tz: 'America/New_York', label: 'ET 10:00 AM' },
    { date: '2026-02-19', time: '18:00', tz: 'America/Los_Angeles', label: 'PT 6:00 PM' },
    { date: '2026-02-19', time: '22:00', tz: 'Australia/Sydney', label: 'AEDT 10:00 PM' },
    { date: '2026-02-19', time: '15:00', tz: 'Europe/Paris', label: 'CET 3:00 PM' },
    { date: '2026-02-19', time: '20:00', tz: 'Asia/Dubai', label: 'GST 8:00 PM' },
    { date: '2026-02-19', time: '09:00', tz: 'Asia/Tokyo', label: 'JST 9:00 AM' },
    { date: '2026-02-20', time: '01:00', tz: 'Asia/Singapore', label: 'SGT 1:00 AM' },
    { date: '2026-02-19', time: '15:00', tz: 'Europe/London', label: 'GMT 3:00 PM' },
    { date: '2026-02-19', time: '23:59', tz: 'Asia/Kolkata', label: 'IST 11:59 PM edge' },
    { date: '2026-06-15', time: '14:00', tz: 'America/New_York', label: 'EDT summer' },
    { date: '2026-07-01', time: '10:00', tz: 'Europe/London', label: 'BST summer' },
  ];

  for (const tc of testCases) {
    it(`${tc.label} (${tc.tz}): ${tc.date} ${tc.time} survives round-trip`, () => {
      const utc = localTimeToUTC(tc.date, tc.time, tc.tz);
      const local = utcToLocalTime(utc, tc.tz);
      expect(local.date).toBe(tc.date);
      expect(local.time).toBe(tc.time);
    });
  }
});

// ============================================================================
// DST-aware: Summer vs Winter should produce different UTC offsets
// ============================================================================

describe('DST awareness', () => {
  it('New York winter (Feb) is UTC-5', () => {
    const utc = localTimeToUTC('2026-02-19', '12:00', 'America/New_York');
    expect(utc).toBe('2026-02-19T17:00:00.000Z'); // 12:00 + 5 = 17:00
  });

  it('New York summer (Jul) is UTC-4', () => {
    const utc = localTimeToUTC('2026-07-19', '12:00', 'America/New_York');
    expect(utc).toBe('2026-07-19T16:00:00.000Z'); // 12:00 + 4 = 16:00
  });

  it('London winter (Feb) is UTC+0', () => {
    const utc = localTimeToUTC('2026-02-19', '12:00', 'Europe/London');
    expect(utc).toBe('2026-02-19T12:00:00.000Z');
  });

  it('London summer (Jul) is UTC+1 (BST)', () => {
    const utc = localTimeToUTC('2026-07-19', '12:00', 'Europe/London');
    expect(utc).toBe('2026-07-19T11:00:00.000Z'); // 12:00 - 1 = 11:00
  });

  it('Sydney summer (Feb) is UTC+11 (AEDT)', () => {
    const utc = localTimeToUTC('2026-02-19', '12:00', 'Australia/Sydney');
    expect(utc).toBe('2026-02-19T01:00:00.000Z'); // 12:00 - 11 = 01:00
  });

  it('Sydney winter (Jul) is UTC+10 (AEST)', () => {
    const utc = localTimeToUTC('2026-07-19', '12:00', 'Australia/Sydney');
    expect(utc).toBe('2026-07-19T02:00:00.000Z'); // 12:00 - 10 = 02:00
  });

  it('IST has no DST — same offset year-round', () => {
    const winter = localTimeToUTC('2026-02-19', '12:00', 'Asia/Kolkata');
    const summer = localTimeToUTC('2026-07-19', '12:00', 'Asia/Kolkata');
    // Both should be 12:00 - 5:30 = 06:30 UTC
    expect(winter).toBe('2026-02-19T06:30:00.000Z');
    expect(summer).toBe('2026-07-19T06:30:00.000Z');
  });
});

// ============================================================================
// formatInTimezone — Display formatting
// ============================================================================

describe('formatInTimezone', () => {
  it('shows IST timezone suffix', () => {
    const result = formatInTimezone('2026-02-19T16:00:00.000Z', 'Asia/Kolkata');
    expect(result).toContain('9:30');
    expect(result).toContain('PM');
    // Should contain timezone abbreviation
    expect(result).toMatch(/GMT\+5:30|IST/);
  });

  it('shows correct date for cross-day conversion', () => {
    // 6:30 PM UTC = midnight IST (Feb 20)
    const result = formatInTimezone('2026-02-19T18:30:00.000Z', 'Asia/Kolkata');
    expect(result).toContain('2/20/2026');
    expect(result).toContain('12:00');
    expect(result).toContain('AM');
  });

  it('shows UTC time correctly', () => {
    const result = formatInTimezone('2026-02-19T14:00:00.000Z', 'UTC');
    expect(result).toContain('2:00');
    expect(result).toContain('PM');
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe('edge cases', () => {
  it('handles midnight correctly', () => {
    const utc = localTimeToUTC('2026-02-19', '00:00', 'UTC');
    expect(utc).toBe('2026-02-19T00:00:00.000Z');
  });

  it('handles 23:59 correctly', () => {
    const utc = localTimeToUTC('2026-02-19', '23:59', 'UTC');
    expect(utc).toBe('2026-02-19T23:59:00.000Z');
  });

  it('handles date boundary crossing (IST midnight → previous UTC day)', () => {
    // Midnight IST = 6:30 PM previous day UTC
    const utc = localTimeToUTC('2026-03-01', '00:00', 'Asia/Kolkata');
    expect(utc).toBe('2026-02-28T18:30:00.000Z');
  });

  it('handles leap year date', () => {
    // 2028 is a leap year
    const utc = localTimeToUTC('2028-02-29', '12:00', 'Asia/Kolkata');
    expect(utc).toBe('2028-02-29T06:30:00.000Z');
  });

  it('multiple round-trips do NOT cause drift', () => {
    let date = '2026-02-19';
    let time = '21:30';
    const tz = 'Asia/Kolkata';

    // Simulate 5 edit-save cycles
    for (let i = 0; i < 5; i++) {
      const utc = localTimeToUTC(date, time, tz);
      const local = utcToLocalTime(utc, tz);
      date = local.date;
      time = local.time;
    }

    expect(date).toBe('2026-02-19');
    expect(time).toBe('21:30');
  });

  it('multiple round-trips with US Eastern do NOT cause drift', () => {
    let date = '2026-02-19';
    let time = '10:00';
    const tz = 'America/New_York';

    for (let i = 0; i < 5; i++) {
      const utc = localTimeToUTC(date, time, tz);
      const local = utcToLocalTime(utc, tz);
      date = local.date;
      time = local.time;
    }

    expect(date).toBe('2026-02-19');
    expect(time).toBe('10:00');
  });
});
