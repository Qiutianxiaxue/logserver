import { Request, Response } from "express";
import { insertLog, queryLogs, getLogStats } from "../config/database";
import { LogData, LogQueryOptions, ApiResponse } from "../types";
import { asyncHandler } from "../types/controller";
import DateTime from "../utils/datetime";
import { ResponseFormatter } from "../utils/responseFormatter";
import { LogCache } from "../utils/logCache";
import { DatabaseHealth } from "../utils/databaseHealth";
import { logger } from "../utils/logger";

/**
 * 查询日志列表
 */
export const getLogs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const queryParams = req.body;

    const options: LogQueryOptions = {
      limit: queryParams.limit ? parseInt(queryParams.limit as string) : 100,
      offset: queryParams.offset ? parseInt(queryParams.offset as string) : 0,
      level: (queryParams.level as string) || undefined,
      log_type: (queryParams.log_type as string) || undefined,
      service: (queryParams.service as string) || undefined,
      service_name: (queryParams.service_name as string) || undefined,
      service_ip: (queryParams.service_ip as string) || undefined,
      appid: (queryParams.appid as string) || undefined,
      enterprise_id: (queryParams.enterprise_id as string) || undefined,
      user_id: (queryParams.user_id as string) || undefined,
      startTime: (queryParams.startTime as string) || undefined,
      endTime: (queryParams.endTime as string) || undefined,
      keyword: (queryParams.keyword as string) || undefined,
    };

    const logs = await queryLogs(options);

    const response: ApiResponse<{
      logs: LogData[];
      count: number;
      environment: string;
      timestamp: string;
    }> = {
      code: 1,
      message: `成功获取${logs.length}条日志记录`,
      data: {
        logs: ResponseFormatter.formatLogList(logs),
        count: logs.length,
        environment: NODE_ENV,
        timestamp: DateTime.now(),
      },
    };

    res.json(response);
  }
);

/**
 * 创建日志记录
 */
export const createLog = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const body = req.body;

    // 数据验证
    if (!body.message) {
      const response: ApiResponse = {
        code: 0,
        message: "日志消息不能为空",
      };
      res.status(400).json(response);
      return;
    }

    // 验证时间戳格式（如果提供）
    let timestamp = DateTime.toClickHouseFormat(); // 默认使用当前时间，ClickHouse兼容格式
    if (body.timestamp) {
      if (DateTime.isValid(body.timestamp)) {
        timestamp = DateTime.toClickHouseFormat(body.timestamp);
      } else {
        const response: ApiResponse = {
          code: 0,
          message: "时间戳格式无效，支持格式: YYYY-MM-DD HH:mm:ss 或 ISO 8601",
        };
        res.status(400).json(response);
        return;
      }
    }

    // 构建日志数据
    const level = body.level || "info";
    const validLevels = ["info", "debug", "warn", "error"];
    const logData: LogData = {
      level: validLevels.includes(level)
        ? (level as "info" | "debug" | "warn" | "error")
        : "info",
      log_type: String(body.log_type || "application"),
      message: String(body.message || ""),
      service: String(body.service || "unknown"),
      service_name: String(body.service_name || ""),
      service_ip: String(body.service_ip || ""),
      appid: String(body.appid || ""),
      enterprise_id: String(body.enterprise_id || ""),
      user_id: String(body.user_id || ""),
      extra_data: body.extra_data || {},
      timestamp: timestamp,
    };

    // 检查数据库健康状态并决定写入策略
    const databaseHealth = DatabaseHealth.getInstance();
    const logCache = LogCache.getInstance();

    // 主动检查数据库健康状态
    if (!databaseHealth.getHealthStatus().isHealthy) {
      // 数据库不健康，直接缓存
      logger.warnSync("⚠️ 数据库不健康，直接缓存日志");

      try {
        await logCache.addToCache(logData);

        const cacheInfo = await logCache.getCacheInfo();

        const response: ApiResponse = {
          code: 1,
          message: "数据库暂时不可用，日志已缓存到本地",
          data: {
            cached: true,
            totalCached: cacheInfo.count,
            timestamp: DateTime.now(),
          },
        };

        res.json(response);
        return;
      } catch (cacheError) {
        logger.errorSync("❌ 缓存日志失败:", {
          error: (cacheError as Error).message,
        });

        const response: ApiResponse = {
          code: 0,
          message: "日志存储失败，数据库和缓存都不可用",
        };

        res.status(500).json(response);
        return;
      }
    }

    // 数据库健康，尝试直接写入
    try {
      await insertLog(logData);

      if (NODE_ENV === "development") {
        logger.debugSync("✅ 日志已存储:", logData);
      }

      // 数据库写入成功，检查并处理缓存中的待处理日志
      const cacheInfo = await logCache.getCacheInfo();
      if (cacheInfo.count > 0) {
        logger.infoSync(
          `📦 检测到 ${cacheInfo.count} 条缓存日志，触发后台处理...`
        );
        // 异步处理缓存，不阻塞当前响应
        databaseHealth.triggerCacheProcessing().catch((error) => {
          logger.errorSync("❌ 后台处理缓存失败:", { error: error.message });
        });
      }

      const response: ApiResponse = {
        code: 1,
        message: "日志已成功存储",
        data: {
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      // 数据库插入失败，尝试缓存
      logger.warnSync("⚠️ 数据库写入失败，转为缓存模式:", {
        error: (error as Error).message,
      });

      try {
        await logCache.addToCache(logData);

        const cacheInfo = await logCache.getCacheInfo();

        const response: ApiResponse = {
          code: 1,
          message: "数据库暂时不可用，日志已缓存到本地",
          data: {
            cached: true,
            totalCached: cacheInfo.count,
            timestamp: DateTime.now(),
          },
        };

        res.json(response);
      } catch (cacheError) {
        // 缓存也失败了
        logger.errorSync("❌ 缓存日志也失败:", {
          error: (cacheError as Error).message,
        });

        const response: ApiResponse = {
          code: 0,
          message: "日志存储失败，数据库和缓存都不可用",
        };

        res.status(500).json(response);
      }
    }
  }
);

