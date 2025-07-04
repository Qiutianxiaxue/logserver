import { Router } from "express";
import { logStatisticsController } from "../controllers/logStatisticsController";

const router: Router = Router();

/**
 * 日志统计相关路由
 */

// 查询统计数据
router.get(
  "/statistics",
  logStatisticsController.getStatistics.bind(logStatisticsController)
);

// 获取聚合统计数据
router.get(
  "/statistics/aggregated",
  logStatisticsController.getAggregatedStatistics.bind(logStatisticsController)
);

// 获取统计概览
router.get(
  "/statistics/overview",
  logStatisticsController.getStatisticsOverview.bind(logStatisticsController)
);

// 获取时间序列统计数据
router.get(
  "/statistics/timeseries",
  logStatisticsController.getTimeSeriesStatistics.bind(logStatisticsController)
);

// 手动更新统计数据
router.post(
  "/statistics/update",
  logStatisticsController.updateStatistics.bind(logStatisticsController)
);

// 批量更新所有类型的统计数据
router.post(
  "/statistics/update-all",
  logStatisticsController.updateAllStatistics.bind(logStatisticsController)
);

export default router;
