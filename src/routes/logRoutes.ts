import { Router } from "express";
import {
  getLogs,
  createLog,
  getLogStatistics,
  createLogsBatch,
  getCacheStatus,
  processCachedLogs,
  clearCache,
  getSystemHealthReport,
} from "../controllers/logController";
import {
  createApiRequestLog,
  getApiRequestLogs,
  getApiRequestLogStatistics,
  getTopEndpointsStats,
  getApiErrorStats,
} from "../controllers/apiRequestLogController";
import {
  getApiStatistics,
  getApiAggregatedStatistics,
  getApiStatisticsOverview,
  getApiTimeSeriesData,
  updateApiStatistics,
  updateAllApiStatistics,
} from "../controllers/apiStatisticsController";
import {
  validateTimeRange,
  validateDateTime,
  addRequestTimestamp,
} from "../middleware/timeValidation";

const router: Router = Router();

// 应用时间戳中间件到所有路由
router.use(addRequestTimestamp);

// 获取日志列表（带时间验证）
router.post("/query", validateDateTime, getLogs);

// 创建单条日志
router.post("/create", createLog);

// 创建 API 请求日志
router.post("/api-request", createApiRequestLog);

// 查询 API 请求日志
router.post("/api-request/query", getApiRequestLogs);

// API 请求日志统计
router.post("/api-request/stats", getApiRequestLogStatistics);

// 热门端点统计
router.post("/api-request/endpoints/top", getTopEndpointsStats);

// API 错误统计
router.post("/api-request/errors", getApiErrorStats);

// API 请求统计分析接口
router.get("/api-statistics", getApiStatistics);
router.get("/api-statistics/aggregated", getApiAggregatedStatistics);
router.get("/api-statistics/overview", getApiStatisticsOverview);
router.get("/api-statistics/timeseries", getApiTimeSeriesData);
router.post("/api-statistics/update", updateApiStatistics);
router.post("/api-statistics/update-all", updateAllApiStatistics);

// 批量创建日志
router.post("/batch", createLogsBatch);

// 获取日志统计（带时间范围验证）
router.post("/stats", validateTimeRange, getLogStatistics);

// 缓存管理接口
router.post("/cache/status", getCacheStatus);
router.post("/cache/process", processCachedLogs);
router.post("/cache/clear", clearCache);

// 系统健康报告接口
router.post("/system/health", getSystemHealthReport);

export default router;
