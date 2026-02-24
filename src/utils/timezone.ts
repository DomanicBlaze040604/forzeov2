/**
 * Timezone conversion utilities for the scheduler.
 * Extracted for testability.
 */

/**
 * Convert a local date/time in a given IANA timezone to a UTC ISO string.
 * Uses Intl.DateTimeFormat to get the real UTC offset (DST-aware).
 */
export function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  });

  const refDate = new Date(`${dateStr}T${timeStr}:00Z`);
  const parts = formatter.formatToParts(refDate);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '+00:00';

  const offsetMatch = tzPart.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
  let offsetMinutes = 0;
  if (offsetMatch) {
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    const hours = parseInt(offsetMatch[2], 10);
    const mins = parseInt(offsetMatch[3] || '0', 10);
    offsetMinutes = sign * (hours * 60 + mins);
  }

  const localMs = new Date(`${dateStr}T${timeStr}:00Z`).getTime();
  const utcMs = localMs - offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * Convert a UTC ISO string to local date/time parts in a given IANA timezone.
 * Returns { date: 'YYYY-MM-DD', time: 'HH:MM' }.
 */
export function utcToLocalTime(utcIso: string, timezone: string): { date: string; time: string } {
  const utcDate = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const time = `${get('hour')}:${get('minute')}`;
  return { date, time };
}

/**
 * Format a UTC ISO string for display in a given IANA timezone.
 */
export function formatInTimezone(utcIso: string, timezone: string): string {
  const utcDate = new Date(utcIso);
  return utcDate.toLocaleString('en-US', {
    timeZone: timezone,
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}
