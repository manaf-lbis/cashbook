import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { TIMEZONE, getStartOfDayIST, getEndOfDayIST, getTodayIST, getCurrentMonthIST } from '../utils/dateUtils';
import { DayBookEntryModel } from '../models/DayBookEntry';
import { BillerModel } from '../models/Biller';
import { ApiError } from '../utils/ApiError';

export interface SalesReportFilter {
  startDate?: string;
  endDate?: string;
  billerId?: string;
  paymentMode?: string;
}

export class ReportService {
  async getSalesReport(filter: SalesReportFilter) {
    const today = getTodayIST();
    const currentMonthKey = getCurrentMonthIST();
    
    // Default range: Start of current month to today
    const defaultStart = `${currentMonthKey}-01`;
    const startDateStr = filter.startDate?.trim() || defaultStart;
    const endDateStr = filter.endDate?.trim() || today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      throw ApiError.badRequest('Invalid date format. Expected YYYY-MM-DD');
    }

    if (startDateStr > endDateStr) {
      throw ApiError.badRequest('startDate cannot be greater than endDate');
    }

    // Maximum report duration: 366 days
    const startDay = dayjs.tz(startDateStr, TIMEZONE);
    const endDay = dayjs.tz(endDateStr, TIMEZONE);
    if (endDay.diff(startDay, 'day') > 366) {
      throw ApiError.badRequest('Date range cannot exceed 366 days');
    }

    const startDateTime = getStartOfDayIST(startDateStr);
    const endDateTime = getEndOfDayIST(endDateStr);

    // Build query match criteria
    const matchCriteria: any = {
      date: { $gte: startDateTime, $lte: endDateTime },
      isDeleted: { $ne: true },
    };

