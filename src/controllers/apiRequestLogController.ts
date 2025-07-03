import { Request, Response } from "express";
import {
  insertApiRequestLog,
  queryApiRequestLogs,
  getApiRequestLogStats,
  getTopEndpoints,
  getErrorStats,
} from "../config/database";
import {
  ApiRequestLogData,
  ApiRequestLogQueryOptions,
  ApiResponse,
  ApiRequestLogStats,
} from "../types";
import { asyncHandler } from "../types/controller";
import DateTime from "../utils/datetime";

/**
 * 创建 API 请求日志记录
 */
export const createApiRequestLog = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const body = req.body;

    // 数据验证
    if (!body.method || !body.url || !body.status_code) {
      const response: ApiResponse = {
        code: 0,
        message: "method、url 和 status_code 不能为空",
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

    // 构建 API 请求日志数据（只包含表中实际存在的字段）
    const apiRequestLogData: ApiRequestLogData = {
      timestamp: timestamp,

      // 请求基本信息（必填）
      method: String(body.method).toUpperCase(),
      url: String(body.url),
      host: body.host ? String(body.host) : "",
      path: body.path ? String(body.path) : new URL(body.url).pathname,
      status_code: parseInt(body.status_code),
      response_time: body.response_time ? parseInt(body.response_time) : 0,

      // 请求信息（可选）
      query_params: body.query_params ? String(body.query_params) : "",
      headers: body.headers
        ? typeof body.headers === "string"
          ? body.headers
          : JSON.stringify(body.headers)
        : "{}",
      body: body.body ? String(body.body) : "",
      body_size: body.body_size ? parseInt(body.body_size) : 0,
      content_type: body.content_type ? String(body.content_type) : "",

      // 应用信息
      appid: body.appid ? String(body.appid) : "",
      app_name: body.app_name ? String(body.app_name) : "",

      // 企业信息
      enterprise_id: body.enterprise_id ? String(body.enterprise_id) : "",
      enterprise_name: body.enterprise_name ? String(body.enterprise_name) : "",

      // 用户和会话信息
      user_id: body.user_id ? String(body.user_id) : "",
      ip_address: body.ip_address ? String(body.ip_address) : "",
      real_ip: body.real_ip ? String(body.real_ip) : "",
      user_agent: body.user_agent ? String(body.user_agent) : "",
      referer: body.referer ? String(body.referer) : "",

      // 响应信息
      response_body: body.response_body ? String(body.response_body) : "",
      response_size: body.response_size ? parseInt(body.response_size) : 0,
      response_headers: body.response_headers
        ? typeof body.response_headers === "string"
          ? body.response_headers
          : JSON.stringify(body.response_headers)
        : "{}",

      // 地理位置信息
      country_info: body.country_info ? String(body.country_info) : "",

      // 设备和浏览器信息
      browser: body.browser ? String(body.browser) : "",

      // 服务器信息
      service_type: body.service_type ? String(body.service_type) : "",
      service_name: body.service_name ? String(body.service_name) : "",
      service_ip: body.service_ip ? String(body.service_ip) : "",

      // 错误和调试信息
      error_code: body.error_code ? String(body.error_code) : "",
      error_message: body.error_message ? String(body.error_message) : "",
      error_trace: body.error_trace ? String(body.error_trace) : "",
    };

    try {
      await insertApiRequestLog(apiRequestLogData);

      if (NODE_ENV === "development") {
        console.log("✅ API请求日志已存储:", apiRequestLogData);
      }

      const response: ApiResponse = {
        code: 1,
        message: "API请求日志已成功存储",
        data: {
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ API请求日志存储失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "API请求日志存储失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 查询 API 请求日志列表
 */
export const getApiRequestLogs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const queryParams = req.body;

    const options: ApiRequestLogQueryOptions = {
      limit: queryParams.limit ? parseInt(queryParams.limit as string) : 100,
      offset: queryParams.offset ? parseInt(queryParams.offset as string) : 0,
      startTime: (queryParams.startTime as string) || undefined,
      endTime: (queryParams.endTime as string) || undefined,
      method: (queryParams.method as string) || undefined,
      status_code: queryParams.status_code
        ? parseInt(queryParams.status_code as string)
        : undefined,
      service_name: (queryParams.service_name as string) || undefined,
      service_type: (queryParams.service_type as string) || undefined,
      appid: (queryParams.appid as string) || undefined,
      app_name: (queryParams.app_name as string) || undefined,
      enterprise_id: (queryParams.enterprise_id as string) || undefined,
      enterprise_name: (queryParams.enterprise_name as string) || undefined,
      user_id: (queryParams.user_id as string) || undefined,
      ip_address: (queryParams.ip_address as string) || undefined,
      real_ip: (queryParams.real_ip as string) || undefined,
      min_response_time: queryParams.min_response_time
        ? parseInt(queryParams.min_response_time as string)
        : undefined,
      max_response_time: queryParams.max_response_time
        ? parseInt(queryParams.max_response_time as string)
        : undefined,
      has_error: queryParams.has_error
        ? Boolean(queryParams.has_error)
        : undefined,
      error_code: (queryParams.error_code as string) || undefined,
      keyword: (queryParams.keyword as string) || undefined,
      sort_by:
        (queryParams.sort_by as
          | "timestamp"
          | "response_time"
          | "status_code") || "timestamp",
      sort_order: (queryParams.sort_order as "ASC" | "DESC") || "DESC",
    };

    try {
      const logs = await queryApiRequestLogs(options);

      const response: ApiResponse<{
        logs: ApiRequestLogData[];
        count: number;
        environment: string;
        timestamp: string;
      }> = {
        code: 1,
        message: `成功获取${logs.length}条API请求日志记录`,
        data: {
          logs: logs,
          count: logs.length,
          environment: NODE_ENV,
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 查询API请求日志失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "查询API请求日志失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 获取 API 请求日志统计
 */
export const getApiRequestLogStatistics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const { timeRange = "24h", groupBy = "hour" } = req.body;

    try {
      const stats = await getApiRequestLogStats(timeRange, groupBy);

      const response: ApiResponse<{
        stats: ApiRequestLogStats[];
        timeRange: string;
        groupBy: string;
        count: number;
        environment: string;
        timestamp: string;
      }> = {
        code: 1,
        message: `成功获取${timeRange}时间范围内的API请求统计`,
        data: {
          stats: stats,
          timeRange: timeRange,
          groupBy: groupBy,
          count: stats.length,
          environment: NODE_ENV,
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 获取API请求日志统计失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "获取API请求日志统计失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 获取热门端点统计
 */
export const getTopEndpointsStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const { timeRange = "24h", limit = 10 } = req.body;

    try {
      const topEndpoints = await getTopEndpoints(timeRange, limit);

      const response: ApiResponse<{
        endpoints: Array<{
          endpoint: string;
          count: number;
          avg_response_time: number;
        }>;
        timeRange: string;
        limit: number;
        environment: string;
        timestamp: string;
      }> = {
        code: 1,
        message: `成功获取${timeRange}时间范围内的热门端点统计`,
        data: {
          endpoints: topEndpoints,
          timeRange: timeRange,
          limit: limit,
          environment: NODE_ENV,
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 获取热门端点统计失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "获取热门端点统计失败",
      };

      res.status(500).json(response);
    }
  }
);

/**
 * 获取错误统计
 */
export const getApiErrorStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const NODE_ENV = process.env.NODE_ENV || "development";
    const { timeRange = "24h", limit = 10 } = req.body;

    try {
      const errorStats = await getErrorStats(timeRange, limit);

      const response: ApiResponse<{
        errors: Array<{
          error_code: string;
          error_message: string;
          count: number;
        }>;
        timeRange: string;
        limit: number;
        environment: string;
        timestamp: string;
      }> = {
        code: 1,
        message: `成功获取${timeRange}时间范围内的错误统计`,
        data: {
          errors: errorStats,
          timeRange: timeRange,
          limit: limit,
          environment: NODE_ENV,
          timestamp: DateTime.now(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("❌ 获取错误统计失败:", error);

      const response: ApiResponse = {
        code: 0,
        message: "获取错误统计失败",
      };

      res.status(500).json(response);
    }
  }
);
