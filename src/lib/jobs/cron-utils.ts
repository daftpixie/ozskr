/**
 * Cron Expression Utilities
 * Simple cron parser for computing next run times
 */

/**
 * Compute the next run time from a cron expression
 *
 * Supported patterns:
 * - "* * * * *" (every minute)
 * - "STAR/N * * * *" (every N minutes)
 * - "N * * * *" (at minute N of every hour)
 * - "N H * * *" (at minute N, hour H every day)
 * - "N H * * D" (at minute N, hour H on day D of week, 0=Sun)
 *
 * @param cronExpression - Cron expression string
 * @param fromDate - Starting date (defaults to now)
 * @returns Next run time
 */
export const getNextRunTime = (
  cronExpression: string,
  fromDate: Date = new Date()
): Date => {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error('Invalid cron expression: must have 5 parts (minute hour day month weekday)');
  }

  const [minutePart, hourPart, _dayPart, _monthPart, weekdayPart] = parts;

  // Start from the next minute
  const next = new Date(fromDate);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);

  // Parse minute field
  let targetMinutes: number[];
  if (minutePart === '*') {
    // Every minute - use current minute
    targetMinutes = [next.getMinutes()];
  } else if (minutePart.startsWith('*/')) {
    // Every N minutes
    const interval = parseInt(minutePart.slice(2), 10);
    if (isNaN(interval) || interval <= 0) {
      throw new Error('Invalid minute interval in cron expression');
    }
    targetMinutes = [];
    for (let m = 0; m < 60; m += interval) {
      targetMinutes.push(m);
    }
  } else {
    // Specific minute
    const minute = parseInt(minutePart, 10);
    if (isNaN(minute) || minute < 0 || minute > 59) {
      throw new Error('Invalid minute value in cron expression');
    }
    targetMinutes = [minute];
  }

  // Parse hour field
  let targetHours: number[];
  if (hourPart === '*') {
    targetHours = Array.from({ length: 24 }, (_, i) => i);
  } else {
    const hour = parseInt(hourPart, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      throw new Error('Invalid hour value in cron expression');
    }
    targetHours = [hour];
  }

  // Parse weekday field
  let targetWeekdays: number[] | null = null;
  if (weekdayPart !== '*') {
    const weekday = parseInt(weekdayPart, 10);
    if (isNaN(weekday) || weekday < 0 || weekday > 6) {
      throw new Error('Invalid weekday value in cron expression');
    }
    targetWeekdays = [weekday];
  }

  // Find next matching time
  // Simple approach: iterate forward until we find a match (max 7 days)
  const maxIterations = 7 * 24 * 60; // 7 days worth of minutes
  let iterations = 0;

  while (iterations < maxIterations) {
    const currentMinute = next.getMinutes();
    const currentHour = next.getHours();
    const currentWeekday = next.getDay();

    // Check if current time matches all criteria
    const minuteMatches = targetMinutes.includes(currentMinute);
    const hourMatches = targetHours.includes(currentHour);
    const weekdayMatches = targetWeekdays === null || targetWeekdays.includes(currentWeekday);

    if (minuteMatches && hourMatches && weekdayMatches) {
      return next;
    }

    // Advance to next minute
    next.setMinutes(next.getMinutes() + 1);
    iterations++;
  }

  throw new Error('Could not compute next run time within 7 days');
};