    let selectedBiller: any = null;
    if (filter.billerId && filter.billerId !== 'ALL' && filter.billerId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(filter.billerId)) {
        throw ApiError.badRequest('Invalid billerId format');
      }
      matchCriteria.billerId = new mongoose.Types.ObjectId(filter.billerId);
      selectedBiller = await BillerModel.findById(filter.billerId).select('name phone role isActive totalSales');
    }

    if (filter.paymentMode && filter.paymentMode !== 'ALL' && filter.paymentMode !== 'all') {
      matchCriteria.paymentMode = filter.paymentMode;
    }

    // 1. Fetch all active billers for the filter dropdown
    const allBillers = await BillerModel.find().sort({ name: 1 }).select('name phone role isActive totalSales');

    // 2. Aggregations run in parallel:
    // a) Day-wise series aggregation
    // b) Salesperson breakdown aggregation
    // c) Payment mode breakdown aggregation
    // d) Overall total metrics
    const [dayWiseAgg, billerBreakdownAgg, paymentModeAgg, detailedEntries] = await Promise.all([
      // Day-wise aggregation
      DayBookEntryModel.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+05:30' } },
            totalSales: { $sum: '$amount' },
            totalBills: { $sum: 1 },
            highestSale: { $max: '$amount' },
            lowestSale: { $min: '$amount' },
            cashSales: {
              $sum: { $cond: [{ $eq: ['$paymentMode', 'CASH'] }, '$amount', 0] },
            },
            bankSales: {
              $sum: { $cond: [{ $eq: ['$paymentMode', 'BANK'] }, '$amount', 0] },
            },
            upiSales: {
              $sum: { $cond: [{ $eq: ['$paymentMode', 'UPI'] }, '$amount', 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Salesperson breakdown aggregation
      DayBookEntryModel.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$billerId',
            totalSales: { $sum: '$amount' },
            totalBills: { $sum: 1 },
            maxSale: { $max: '$amount' },
            minSale: { $min: '$amount' },
          },
        },
        {
          $lookup: {
            from: 'billers',
            localField: '_id',
            foreignField: '_id',
            as: 'biller',
          },
        },
        { $unwind: { path: '$biller', preserveNullAndEmptyArrays: true } },
        { $sort: { totalSales: -1 } },
      ]),

      // Payment Mode breakdown aggregation
      DayBookEntryModel.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$paymentMode',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Recent / detailed entries in the range (up to 300)
      DayBookEntryModel.find(matchCriteria)
        .sort({ date: -1, createdAt: -1 })
        .limit(300)
        .populate('billerId', 'name role')
        .populate('accountId', 'name')
        .lean(),
    ]);

    // Build continuous calendar days array so that graphs have no missing dates
    const dayMap = new Map<string, any>();
    for (const d of dayWiseAgg) {
      dayMap.set(d._id, d);
    }

    const totalDaysCount = endDay.diff(startDay, 'day') + 1;
    const dayWiseSeries: any[] = [];
    let totalPeriodSales = 0;
    let totalPeriodBills = 0;
    let highestDaySale = 0;
    let highestDayDate = '';
    let activeSellingDays = 0;

    for (let i = 0; i < totalDaysCount; i++) {
      const current = startDay.add(i, 'day');
      const dStr = current.format('YYYY-MM-DD');
      const aggData = dayMap.get(dStr);

      const sales = aggData?.totalSales || 0;
      const bills = aggData?.totalBills || 0;
      const avgBill = bills > 0 ? Math.round(sales / bills) : 0;

      if (sales > 0) {
        activeSellingDays++;
        if (sales > highestDaySale) {
          highestDaySale = sales;
          highestDayDate = dStr;
        }
      }

      totalPeriodSales += sales;
      totalPeriodBills += bills;

      dayWiseSeries.push({
        date: dStr,
        dayLabel: current.format('D MMM'),
        weekday: current.format('ddd'),
        formattedDate: current.format('ddd, D MMM YYYY'),
        totalSales: sales,
        totalBills: bills,
        averageBill: avgBill,
        highestSale: aggData?.highestSale || 0,
        lowestSale: aggData?.lowestSale || 0,
        cashSales: aggData?.cashSales || 0,
        bankSales: aggData?.bankSales || 0,
        upiSales: aggData?.upiSales || 0,
      });
    }

    // Format salesperson performance cards
    const salespersonRankings = billerBreakdownAgg.map((item) => {
      const sales = item.totalSales || 0;
      const bills = item.totalBills || 0;
      const percentage = totalPeriodSales > 0 ? Math.round((sales / totalPeriodSales) * 1000) / 10 : 0;
      return {
        billerId: item._id?.toString() || 'unknown',
        billerName: item.biller?.name || 'General Counter',
        billerRole: item.biller?.role || 'Salesperson',
        totalSales: sales,
        totalBills: bills,
        averageBill: bills > 0 ? Math.round(sales / bills) : 0,
        maxSale: item.maxSale || 0,
        minSale: item.minSale || 0,
        salesSharePercentage: percentage,
      };
    });

    // Format payment mode split
    const paymentModeBreakdown: Record<string, { totalAmount: number; count: number; percentage: number }> = {
      CASH: { totalAmount: 0, count: 0, percentage: 0 },
      BANK: { totalAmount: 0, count: 0, percentage: 0 },
      UPI: { totalAmount: 0, count: 0, percentage: 0 },
    };

    for (const pm of paymentModeAgg) {
      if (pm._id && paymentModeBreakdown[pm._id]) {
        paymentModeBreakdown[pm._id] = {
          totalAmount: pm.totalAmount,
          count: pm.count,
          percentage: totalPeriodSales > 0 ? Math.round((pm.totalAmount / totalPeriodSales) * 1000) / 10 : 0,
        };
      }
    }

    const overallAverageBill = totalPeriodBills > 0 ? Math.round(totalPeriodSales / totalPeriodBills) : 0;
    const dailyAverageSales = activeSellingDays > 0 ? Math.round(totalPeriodSales / activeSellingDays) : 0;

    return {
      filters: {
        startDate: startDateStr,
        endDate: endDateStr,
        billerId: filter.billerId || 'ALL',
        paymentMode: filter.paymentMode || 'ALL',
        selectedBillerName: selectedBiller ? selectedBiller.name : 'All Salespersons',
      },
      summary: {
        totalSales: totalPeriodSales,
        totalBills: totalPeriodBills,
        averageBill: overallAverageBill,
        dailyAverageSales,
        highestDaySale,
        highestDayDate,
        activeSellingDays,
        totalCalendarDays: totalDaysCount,
        topSalesperson: salespersonRankings[0] || null,
      },
      availableBillers: allBillers,
      salespersonRankings,
      paymentModeBreakdown,
      dayWiseSeries,
      recentEntries: detailedEntries,
    };
  }
}
