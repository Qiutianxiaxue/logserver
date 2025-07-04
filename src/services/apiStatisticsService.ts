import { Op } from "sequelize";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
import ApiStatistics, { ApiStatType } from "../models/ApiStatistics";
import { clickhouseClient } from "../config/database";
import { systemLogger } from "../utils/logger";

// 启用周数插件
dayjs.extend(weekOfYear);

/**
 * API统计查询选项接口
 */
export interface ApiStatisticsQueryOptions {
  startTime?: string;
  endTime?: string;
  statType?: ApiStatType;
  method?: string;
  host?: string;
  path?: string;
  appid?: string;
  enterprise_id?: string;
  status_code?: number;
  limit?: number;
  offset?: number;
}

/**
 * API统计结果接口
 */
export interface ApiStatisticsResult {
  stat_time: string;
  stat_type: ApiStatType;
  method: string;
  host: string;
  path: string;
  appid: string;
  enterprise_id: string;
  status_code: number;
  request_count: number;
  unique_users: number;
  unique_ips: number;
  avg_response_time: number;
  p95_response_time: number;
  total_bytes_sent: number;
  total_bytes_received: number;
  error_count: number;
  error_rate: number;
}

/**
 * API请求统计服务类
 */
export class ApiStatisticsService {
  /**
   * 更新API统计数据
   */
  async updateStatistics(
    statType: ApiStatType,
    targetTime?: Date
  ): Promise<void> {
    const now = targetTime || new Date();
    const timeRange = this.getTimeRange(statType, now);

    try {
      // 从ClickHouse查询聚合数据
      const aggregatedData = await this.getAggregatedDataFromClickHouse(
        timeRange.start.toDate(),
        timeRange.end.toDate()
      );

      if (aggregatedData.length === 0) {
        return;
      }

      // 批量更新MySQL统计表
      await this.batchUpsertStatistics(
        statType,
        timeRange.statTime,
        aggregatedData
      );

      await systemLogger.info(
        `API ${statType}统计数据更新完成，处理了 ${aggregatedData.length} 条记录`
      );
    } catch (error) {
      await systemLogger.error(`更新API ${statType} 统计数据失败`, {
        error,
        statType,
      });
      throw error;
    }
  }

  /**
   * 从ClickHouse获取聚合数据
   */
  private async getAggregatedDataFromClickHouse(
    startTime: Date,
    endTime: Date
  ) {
    if (!clickhouseClient) {
      throw new Error("ClickHouse客户端未初始化");
    }

    const query = `
      SELECT 
        method,
        host,
        path,
        appid,
        enterprise_id,
        status_code,
        
        -- 基础统计
        COUNT(*) as request_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips,
        
        -- 响应时间统计
        AVG(response_time) as avg_response_time,
        quantile(0.95)(response_time) as p95_response_time,
        
        -- 流量统计
        SUM(response_size) as total_bytes_sent,
        SUM(body_size) as total_bytes_received,
        
        -- 错误统计
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
        
      FROM logs.api_request_logs 
      WHERE timestamp >= '${dayjs(startTime).format("YYYY-MM-DD HH:mm:ss")}'
        AND timestamp < '${dayjs(endTime).format("YYYY-MM-DD HH:mm:ss")}'
      GROUP BY method, host, path, appid, enterprise_id, status_code
      HAVING request_count > 0
      ORDER BY request_count DESC
    `;

    try {
      const result = await clickhouseClient.query({
        query,
        format: "JSONEachRow",
      });

      const data = (await result.json()) as Array<{
        method: string;
        host: string;
        path: string;
        appid: string;
        enterprise_id: string;
        status_code: number;
        request_count: number;
        unique_users: number;
        unique_ips: number;
        avg_response_time: number;
        p95_response_time: number;
        total_bytes_sent: number;
        total_bytes_received: number;
        error_count: number;
      }>;

      // 计算错误率
      return data.map((row) => ({
        ...row,
        error_rate:
          row.request_count > 0
            ? (row.error_count / row.request_count) * 100
            : 0,
      }));
    } catch (error) {
      await systemLogger.error("从ClickHouse查询API聚合数据失败", {
        error,
        startTime,
        endTime,
      });
      throw error;
    }
  }

