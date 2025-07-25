import { LogStatistics, StatType } from "../models/LogStatistics";
import { getClient } from "../config/database";
import { Op } from "sequelize";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
import { systemLogger } from "../utils/logger";

// 启用周数插件
dayjs.extend(weekOfYear);

// 统计查询接口
export interface StatisticsQueryOptions {
  startTime?: string;
  endTime?: string;
  statType?: StatType;
  enterprise_id?: string;
  appid?: string;
  service?: string;
  level?: string;
  log_type?: string;
  limit?: number;
  offset?: number;
}

// 统计结果接口
export interface StatisticsResult {
  stat_time: string;
  stat_type: StatType;
  log_type: string;
  service: string;
  level: string;
  appid: string;
  enterprise_id: string;
  count: number;
}

/**
 * 日志统计服务类
 */
export class LogStatisticsService {
  /**
   * 从ClickHouse获取日志统计数据并更新到MySQL
   */
  async updateStatistics(statType: StatType, targetTime?: Date): Promise<void> {
    const clickhouseClient = getClient();
    if (!clickhouseClient) {
      throw new Error("ClickHouse客户端未初始化");
    }

    const now = targetTime || new Date();
    const { startTime, endTime, statTime } = this.getTimeRange(statType, now);

    try {
      // 从ClickHouse查询统计数据
      const query = `
        SELECT
          log_type,
          service,
          level,
          appid,
          enterprise_id,
          COUNT(*) as count
        FROM ${process.env.CLICKHOUSE_DATABASE || "logs"}.application_logs
        WHERE timestamp >= '${startTime}' 
          AND timestamp < '${endTime}'
        GROUP BY log_type, service, level, appid, enterprise_id
        ORDER BY count DESC
      `;

      const resultSet = await clickhouseClient.query({
        query,
        format: "JSONEachRow",
      });

      const rows = (await resultSet.json()) as {
        log_type: string;
        service: string;
        level: string;
        appid: string;
        enterprise_id: string;
        count: number;
      }[];

      // 批量更新或插入统计数据
      for (const row of rows) {
        const whereConditions = {
          stat_time: statTime,
          stat_type: statType,
          log_type: row.log_type || "",
          service: row.service || "",
          level: row.level || "",
          appid: row.appid || "",
          enterprise_id: row.enterprise_id || "",
        };

        // 先查询是否已存在相同记录
        const existingRecord = await LogStatistics.findOne({
          where: whereConditions,
        });

        if (existingRecord) {
          // 如果存在，则更新数量
          await existingRecord.update({
            count: row.count,
            update_time: new Date(),
          });
        } else {
          // 如果不存在，则创建新记录
          await LogStatistics.create({
            ...whereConditions,
            count: row.count,
          });
        }
      }

      await systemLogger.info(
        `✅ ${statType}统计数据更新完成，共处理 ${rows.length} 条记录`
      );
    } catch (error) {
      await systemLogger.error(`更新${statType}统计数据失败`, {
        error,
        statType,
      });
      throw error;
    }
  }

  /**
   * 获取时间范围
   */
  private getTimeRange(statType: StatType, targetTime: Date) {
    const target = dayjs(targetTime);

    switch (statType) {
      case StatType.HOUR:
        return {
          startTime: target.startOf("hour").format("YYYY-MM-DD HH:mm:ss"),
          endTime: target.endOf("hour").format("YYYY-MM-DD HH:mm:ss"),
          statTime: target.format("YYYYMMDDHH"), // 小时格式：2025070415
        };
      case StatType.DAY:
        return {
          startTime: target.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
          endTime: target.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
          statTime: target.format("YYYYMMDD"), // 天格式：20250704
        };
      case StatType.WEEK:
        return {
          startTime: target.startOf("week").format("YYYY-MM-DD HH:mm:ss"),
          endTime: target.endOf("week").format("YYYY-MM-DD HH:mm:ss"),
          statTime: `${target.format("YYYY")}W${target
            .week()
            .toString()
            .padStart(2, "0")}`, // 周格式：2025W30
        };
      case StatType.MONTH:
        return {
          startTime: target.startOf("month").format("YYYY-MM-DD HH:mm:ss"),
          endTime: target.endOf("month").format("YYYY-MM-DD HH:mm:ss"),
          statTime: target.format("YYYYMM"), // 月格式：202507
        };
      default:
        throw new Error(`不支持的统计类型: ${statType}`);
    }
  }

