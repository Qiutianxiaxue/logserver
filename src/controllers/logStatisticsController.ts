import { Request, Response } from "express";
import {
  logStatisticsService,
  StatisticsQueryOptions,
} from "../services/logStatisticsService";
import { StatType } from "../models/LogStatistics";
import { formatResponse } from "../utils/responseFormatter";

/**
 * 日志统计控制器
 */
export class LogStatisticsController {
  /**
   * 查询统计数据
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const options: StatisticsQueryOptions = {
        startTime: req.query.startTime as string,
        endTime: req.query.endTime as string,
        statType: req.query.statType as StatType,
        enterprise_id: req.query.enterprise_id as string,
        appid: req.query.appid as string,
        service: req.query.service as string,
        level: req.query.level as string,
        log_type: req.query.log_type as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await logStatisticsService.getStatistics(options);

      res.json(formatResponse(1, result, "查询成功"));
    } catch (error) {
      console.error("查询统计数据失败:", error);
      res
        .status(500)
        .json(formatResponse(0, null, `查询失败: ${(error as Error).message}`));
    }
  }

  /**
   * 获取聚合统计数据
   */
  async getAggregatedStatistics(req: Request, res: Response) {
    try {
      const options: StatisticsQueryOptions & {
        groupBy?:
          | "stat_time"
          | "service"
          | "level"
          | "appid"
          | "enterprise_id"
          | "log_type";
      } = {
        startTime: req.query.startTime as string,
        endTime: req.query.endTime as string,
        statType: req.query.statType as StatType,
        enterprise_id: req.query.enterprise_id as string,
        appid: req.query.appid as string,
        service: req.query.service as string,
        level: req.query.level as string,
        log_type: req.query.log_type as string,
        groupBy: req.query.groupBy as any,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      };

      const result = await logStatisticsService.getAggregatedStatistics(
        options
      );

      res.json(formatResponse(1, result, "查询成功"));
    } catch (error) {
      console.error("查询聚合统计数据失败:", error);
      res
        .status(500)
        .json(formatResponse(0, null, `查询失败: ${(error as Error).message}`));
    }
  }

  /**
   * 手动更新统计数据
   */
  async updateStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { statType, targetTime } = req.body;

      if (!statType || !Object.values(StatType).includes(statType)) {
        res.status(400).json(formatResponse(0, null, "请提供有效的统计类型"));
        return;
      }

      const targetDate = targetTime ? new Date(targetTime) : undefined;

      await logStatisticsService.updateStatistics(statType, targetDate);

      res.json(formatResponse(1, null, "统计数据更新成功"));
    } catch (error) {
      console.error("更新统计数据失败:", error);
      res
        .status(500)
        .json(formatResponse(0, null, `更新失败: ${(error as Error).message}`));
    }
  }

  /**
   * 批量更新所有类型的统计数据
   */
  async updateAllStatistics(req: Request, res: Response) {
    try {
      const { targetTime } = req.body;
      const targetDate = targetTime ? new Date(targetTime) : undefined;

      await logStatisticsService.updateAllStatistics(targetDate);

      res.json(formatResponse(1, null, "所有统计数据更新成功"));
    } catch (error) {
      console.error("批量更新统计数据失败:", error);
      res
        .status(500)
        .json(formatResponse(0, null, `更新失败: ${(error as Error).message}`));
    }
  }

  /**
   * 获取统计概览
   */
  async getStatisticsOverview(req: Request, res: Response) {
    try {
      const { startTime, endTime, enterprise_id, appid } = req.query;

      const baseOptions = {
        startTime: startTime as string,
        endTime: endTime as string,
        enterprise_id: enterprise_id as string,
        appid: appid as string,
        limit: 10,
      };

      // 并行获取不同维度的统计数据
      const [
        levelStats,
        serviceStats,
        logTypeStats,
        appidStats,
        enterpriseStats,
      ] = await Promise.all([
        logStatisticsService.getAggregatedStatistics({
          ...baseOptions,
          groupBy: "level",
        }),
        logStatisticsService.getAggregatedStatistics({
          ...baseOptions,
          groupBy: "service",
        }),
        logStatisticsService.getAggregatedStatistics({
          ...baseOptions,
          groupBy: "log_type",
        }),
        logStatisticsService.getAggregatedStatistics({
          ...baseOptions,
          groupBy: "appid",
        }),
        logStatisticsService.getAggregatedStatistics({
          ...baseOptions,
          groupBy: "enterprise_id",
        }),
      ]);

      const overview = {
        levelStats,
        serviceStats,
        logTypeStats,
        appidStats,
        enterpriseStats,
      };

      res.json(formatResponse(1, overview, "查询成功"));
    } catch (error) {
      console.error("查询统计概览失败:", error);
      res
        .status(500)
        .json(formatResponse(0, null, `查询失败: ${(error as Error).message}`));
    }
  }

  /**
   * 获取时间序列统计数据
   */
  async getTimeSeriesStatistics(req: Request, res: Response) {
    try {
      const {
        startTime,
        endTime,
        statType = StatType.HOUR,
        enterprise_id,
        appid,
        service,
        level,
        log_type,
      } = req.query;

      const options: StatisticsQueryOptions = {
        startTime: startTime as string,
        endTime: endTime as string,
        statType: statType as StatType,
        enterprise_id: enterprise_id as string,
        appid: appid as string,
        service: service as string,
        level: level as string,
        log_type: log_type as string,
        limit: 1000, // 时间序列数据可能需要更多记录
      };

      const result = await logStatisticsService.getAggregatedStatistics({
        ...options,
        groupBy: "stat_time",
      });

      res.json(formatResponse(1, result, "查询成功"));
    } catch (error) {
      console.error("查询时间序列统计数据失败:", error);
      res
        .status(500)
        .json(formatResponse(0, null, `查询失败: ${(error as Error).message}`));
    }
  }
}

// 导出控制器实例
export const logStatisticsController = new LogStatisticsController();
