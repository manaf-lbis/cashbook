import dayjs from 'dayjs';
import { DailyClosingModel } from '../models/DailyClosing';
import { ApiError } from '../utils/ApiError';

export interface ILockStatus {
  isLocked: boolean;
  reason?: string;
  closedAt?: Date;
  closingDate?: string;
}

export class ReconciliationLockService {
  /**
   * Checks whether an entry is locked due to daily closing/reconciliation.
   *
   * Rules:
   * 1. If the entry's date matches a Daily Closing on that day:
   *    - If entry creation time <= closing.closedAt: LOCKED (reconciled in that closing).
   *    - If entry creation time > closing.closedAt:
   *      - If there is a later closing on a subsequent date: LOCKED (past period closed).
   *      - If no later closing exists: UNLOCKED (active post-reconciliation entry).
   * 2. If the entry's date has no closing, but a later closing exists on a subsequent date:
   *    - LOCKED (unclosed past date prior to a finalized closing).
   * 3. If no closing on this date or any later date:
   *    - UNLOCKED (currently open period).
   */
  static async checkLockStatus(
    entryDate: Date | string,
    entryCreatedAt?: Date | string
  ): Promise<ILockStatus> {
    const entryDateStr = dayjs(entryDate).format('YYYY-MM-DD');
    const entryTime = entryCreatedAt ? new Date(entryCreatedAt).getTime() : new Date(entryDate).getTime();

    // 1. Check if there is a daily closing for this exact date
    const closingOnDate = await DailyClosingModel.findOne({ date: entryDateStr });
    if (closingOnDate && closingOnDate.closedAt) {
      const closedAtTime = new Date(closingOnDate.closedAt).getTime();

      if (entryTime <= closedAtTime) {
        const timeFormatted = dayjs(closingOnDate.closedAt).format('hh:mm A');
        return {
          isLocked: true,
          reason: `Locked: This entry was reconciled in Daily Closing on ${entryDateStr} at ${timeFormatted}. Modifying or deleting entries recorded prior to reconciliation is blocked to preserve audit integrity.`,
          closedAt: closingOnDate.closedAt,
          closingDate: entryDateStr,
        };
      }

      // Entry created AFTER closing on the same day:
      // Check if a later closing exists on a subsequent date
      const laterClosing = await DailyClosingModel.findOne({ date: { $gt: entryDateStr } }).sort({ date: 1 });
      if (laterClosing && laterClosing.closedAt) {
        const laterTimeFormatted = dayjs(laterClosing.closedAt).format('hh:mm A');
        return {
          isLocked: true,
          reason: `Locked: This entry belongs to a past period that was subsequently closed on ${laterClosing.date} (${laterTimeFormatted}). Modifying or deleting past entries is blocked.`,
          closedAt: laterClosing.closedAt,
          closingDate: laterClosing.date,
        };
      }

      // No later closing exists -> UNLOCKED
      return { isLocked: false };
    }

    // 2. No closing for this exact date:
    // Check if any closing exists on a LATER date
    const laterClosing = await DailyClosingModel.findOne({ date: { $gt: entryDateStr } }).sort({ date: 1 });
    if (laterClosing && laterClosing.closedAt) {
      const laterTimeFormatted = dayjs(laterClosing.closedAt).format('hh:mm A');
      return {
        isLocked: true,
        reason: `Locked: This entry belongs to a past unclosed period prior to Daily Closing on ${laterClosing.date} (${laterTimeFormatted}). Modifying or deleting past entries is blocked.`,
        closedAt: laterClosing.closedAt,
        closingDate: laterClosing.date,
      };
    }

    // 3. No closing on or after this entry -> UNLOCKED
    return { isLocked: false };
  }

  /**
   * Asserts that an entry is NOT locked. Throws ApiError.badRequest if locked.
   */
  static async assertNotLocked(entryDate: Date | string, entryCreatedAt?: Date | string) {
    const status = await this.checkLockStatus(entryDate, entryCreatedAt);
    if (status.isLocked) {
      throw ApiError.badRequest(
        status.reason ||
          'This entry is locked after daily closing / reconciliation and cannot be modified or deleted.'
      );
    }
  }

  /**
   * Asserts that a new entry cannot be inserted into a past closed period.
   * Creating entries on today's active date is always allowed.
   */
  static async assertCanCreateEntry(targetDate: Date | string) {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const targetDateStr = dayjs(targetDate).format('YYYY-MM-DD');

    // Creating entries on today is always permitted
    if (targetDateStr === todayStr) {
      return;
    }

    // If target date is in the past: check if it's already closed
    const closing = await DailyClosingModel.findOne({ date: targetDateStr });
    if (closing) {
      throw ApiError.badRequest(
        `Cannot record entries into a past closed day (${targetDateStr}). Daily Closing for this date has already been reconciled.`
      );
    }

    // Check if any closing on a later date has already finalized
    const laterClosing = await DailyClosingModel.findOne({ date: { $gt: targetDateStr } }).sort({ date: 1 });
    if (laterClosing) {
      throw ApiError.badRequest(
        `Cannot record entries into ${targetDateStr}. A subsequent Daily Closing on ${laterClosing.date} has already finalized the ledger.`
      );
    }
  }

  /**
   * Batch checks lock status for an array of entries.
   * Returns a Set of entry IDs that are locked.
   */
  static async getLockedEntryIds(
    entries: Array<{ _id?: any; date: Date | string; createdAt?: Date | string }>
  ): Promise<Set<string>> {
    const lockedIds = new Set<string>();
    if (!entries || entries.length === 0) return lockedIds;

    const closings = await DailyClosingModel.find().sort({ date: 1 });
    if (closings.length === 0) return lockedIds;

    const closingMap = new Map<string, { date: string; closedAt: Date }>();
    let maxClosingDate = '';

    for (const c of closings) {
      if (c.closedAt) {
        closingMap.set(c.date, { date: c.date, closedAt: new Date(c.closedAt) });
        if (!maxClosingDate || c.date > maxClosingDate) {
          maxClosingDate = c.date;
        }
      }
    }

    for (const entry of entries) {
      const entryId = entry._id?.toString();
      if (!entryId) continue;

      const entryDateStr = dayjs(entry.date).format('YYYY-MM-DD');
      const entryTime = entry.createdAt
        ? new Date(entry.createdAt).getTime()
        : new Date(entry.date).getTime();

      const sameDayClosing = closingMap.get(entryDateStr);
      if (sameDayClosing) {
        if (entryTime <= sameDayClosing.closedAt.getTime()) {
          lockedIds.add(entryId);
          continue;
        }
        // Entry created after same-day closing: locked if a subsequent day was closed
        if (maxClosingDate > entryDateStr) {
          lockedIds.add(entryId);
        }
      } else {
        // No closing on this day: locked if any later day was closed
        if (maxClosingDate > entryDateStr) {
          lockedIds.add(entryId);
        }
      }
    }

    return lockedIds;
  }
}