/**
 * 获取缓存状态信息
 */
export const getCacheStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const logCache = LogCache.getInstance();
    const databaseHealth = DatabaseHealth.getInstance();

    const cacheInfo = await logCache.getCacheInfo();
    const healthStatus = databaseHealth.getHealthStatus();

    const response: ApiResponse = {
      code: 1,
      message: "缓存状态查询成功",
      data: {
        cache: cacheInfo,
        database: healthStatus,
        timestamp: DateTime.now(),
      },
    };

    res.json(response);
  }
);

/**
 * 手动触发缓存处理
 */
export const processCachedLogs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const databaseHealth = DatabaseHealth.getInstance();

    // 强制检查数据库健康状态
    const isHealthy = await databaseHealth.checkDatabaseConnection();

    if (!isHealthy) {
      const response: ApiResponse = {
        code: 0,
        message: "数据库连接不可用，无法处理缓存",
      };
      res.status(500).json(response);
      return;
    }

    const result = await databaseHealth.triggerCacheProcessing();

    const response: ApiResponse = {
      code: result.success ? 1 : 0,
      message: result.message,
      data: {
        processed: result.processed,
        failed: result.failed,
        errors: result.errors,
        timestamp: DateTime.now(),
      },
    };

    if (result.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  }
);

/**
 * 清空缓存
 */
export const clearCache = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const logCache = LogCache.getInstance();

    await logCache.clearCache();

    const response: ApiResponse = {
      code: 1,
      message: "缓存已清空",
      data: {
        timestamp: DateTime.now(),
      },
    };

    res.json(response);
  }
);

/**
 * 获取详细的系统健康报告
 */
export const getSystemHealthReport = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const databaseHealth = DatabaseHealth.getInstance();

    const report = await databaseHealth.getDetailedHealthReport();

    const response: ApiResponse = {
      code: 1,
      message: "系统健康报告获取成功",
      data: report,
    };

    res.json(response);
  }
);

/**
 * 获取日志统计信息
 */
export const getLogStatistics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { timeRange = "24h" } = req.body;

    // 验证时间范围参数
    const validTimeRanges = ["1h", "24h", "7d", "30d", "90d"];
    if (!validTimeRanges.includes(timeRange as string)) {
      const response: ApiResponse = {
        code: 0,
        message: "无效的时间范围参数，支持: 1h, 24h, 7d, 30d, 90d",
      };
      res.status(400).json(response);
      return;
    }

    const stats = await getLogStats(timeRange as string);

    const response: ApiResponse = {
      code: 1,
      message: "日志统计信息获取成功",
      data: {
        stats: ResponseFormatter.formatLogStats(stats),
        timeRange: timeRange as string,
        timestamp: DateTime.now(),
      },
    };

    res.json(response);
  }
);

/**
 * 批量创建日志记录
 */
