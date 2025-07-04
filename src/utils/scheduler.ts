import { logStatisticsService } from "../services/logStatisticsService";
import { StatType } from "../models/LogStatistics";
import { apiStatisticsService } from "../services/apiStatisticsService";
import { ApiStatType } from "../models/ApiStatistics";
import * as cron from "node-cron";
import dayjs from "dayjs";
import { systemLogger } from "./logger";

/**
 * 统计数据更新调度器
 */
export class StatisticsScheduler {
  private cronTasks: cron.ScheduledTask[] = [];
  private isRunning = false;

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      console.warn("⚠️ 统计调度器已在运行中");
      return;
    }

    this.isRunning = true;
    console.log("🚀 启动统计数据更新调度器");

    // 每小时的第0分钟执行综合统计更新
    const hourlyTask = cron.schedule("0 * * * *", async () => {
      try {
        const now = dayjs();
        const lastHour = now.subtract(1, "hour");

        console.log("🔄 开始每小时综合统计更新...");

        // 1. 更新上一个完整小时的统计（历史数据）
        console.log(
          `📊 更新完整小时统计: ${lastHour.format("YYYY-MM-DD HH:00")}`
        );
        await Promise.all([
          logStatisticsService.updateStatistics(
            StatType.HOUR,
            lastHour.toDate()
          ),
          apiStatisticsService.updateStatistics(
            ApiStatType.HOUR,
            lastHour.toDate()
          ),
        ]);

        // 2. 更新今天到目前为止的统计（实时数据）
        console.log(`📊 更新今日累计统计: ${now.format("YYYY-MM-DD")}`);
        await Promise.all([
          logStatisticsService.updateStatistics(StatType.DAY, now.toDate()),
          apiStatisticsService.updateStatistics(ApiStatType.DAY, now.toDate()),
        ]);

        // 3. 更新本周到目前为止的统计（实时数据）
        console.log(
          `📊 更新本周累计统计: ${now
            .startOf("week")
            .format("YYYY-MM-DD")} 至今`
        );
        await Promise.all([
          logStatisticsService.updateStatistics(StatType.WEEK, now.toDate()),
          apiStatisticsService.updateStatistics(ApiStatType.WEEK, now.toDate()),
        ]);

        // 4. 更新本月到目前为止的统计（实时数据）
        console.log(`📊 更新本月累计统计: ${now.format("YYYY-MM")} 至今`);
        await Promise.all([
          logStatisticsService.updateStatistics(StatType.MONTH, now.toDate()),
          apiStatisticsService.updateStatistics(
            ApiStatType.MONTH,
            now.toDate()
          ),
        ]);

        console.log("✅ 每小时综合统计更新完成");
      } catch (error) {
        await systemLogger.error("每小时综合统计更新失败", { error });
      }
    });

    // 每天0点额外更新前一天的完整统计（确保数据完整性）
    const dailyCleanupTask = cron.schedule("0 0 * * *", async () => {
      const yesterday = dayjs().subtract(1, "day");
      try {
        console.log(`🔄 执行日统计清理任务: ${yesterday.format("YYYY-MM-DD")}`);
        await Promise.all([
          logStatisticsService.updateStatistics(
            StatType.DAY,
            yesterday.toDate()
          ),
          apiStatisticsService.updateStatistics(
            ApiStatType.DAY,
            yesterday.toDate()
          ),
        ]);
        console.log("✅ 日统计清理任务完成");
      } catch (error) {
        await systemLogger.error("日统计清理任务失败", {
          error,
          date: yesterday.format("YYYY-MM-DD"),
        });
      }
    });

    // 每周一0点额外更新上一周的完整统计（确保数据完整性）
    const weeklyCleanupTask = cron.schedule("0 0 * * 1", async () => {
      const lastWeek = dayjs().subtract(1, "week");
      try {
        console.log(
          `🔄 执行周统计清理任务: ${lastWeek
            .startOf("week")
            .format("YYYY-MM-DD")} 至 ${lastWeek
            .endOf("week")
            .format("YYYY-MM-DD")}`
        );
        await Promise.all([
          logStatisticsService.updateStatistics(
            StatType.WEEK,
            lastWeek.toDate()
          ),
          apiStatisticsService.updateStatistics(
            ApiStatType.WEEK,
            lastWeek.toDate()
          ),
        ]);
        console.log("✅ 周统计清理任务完成");
      } catch (error) {
        await systemLogger.error("周统计清理任务失败", {
          error,
          week: lastWeek.format("YYYY-[W]WW"),
        });
      }
    });

    // 每月1日0点额外更新上一月的完整统计（确保数据完整性）
    const monthlyCleanupTask = cron.schedule("0 0 1 * *", async () => {
      const lastMonth = dayjs().subtract(1, "month");
      try {
        console.log(`🔄 执行月统计清理任务: ${lastMonth.format("YYYY-MM")}`);
        await Promise.all([
          logStatisticsService.updateStatistics(
            StatType.MONTH,
            lastMonth.toDate()
          ),
          apiStatisticsService.updateStatistics(
            ApiStatType.MONTH,
            lastMonth.toDate()
          ),
        ]);
        console.log("✅ 月统计清理任务完成");
      } catch (error) {
        await systemLogger.error("月统计清理任务失败", {
          error,
          month: lastMonth.format("YYYY-MM"),
        });
      }
    });

    // 存储任务引用
    this.cronTasks.push(
      hourlyTask,
      dailyCleanupTask,
      weeklyCleanupTask,
      monthlyCleanupTask
    );

    // 启动时立即执行一次所有统计更新
    this.runInitialUpdate();
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn("⚠️ 统计调度器未在运行");
      return;
    }

    console.log("🛑 停止统计数据更新调度器");
    this.cronTasks.forEach((task) => {
      task.stop();
    });
    this.cronTasks = [];
    this.isRunning = false;
  }

  /**
   * 启动时的初始更新
   */
  private async runInitialUpdate(): Promise<void> {
    console.log("🚀 执行初始统计数据更新");

    try {
      await Promise.all([
        logStatisticsService.updateAllStatistics(),
        apiStatisticsService.updateAllStatistics(),
      ]);
      console.log("✅ 初始统计数据更新完成");
    } catch (error) {
      await systemLogger.error("初始统计数据更新失败", { error });
    }
  }

  /**
   * 获取运行状态
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 手动触发统计更新
   */
  async manualUpdate(statType?: StatType): Promise<void> {
    if (statType) {
      console.log(`🔄 手动更新${statType}统计数据`);
      await logStatisticsService.updateStatistics(statType);
      console.log(`✅ ${statType}统计数据手动更新完成`);
    } else {
      console.log("🔄 手动更新所有统计数据");
      await logStatisticsService.updateAllStatistics();
      console.log("✅ 所有统计数据手动更新完成");
    }
  }

  /**
   * 获取调度器状态和下次执行时间
   */
  getSchedulerStatus(): {
    isRunning: boolean;
    nextExecutions: {
      hourly: string;
      daily: string;
      weekly: string;
      monthly: string;
    };
  } {
    const now = dayjs();

    return {
      isRunning: this.isRunning,
      nextExecutions: {
        hourly: now
          .add(1, "hour")
          .startOf("hour")
          .format("YYYY-MM-DD HH:mm:ss"),
        daily: now.add(1, "day").startOf("day").format("YYYY-MM-DD HH:mm:ss"),
        weekly: now
          .add(1, "week")
          .startOf("week")
          .format("YYYY-MM-DD HH:mm:ss"),
        monthly: now
          .add(1, "month")
          .startOf("month")
          .format("YYYY-MM-DD HH:mm:ss"),
      },
    };
  }
}

// 导出单例实例
export const statisticsScheduler = new StatisticsScheduler();