  /**
   * 查询统计数据
   */
  async getStatistics(options: StatisticsQueryOptions = {}): Promise<{
    data: StatisticsResult[];
    total: number;
  }> {
    const {
      startTime,
      endTime,
      statType,
      enterprise_id,
      appid,
      service,
      level,
      log_type,
      limit = 100,
      offset = 0,
    } = options;

    // 构建查询条件
    const whereConditions: any = {};

    if (startTime && statType) {
      whereConditions.stat_time = {
        ...whereConditions.stat_time,
        [Op.gte]: this.convertToStatTimeFormat(startTime, statType),
      };
    }

    if (endTime && statType) {
      whereConditions.stat_time = {
        ...whereConditions.stat_time,
        [Op.lte]: this.convertToStatTimeFormat(endTime, statType),
      };
    }

    if (statType) {
      whereConditions.stat_type = statType;
    }

    if (enterprise_id) {
      whereConditions.enterprise_id = enterprise_id;
    }

    if (appid) {
      whereConditions.appid = appid;
    }

    if (service) {
      whereConditions.service = service;
    }

    if (level) {
      whereConditions.level = level;
    }

    if (log_type) {
      whereConditions.log_type = log_type;
    }

    try {
      // 查询总数
      const total = await LogStatistics.count({
        where: whereConditions,
      });

      // 查询数据
      const records = await LogStatistics.findAll({
        where: whereConditions,
        order: [
          ["stat_time", "DESC"],
          ["count", "DESC"],
        ],
        limit,
        offset,
        raw: true,
      });

      const data: StatisticsResult[] = records.map((record) => ({
        stat_time: record.stat_time, // 现在直接使用字符串，不需要toISOString()
        stat_type: record.stat_type,
        log_type: record.log_type,
        service: record.service,
        level: record.level,
        appid: record.appid,
        enterprise_id: record.enterprise_id,
        count: record.count,
      }));

      return { data, total };
    } catch (error) {
      await systemLogger.error("查询统计数据失败", { error, options });
      throw error;
    }
  }

  /**
   * 获取聚合统计数据
   */
  async getAggregatedStatistics(
    options: StatisticsQueryOptions & {
      groupBy?:
        | "stat_time"
        | "service"
        | "level"
        | "appid"
        | "enterprise_id"
        | "log_type";
    }
  ): Promise<{
    data: Array<{
      key: string;
      value: string;
      count: number;
    }>;
    total: number;
  }> {
    const {
      startTime,
      endTime,
      statType,
      enterprise_id,
      appid,
      service,
      level,
      log_type,
      groupBy = "stat_time",
      limit = 100,
    } = options;

    // 构建查询条件
    const whereConditions: any = {};

    if (startTime && statType) {
      whereConditions.stat_time = {
        ...whereConditions.stat_time,
        [Op.gte]: this.convertToStatTimeFormat(startTime, statType),
      };
    }

    if (endTime && statType) {
      whereConditions.stat_time = {
        ...whereConditions.stat_time,
        [Op.lte]: this.convertToStatTimeFormat(endTime, statType),
      };
    }

    if (statType) {
      whereConditions.stat_type = statType;
    }

    if (enterprise_id) {
      whereConditions.enterprise_id = enterprise_id;
    }

    if (appid) {
      whereConditions.appid = appid;
    }

    if (service) {
      whereConditions.service = service;
    }

    if (level) {
      whereConditions.level = level;
    }

    if (log_type) {
      whereConditions.log_type = log_type;
    }

    try {
      const records = await LogStatistics.findAll({
        attributes: [
          groupBy,
          [
            LogStatistics.sequelize!.fn(
              "SUM",
              LogStatistics.sequelize!.col("count")
            ),
            "total_count",
          ],
        ],
        where: whereConditions,
        group: [groupBy],
        order: [[LogStatistics.sequelize!.literal("total_count"), "DESC"]],
        limit,
        raw: true,
      });

      const data = records.map((record: any) => ({
        key: groupBy,
        value: record[groupBy]?.toString() || "",
        count: parseInt(record.total_count) || 0,
      }));

      const total = data.reduce((sum, item) => sum + item.count, 0);

      return { data, total };
    } catch (error) {
      await systemLogger.error("查询聚合统计数据失败", { error, options });
      throw error;
    }
  }

  /**
   * 批量更新所有类型的统计数据
   */
  async updateAllStatistics(targetTime?: Date): Promise<void> {
    const statisticsTypes = Object.values(StatType);

    for (const statType of statisticsTypes) {
      try {
        await this.updateStatistics(statType, targetTime);
      } catch (error) {
        await systemLogger.error(`更新${statType}统计失败`, {
          error,
          statType,
        });
        // 继续处理其他类型的统计
      }
    }
  }

  /**
   * 将输入的时间字符串转换为对应统计类型的格式字符串
   */
  private convertToStatTimeFormat(time: string, statType: StatType): string {
    const target = dayjs(time);

    switch (statType) {
      case StatType.HOUR:
        return target.format("YYYYMMDDHH"); // 小时格式：2025070415
      case StatType.DAY:
        return target.format("YYYYMMDD"); // 天格式：20250704
      case StatType.WEEK:
        return `${target.format("YYYY")}W${target
          .week()
          .toString()
          .padStart(2, "0")}`; // 周格式：2025W30
      case StatType.MONTH:
        return target.format("YYYYMM"); // 月格式：202507
      default:
        throw new Error(`不支持的统计类型: ${statType}`);
    }
  }
}

// 导出单例实例
export const logStatisticsService = new LogStatisticsService();
