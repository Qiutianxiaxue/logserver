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
  validateTimeRange,
  validateDateTime,
  addRequestTimestamp,
} from "../middleware/timeValidation";

const router = Router();

// 应用时间戳中间件到所有路由
router.use(addRequestTimestamp);

// 获取日志列表（带时间验证）
router.post("/query", validateDateTime, getLogs);

// 创建单条日志
router.post("/create", createLog);

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
