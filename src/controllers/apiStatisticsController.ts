import { Request, Response } from "express";
import { apiStatisticsService } from "../services/apiStatisticsService";
import { ApiStatType } from "../models/ApiStatistics";
import { ApiResponse } from "../types";
import { asyncHandler } from "../types/controller";
import DateTime from "../utils/datetime";

/**
 * 查询API统计数据
 */
export const getApiStatistics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      startTime,
      endTime,
      statType,
      method,
      host,
      path,
      appid,
      enterprise_id,
      status_code,
      limit = 100,
      offset = 0,
    } = req.query;

    try {
      const result = await apiStatisticsService.getStatistics({
        startTime: startTime as string,
        endTime: endTime as string,
        statType: statType as ApiStatType,
        method: method as string,
        host: host as string,
        path: path as string,
        appid: appid as string,
        enterprise_id: enterprise_id as string,
        status_code: status_code ? parseInt(status_code as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });

      const response: ApiResponse = {
        code: 1,
        message: `成功获取${result.data.length}条API统计记录`,
        data: {
          statistics: result.data,
          total: result.total,
          pagination: {
            limit: parseInt((limit as string) || "100"),
            offset: parseInt((offset as string) || "0"),
            hasMore:
              result.total >
              parseInt((offset as string) || "0") + result.data.length,
          },
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 查询API统计数据失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "查询API统计数据失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 获取API聚合统计数据
 */
export const getApiAggregatedStatistics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      startTime,
      endTime,
      statType,
      groupBy = "method",
      limit = 50,
    } = req.query;

    try {
      const result = await apiStatisticsService.getAggregatedStatistics({
        startTime: startTime as string,
        endTime: endTime as string,
        statType: statType as ApiStatType,
        groupBy: groupBy as
          | "method"
          | "host"
          | "path"
          | "appid"
          | "enterprise_id"
          | "status_code",
        limit: limit ? parseInt(limit as string) : 50,
      });

      const response: ApiResponse = {
        code: 1,
        message: `成功获取API聚合统计数据，按${groupBy}分组`,
        data: {
          aggregatedData: result.data,
          groupBy: groupBy,
          total: result.total,
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 获取API聚合统计数据失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "获取API聚合统计数据失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 获取API统计概览
 */
export const getApiStatisticsOverview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { startTime, endTime, statType = "day" } = req.query;

    try {
      // 并行获取多种聚合数据
      const [methodStats, hostStats, statusCodeStats, pathStats] =
        await Promise.all([
          apiStatisticsService.getAggregatedStatistics({
            startTime: startTime as string,
            endTime: endTime as string,
            statType: statType as ApiStatType,
            groupBy: "method",
            limit: 10,
          }),
          apiStatisticsService.getAggregatedStatistics({
            startTime: startTime as string,
            endTime: endTime as string,
            statType: statType as ApiStatType,
            groupBy: "host",
            limit: 10,
          }),
          apiStatisticsService.getAggregatedStatistics({
            startTime: startTime as string,
            endTime: endTime as string,
            statType: statType as ApiStatType,
            groupBy: "status_code",
            limit: 10,
          }),
          apiStatisticsService.getAggregatedStatistics({
            startTime: startTime as string,
            endTime: endTime as string,
            statType: statType as ApiStatType,
            groupBy: "path",
            limit: 20,
          }),
        ]);

      const response: ApiResponse = {
        code: 1,
        message: "成功获取API统计概览",
        data: {
          overview: {
            byMethod: methodStats.data,
            byHost: hostStats.data,
            byStatusCode: statusCodeStats.data,
            byPath: pathStats.data,
          },
          summary: {
            totalRequests: methodStats.total,
            totalHosts: hostStats.data.length,
            totalPaths: pathStats.data.length,
          },
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 获取API统计概览失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "获取API统计概览失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 获取API时间序列数据
 */
export const getApiTimeSeriesData = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      startDate,
      endDate,
      statType = "day",
      method,
      host,
      appid,
      enterprise_id,
      limit = 100,
    } = req.query;

    try {
      const result = await apiStatisticsService.getStatistics({
        startTime: startDate ? `${startDate} 00:00:00` : undefined,
        endTime: endDate ? `${endDate} 23:59:59` : undefined,
        statType: statType as ApiStatType,
        method: method as string,
        host: host as string,
        appid: appid as string,
        enterprise_id: enterprise_id as string,
        limit: limit ? parseInt(limit as string) : 100,
      });

      // 按时间分组汇总
      const timeSeriesMap = new Map<
        string,
        {
          date: string;
          totalRequests: number;
          avgResponseTime: number;
          errorRate: number;
          totalErrors: number;
        }
      >();

      result.data.forEach((stat) => {
        const dateKey = stat.stat_time.split("T")[0]; // 获取日期部分
        const existing = timeSeriesMap.get(dateKey);

        if (existing) {
          existing.totalRequests += stat.request_count;
          existing.totalErrors += stat.error_count;
          existing.avgResponseTime =
            (existing.avgResponseTime + stat.avg_response_time) / 2;
          existing.errorRate =
            existing.totalRequests > 0
              ? (existing.totalErrors / existing.totalRequests) * 100
              : 0;
        } else {
          timeSeriesMap.set(dateKey, {
            date: dateKey,
            totalRequests: stat.request_count,
            avgResponseTime: stat.avg_response_time,
            errorRate: stat.error_rate,
            totalErrors: stat.error_count,
          });
        }
      });

      const timeSeriesData = Array.from(timeSeriesMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const response: ApiResponse = {
        code: 1,
        message: "成功获取API时间序列数据",
        data: {
          timeSeries: timeSeriesData,
          statType,
          dateRange: {
            start: startDate,
            end: endDate,
          },
          filters: {
            method,
            host,
            appid,
            enterprise_id,
          },
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 获取API时间序列数据失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "获取API时间序列数据失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 手动更新API统计数据
 */
export const updateApiStatistics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { statType, targetTime } = req.body;

    if (!statType || !Object.values(ApiStatType).includes(statType)) {
      const response: ApiResponse = {
        code: 0,
        message: `statType必须是以下值之一: ${Object.values(ApiStatType).join(
          ", "
        )}`,
      };
      res.status(400).json(response);
      return;
    }

    try {
      const target = targetTime ? new Date(targetTime) : undefined;
      await apiStatisticsService.updateStatistics(statType, target);

      const response: ApiResponse = {
        code: 1,
        message: `API ${statType} 统计数据更新成功`,
        data: {
          statType,
          targetTime: target?.toISOString() || new Date().toISOString(),
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error(`❌ 更新API ${statType} 统计数据失败:`, error);

      const response: ApiResponse = {
        code: 0,
        message: `更新API ${statType} 统计数据失败`,
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 批量更新所有类型的API统计数据
 */
export const updateAllApiStatistics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { targetTime } = req.body;

    try {
      const target = targetTime ? new Date(targetTime) : undefined;
      await apiStatisticsService.updateAllStatistics(target);

      const response: ApiResponse = {
        code: 1,
        message: "所有API统计数据更新成功",
        data: {
          updatedTypes: Object.values(ApiStatType),
          targetTime: target?.toISOString() || new Date().toISOString(),
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 批量更新API统计数据失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "批量更新API统计数据失败",
      };

      res.status(500).json(response);
    }
  }
);