  /**
   * 批量更新统计数据到MySQL
   */
  private async batchUpsertStatistics(
    statType: ApiStatType,
    statTime: string,
    data: Array<{
      method: string;
      host: string;
      path: string;
      appid: string;
      enterprise_id: string;
      status_code: number;
      request_count: number;
      unique_users: number;
      unique_ips: number;
      avg_response_time: number;
      p95_response_time: number;
      total_bytes_sent: number;
      total_bytes_received: number;
      error_count: number;
      error_rate: number;
    }>
  ): Promise<void> {
    const statDate = dayjs(
      statTime,
      statType === ApiStatType.HOUR
        ? "YYYYMMDDHH"
        : statType === ApiStatType.DAY
        ? "YYYYMMDD"
        : statType === ApiStatType.MONTH
        ? "YYYYMM"
        : "YYYY[W]WW"
    ).format("YYYY-MM-DD");

    for (const row of data) {
      try {
        const whereConditions = {
          stat_time: statTime,
          stat_type: statType,
          method: row.method || "",
          host: row.host || "",
          path: row.path || "",
          appid: row.appid || "",
          enterprise_id: row.enterprise_id || "",
          status_code: row.status_code || 0,
        };

        // 先查询是否已存在相同记录
        const existingRecord = await ApiStatistics.findOne({
          where: whereConditions,
        });

        const updateData = {
          stat_date: statDate,
          request_count: row.request_count || 0,
          unique_users: row.unique_users || 0,
          unique_ips: row.unique_ips || 0,
          avg_response_time: Number(row.avg_response_time) || 0,
          p95_response_time: Number(row.p95_response_time) || 0,
          total_bytes_sent: Number(row.total_bytes_sent) || 0,
          total_bytes_received: Number(row.total_bytes_received) || 0,
          error_count: row.error_count || 0,
          error_rate: Number(row.error_rate) || 0,
          update_time: new Date(),
        };

        if (existingRecord) {
          // 如果存在，则更新记录
          await existingRecord.update(updateData);
        } else {
          // 如果不存在，则创建新记录
          await ApiStatistics.create({
            ...whereConditions,
            ...updateData,
          });
        }
      } catch (error) {
        await systemLogger.error("更新API统计记录失败", { error, row });
        // 继续处理其他记录
      }
    }
  }

  /**
   * 获取时间范围
   */
  private getTimeRange(statType: ApiStatType, targetTime: Date) {
    const target = dayjs(targetTime);
    let start: dayjs.Dayjs;
    let end: dayjs.Dayjs;
    let statTime: string; // 改为字符串类型

    switch (statType) {
      case ApiStatType.HOUR:
        // 获取指定小时的完整时间段
        start = target.startOf("hour");
        end = target.endOf("hour");
        statTime = target.format("YYYYMMDDHH"); // 小时格式：2025070415
        break;

      case ApiStatType.DAY:
        // 获取指定日期从开始到当前时间
        if (target.isSame(dayjs(), "day")) {
          // 如果是今天，统计到当前时间
          start = target.startOf("day");
          end = dayjs(); // 当前时间
        } else {
          // 如果是历史日期，统计完整一天
          start = target.startOf("day");
          end = target.endOf("day");
        }
        statTime = target.format("YYYYMMDD"); // 天格式：20250704
        break;

      case ApiStatType.WEEK:
        // 获取指定周从开始到当前时间
        if (target.isSame(dayjs(), "week")) {
          // 如果是本周，统计到当前时间
          start = target.startOf("week");
          end = dayjs(); // 当前时间
        } else {
          // 如果是历史周，统计完整一周
          start = target.startOf("week");
          end = target.endOf("week");
        }
        statTime = `${target.format("YYYY")}W${target
          .week()
          .toString()
          .padStart(2, "0")}`; // 周格式：2025W30
        break;

      case ApiStatType.MONTH:
        // 获取指定月从开始到当前时间
        if (target.isSame(dayjs(), "month")) {
          // 如果是本月，统计到当前时间
          start = target.startOf("month");
          end = dayjs(); // 当前时间
        } else {
          // 如果是历史月，统计完整一个月
          start = target.startOf("month");
          end = target.endOf("month");
        }
        statTime = target.format("YYYYMM"); // 月格式：202507
        break;

      default:
        throw new Error(`不支持的统计类型: ${statType}`);
    }

    return {
      start,
      end,
      statTime,
    };
  }

