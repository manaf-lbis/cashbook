import axios from 'axios';
import { ApiResponse } from '../types';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cashbook_auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cashbook_auth_token');
      localStorage.removeItem('cashbook_user');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    const message =
      error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);


export const formatINR = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const getLocalDateString = (d: Date | string = new Date()): string => {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalTimeString = (d: Date | string = new Date()): string => {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const addDaysToDateString = (dateStr: string, days: number): string => {
  if (!dateStr) return getLocalDateString();
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
};

export const parseLocalDate = (dateInput: string | Date): Date => {
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [year, month, day] = dateInput.trim().split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  return new Date(dateInput);
};

export const formatDate = (dateStr?: string | Date): string => {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatTime = (dateStr?: string | Date): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatDateTime = (dateStr?: string | Date): string => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return formatDate(dateStr);
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Extracts creation timestamp from a 24-character hexadecimal MongoDB ObjectId.
 * The first 4 bytes (8 hex characters) encode the Unix timestamp in seconds.
 */
export const getTimestampFromObjectId = (id?: string): Date | null => {
  if (!id || typeof id !== 'string') return null;
  const cleanId = id.trim();
  if (!/^[0-9a-fA-F]{24}$/.test(cleanId)) return null;
  try {
    const seconds = parseInt(cleanId.substring(0, 8), 16);
    if (isNaN(seconds) || seconds < 1577836800) {
      return null;
    }
    const d = new Date(seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

/**
 * Combines a local date string (YYYY-MM-DD) and optional time string (HH:mm)
 * into a valid Date object without string-parsing or timezone quirks.
 */
export const combineDateAndTime = (dateStr: string, timeStr?: string): Date => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  if (timeStr && timeStr.includes(':')) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours || 0, minutes || 0, 0);
  }
  const today = getLocalDateString();
  if (dateStr === today) {
    const now = new Date();
    return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
  }
  return new Date(year, month - 1, day, 12, 0, 0);
};

/**
 * Determines whether a date object represents midnight UTC (00:00:00.000Z),
 * which is the default artifact of date-only pickers. In India (UTC+5:30),
 * this incorrectly shows as 05:30 am.
 */
export const isMidnightUtc = (d: Date): boolean => {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0
  );
};

/**
 * Accurately formats an entry timestamp.
 * - If `date` has a real time (not midnight UTC), formats `date`.
 * - If `date` is midnight UTC (e.g. 05:30 am in IST), but `createdAt` has a real time,
 *   combines the calendar date with `createdAt`'s time.
 * - If both are midnight UTC or `createdAt` is missing, checks `entryId` (MongoDB ObjectId)
 *   to extract the true second of creation.
 * - If no real time is available at all, returns ONLY the calendar date (e.g. "07 Oct 2026")
 *   so users never see the misleading "05:30 am".
 */
export const formatEntryDateTime = (
  dateStr?: string | Date,
  createdAtStr?: string | Date,
  entryId?: string
): string => {
  if (!dateStr && !createdAtStr && !entryId) return '';

  const dateObj = dateStr ? new Date(dateStr) : undefined;
  const isDateValid = !!(dateObj && !isNaN(dateObj.getTime()));

  // 1. If dateObj has a real, explicit time (not midnight UTC), format it directly
  if (isDateValid && !isMidnightUtc(dateObj)) {
    return formatDateTime(dateObj);
  }

  // 2. If dateObj was stored as midnight UTC (or missing), check createdAt
  if (createdAtStr) {
    const createdObj = new Date(createdAtStr);
    if (!isNaN(createdObj.getTime()) && !isMidnightUtc(createdObj)) {
      const dayPart = formatDate(dateObj || createdObj);
      const timePart = formatTime(createdObj);
      return `${dayPart}, ${timePart}`;
    }
  }

  // 3. Check MongoDB ObjectId timestamp from entryId
  if (entryId) {
    const idDate = getTimestampFromObjectId(entryId);
    if (idDate && !isMidnightUtc(idDate)) {
      const dayPart = formatDate(dateObj || idDate);
      const timePart = formatTime(idDate);
      return `${dayPart}, ${timePart}`;
    }
  }

  // 4. Fallback: Show ONLY the calendar date. Never display misleading "05:30 am"!
  if (isDateValid) {
    return formatDate(dateObj);
  }

  if (createdAtStr) {
    const createdObj = new Date(createdAtStr);
    if (!isNaN(createdObj.getTime())) return formatDate(createdObj);
  }

  return '';
};

/**
 * Helper for edit modals to populate initial date and time fields without
 * accidentally defaulting to "05:30" due to midnight UTC storage.
 */
export const getEffectiveEntryDateAndTime = (
  dateStr?: string | Date,
  createdAtStr?: string | Date,
  entryId?: string
): { date: string; time: string } => {
  const dateObj = dateStr ? new Date(dateStr) : undefined;
  const isDateValid = !!(dateObj && !isNaN(dateObj.getTime()));

  const dateString = isDateValid ? getLocalDateString(dateObj) : getLocalDateString();

  if (isDateValid && !isMidnightUtc(dateObj)) {
    return { date: dateString, time: getLocalTimeString(dateObj) };
  }

  if (createdAtStr) {
    const createdObj = new Date(createdAtStr);
    if (!isNaN(createdObj.getTime()) && !isMidnightUtc(createdObj)) {
      return { date: dateString, time: getLocalTimeString(createdObj) };
    }
  }

  if (entryId) {
    const idDate = getTimestampFromObjectId(entryId);
    if (idDate && !isMidnightUtc(idDate)) {
      return { date: dateString, time: getLocalTimeString(idDate) };
    }
  }

  return { date: dateString, time: getLocalTimeString() };
};

/**
 * Extracts a normalized local calendar date key ('YYYY-MM-DD') for an entry,
 * prioritizing the user's recorded date or creation timestamp.
 */
export const getEntryDateKey = (
  dateStr?: string | Date,
  createdAtStr?: string | Date,
  entryId?: string
): string => {
  if (!dateStr && !createdAtStr && !entryId) return '';

  const dateObj = dateStr ? new Date(dateStr) : undefined;
  const isDateValid = !!(dateObj && !isNaN(dateObj.getTime()));

  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }

  if (isDateValid && !isMidnightUtc(dateObj)) {
    return getLocalDateString(dateObj);
  }

  if (createdAtStr) {
    const createdObj = new Date(createdAtStr);
    if (!isNaN(createdObj.getTime())) {
      return getLocalDateString(createdObj);
    }
  }

  if (entryId) {
    const idDate = getTimestampFromObjectId(entryId);
    if (idDate) {
      return getLocalDateString(idDate);
    }
  }

  if (isDateValid) {
    return getLocalDateString(dateObj);
  }

  return '';
};

/**
 * Formats a calendar date string (YYYY-MM-DD) into a user-friendly day separator label:
 * - "Today, 08 Oct 2026"
 * - "Yesterday, 07 Oct 2026"
 * - "Wed, 07 Oct 2026" (for older days)
 */
export const formatDaySeparatorLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d, 12, 0, 0);
  if (isNaN(targetDate.getTime())) return '';

  const todayStr = getLocalDateString(new Date());
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = getLocalDateString(yest);

  const formatted = targetDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (dateStr === todayStr) {
    return `Today, ${formatted}`;
  }
  if (dateStr === yesterdayStr) {
    return `Yesterday, ${formatted}`;
  }

  const weekday = targetDate.toLocaleDateString('en-IN', { weekday: 'short' });
  return `${weekday}, ${formatted}`;
};
