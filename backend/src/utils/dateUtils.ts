import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

export const TIMEZONE = 'Asia/Kolkata';

export const getDayjs = () => dayjs;

export const getTodayIST = (): string => {
  return dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
};

export const getCurrentMonthIST = (): string => {
  return dayjs().tz(TIMEZONE).format('YYYY-MM');
};

export const formatDateIST = (date: Date | string): string => {
  return dayjs(date).tz(TIMEZONE).format('YYYY-MM-DD');
};

export const getStartOfDayIST = (dateStr: string): Date => {
  return dayjs.tz(dateStr, TIMEZONE).startOf('day').toDate();
};

export const getEndOfDayIST = (dateStr: string): Date => {
  return dayjs.tz(dateStr, TIMEZONE).endOf('day').toDate();
};

/**
 * Parses user-provided date string or Date object.
 * If only a date string (YYYY-MM-DD) is provided:
 * - If today's date in IST, returns current exact time.
 * - If past/future date, sets to 12:00:00 IST to avoid timezone flipping across midnight.
 * If a full ISO or datetime string is provided, preserves the specified time.
 */
export const parseEntryDate = (dateInput?: string | Date): Date => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  const trimmed = dateInput.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const today = getTodayIST();
    if (trimmed === today) {
      return new Date();
    }
    return dayjs.tz(trimmed, TIMEZONE).hour(12).minute(0).second(0).toDate();
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};