  /**
   * 查询API统计数据
   */
  async getStatistics(options: ApiStatisticsQueryOptions = {}): Promise<{
    data: ApiStatisticsResult[];
    total: number;
  }> {
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

    if (method) {
      whereConditions.method = method;
    }

    if (host) {
      whereConditions.host = host;
    }

    if (path) {
      whereConditions.path = path;
    }

    if (appid) {
      whereConditions.appid = appid;
    }

    if (enterprise_id) {
      whereConditions.enterprise_id = enterprise_id;
    }

    if (status_code) {
      whereConditions.status_code = status_code;
    }

    try {
      // 查询总数
      const total = await ApiStatistics.count({
        where: whereConditions,
      });

      // 查询数据
      const records = await ApiStatistics.findAll({
        where: whereConditions,
        order: [
          ["stat_time", "DESC"],
          ["request_count", "DESC"],
        ],
        limit,
        offset,
        raw: true,
      });

      const data: ApiStatisticsResult[] = records.map((record) => ({
        stat_time: record.stat_time,
        stat_type: record.stat_type,
        method: record.method,
        host: record.host,
        path: record.path,
        appid: record.appid,
        enterprise_id: record.enterprise_id,
        status_code: record.status_code,
        request_count: record.request_count,
        unique_users: record.unique_users,
        unique_ips: record.unique_ips,
        avg_response_time: Number(record.avg_response_time),
        p95_response_time: Number(record.p95_response_time),
        total_bytes_sent: Number(record.total_bytes_sent),
        total_bytes_received: Number(record.total_bytes_received),
        error_count: record.error_count,
        error_rate: Number(record.error_rate),
      }));

      return { data, total };
    } catch (error) {
      await systemLogger.error("查询API统计数据失败", { error, options });
      throw error;
    }
  }

  /**
   * 获取聚合统计数据
   */
  async getAggregatedStatistics(
    options: ApiStatisticsQueryOptions & {
      groupBy?:
        | "method"
        | "host"
        | "path"
        | "appid"
        | "enterprise_id"
        | "status_code";
    }
  ): Promise<{
    data: Array<{
      key: string;
      value: string;
      totalCount: number;
      avgResponseTime: number;
      errorRate: number;
    }>;
    total: number;
  }> {
    const {
      startTime,
      endTime,
      statType,
      groupBy = "method",
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

    try {
      const records = await ApiStatistics.findAll({
        attributes: [
          groupBy,
          [
            ApiStatistics.sequelize!.fn(
              "SUM",
              ApiStatistics.sequelize!.col("request_count")
            ),
            "total_count",
          ],
          [
            ApiStatistics.sequelize!.fn(
              "AVG",
              ApiStatistics.sequelize!.col("avg_response_time")
            ),
            "avg_response_time",
          ],
          [
            ApiStatistics.sequelize!.fn(
              "AVG",
              ApiStatistics.sequelize!.col("error_rate")
            ),
            "avg_error_rate",
          ],
        ],
        where: whereConditions,
        group: [groupBy],
        order: [[ApiStatistics.sequelize!.literal("total_count"), "DESC"]],
        limit,
        raw: true,
      });

      const data = records.map((record: any) => ({
        key: groupBy,
        value: record[groupBy]?.toString() || "",
        totalCount: parseInt(record.total_count) || 0,
        avgResponseTime: parseFloat(record.avg_response_time) || 0,
        errorRate: parseFloat(record.avg_error_rate) || 0,
      }));

      const total = data.reduce((sum, item) => sum + item.totalCount, 0);

      return { data, total };
    } catch (error) {
      await systemLogger.error("查询API聚合统计数据失败", { error, options });
      throw error;
    }
  }

  /**
   * 批量更新所有类型的API统计数据
   */
  async updateAllStatistics(targetTime?: Date): Promise<void> {
    const statisticsTypes = Object.values(ApiStatType);

    for (const statType of statisticsTypes) {
      try {
        await this.updateStatistics(statType, targetTime);
      } catch (error) {
        await systemLogger.error(`更新API ${statType}统计失败`, {
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
  private convertToStatTimeFormat(time: string, statType: ApiStatType): string {
    const target = dayjs(time);

    switch (statType) {
      case ApiStatType.HOUR:
        return target.format("YYYYMMDDHH"); // 小时格式：2025070415
      case ApiStatType.DAY:
        return target.format("YYYYMMDD"); // 天格式：20250704
      case ApiStatType.WEEK:
        return `${target.format("YYYY")}W${target
          .week()
          .toString()
          .padStart(2, "0")}`; // 周格式：2025W30
      case ApiStatType.MONTH:
        return target.format("YYYYMM"); // 月格式：202507
      default:
        throw new Error(`不支持的统计类型: ${statType}`);
    }
  }
}

// 导出单例实例
export const apiStatisticsService = new ApiStatisticsService();