export const createLogsBatch = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const { logs } = req.body;

    // 数据验证
    if (!Array.isArray(logs) || logs.length === 0) {
      const response: ApiResponse = {
        code: 0,
        message: "日志数组不能为空",
      };
      res.status(400).json(response);
      return;
    }

    if (logs.length > 1000) {
      const response: ApiResponse = {
        code: 0,
        message: "单次批量插入不能超过1000条记录",
      };
      res.status(400).json(response);
      return;
    }

    // 处理每条日志
    const processedLogs: LogData[] = logs.map((logItem: any) => {
      // 验证时间戳
      let timestamp = DateTime.toClickHouseFormat(); // 默认使用当前时间，ClickHouse兼容格式
      if (logItem.timestamp && DateTime.isValid(logItem.timestamp)) {
        timestamp = DateTime.toClickHouseFormat(logItem.timestamp);
      }

      return {
        level: logItem.level || "info",
        log_type: String(logItem.log_type || "application"),
        message: logItem.message || "",
        service: logItem.service || "unknown",
        service_name: logItem.service_name || "",
        service_ip: logItem.service_ip || "",
        appid: logItem.appid || "",
        enterprise_id: logItem.enterprise_id || "",
        user_id: logItem.user_id || "",
        extra_data: logItem.extra_data || {},
        timestamp: timestamp,
      };
    });

    // 检查数据库健康状态并决定写入策略
    const databaseHealth = DatabaseHealth.getInstance();
    const logCache = LogCache.getInstance();

    // 主动检查数据库健康状态
    if (!databaseHealth.getHealthStatus().isHealthy) {
      // 数据库不健康，直接缓存
      logger.warnSync(
        `⚠️ 数据库不健康，直接缓存 ${processedLogs.length} 条日志`
      );

      try {
        await logCache.addToCache(processedLogs);

        const cacheInfo = await logCache.getCacheInfo();

        const response: ApiResponse = {
          code: 1,
          message: `数据库暂时不可用，已缓存${processedLogs.length}条日志到本地`,
          data: {
            count: processedLogs.length,
            cached: true,
            totalCached: cacheInfo.count,
            timestamp: DateTime.now(),
          },
        };

        res.json(response);
        return;
      } catch (cacheError) {
        logger.errorSync("❌ 批量缓存日志失败:", {
          error: (cacheError as Error).message,
        });

        const response: ApiResponse = {
          code: 0,
          message: "批量日志存储失败，数据库和缓存都不可用",
        };

        res.status(500).json(response);
        return;
      }
    }

    // 数据库健康，尝试批量写入
    try {
      const insertPromises = processedLogs.map((logData) => insertLog(logData));
      await Promise.all(insertPromises);

      if (NODE_ENV === "development") {
        logger.debugSync(`✅ 批量插入${processedLogs.length}条日志成功`);
      }

      // 批量写入成功，检查并处理缓存中的待处理日志
      const cacheInfo = await logCache.getCacheInfo();
      if (cacheInfo.count > 0) {
        logger.infoSync(
          `📦 检测到 ${cacheInfo.count} 条缓存日志，触发后台处理...`
        );
        // 异步处理缓存，不阻塞当前响应
        databaseHealth.triggerCacheProcessing().catch((error) => {
          logger.errorSync("❌ 后台处理缓存失败:", { error: error.message });
        });
      }

      const response: ApiResponse = {
        code: 1,
        message: `成功存储${processedLogs.length}条日志`,
        data: {
          count: processedLogs.length,
          cached: false,
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      // 批量插入失败，尝试缓存
      logger.warnSync("⚠️ 批量数据库写入失败，转为缓存模式:", {
        error: (error as Error).message,
      });

      try {
        await logCache.addToCache(processedLogs);

        const cacheInfo = await logCache.getCacheInfo();

        const response: ApiResponse = {
          code: 1,
          message: `数据库暂时不可用，已缓存${processedLogs.length}条日志到本地`,
          data: {
            count: processedLogs.length,
            cached: true,
            totalCached: cacheInfo.count,
            timestamp: DateTime.now(),
          },
        };

        res.json(response);
      } catch (cacheError) {
        // 缓存也失败了
        logger.errorSync("❌ 批量缓存日志也失败:", {
          error: (cacheError as Error).message,
        });

        const response: ApiResponse = {
          code: 0,
          message: "批量日志存储失败，数据库和缓存都不可用",
        };

        res.status(500).json(response);
      }
    }
  }
);
