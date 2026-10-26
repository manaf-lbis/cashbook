import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/ReportService';
import { ApiResponse } from '../utils/ApiResponse';

export class ReportController {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  getSalesReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, billerId, paymentMode } = req.query;

      const reportData = await this.reportService.getSalesReport({
        startDate: startDate as string,
        endDate: endDate as string,
        billerId: billerId as string,
        paymentMode: paymentMode as string,
      });

      return ApiResponse.success(res, reportData, 'Sales report computed successfully');
    } catch (err) {
      next(err);
    }
  };

  exportSalesReportCSV = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, billerId, paymentMode } = req.query;

      const reportData = await this.reportService.getSalesReport({
        startDate: startDate as string,
        endDate: endDate as string,
        billerId: billerId as string,
        paymentMode: paymentMode as string,
      });

      // Generate CSV text
      const csvLines: string[] = [];
      csvLines.push(`"SALES REPORT"`);
      csvLines.push(`"Date Range","${reportData.filters.startDate} to ${reportData.filters.endDate}"`);
      csvLines.push(`"Salesperson","${reportData.filters.selectedBillerName}"`);
      csvLines.push(`"Total Sales (INR)","${reportData.summary.totalSales}"`);
      csvLines.push(`"Total Bills","${reportData.summary.totalBills}"`);
      csvLines.push(`"Average Bill (INR)","${reportData.summary.averageBill}"`);
      csvLines.push('');
      csvLines.push('"DAY-WISE SALES BREAKDOWN"');
      csvLines.push('"Date","Day","Bills Count","Total Sales (INR)","Average Bill (INR)","Cash (INR)","Bank (INR)","UPI (INR)"');

      for (const day of reportData.dayWiseSeries) {
        csvLines.push(
          `"${day.date}","${day.weekday}","${day.totalBills}","${day.totalSales}","${day.averageBill}","${day.cashSales}","${day.bankSales}","${day.upiSales}"`
        );
      }

      csvLines.push('');
      csvLines.push('"SALESPERSON RANKING & PERFORMANCE"');
      csvLines.push('"Salesperson","Role","Bills Count","Total Sales (INR)","Average Bill (INR)","Share %"');

      for (const sp of reportData.salespersonRankings) {
        csvLines.push(
          `"${sp.billerName}","${sp.billerRole}","${sp.totalBills}","${sp.totalSales}","${sp.averageBill}","${sp.salesSharePercentage}%"`
        );
      }

      const csvContent = csvLines.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sales-report-${reportData.filters.startDate}-to-${reportData.filters.endDate}.csv"`
      );
      return res.status(200).send(csvContent);
    } catch (err) {
      next(err);
    }
  };
}
