import DateTime from "./datetime";
import { LogData, LogStats, ApiResponse } from "../types";

/**
 * 响应数据格式化工具
 */
export class ResponseFormatter {
  /**
   * 格式化单条日志记录的时间显示
   */
  static formatLogData(log: LogData): LogData {
    return {
      ...log,
      timestamp: log.timestamp ? DateTime.format(log.timestamp) : undefined,
      created_date: log.created_date
        ? DateTime.toDateString(log.created_date)
        : undefined,
    };
  }

  /**
   * 格式化日志列表的时间显示
   */
  static formatLogList(logs: LogData[]): LogData[] {
    return logs.map((log) => this.formatLogData(log));
  }

  /**
   * 格式化日志统计数据的时间显示
   */
  static formatLogStats(stats: LogStats[]): LogStats[] {
    return stats.map((stat) => ({
      ...stat,
      // 如果需要格式化统计数据中的时间字段，可以在这里添加
    }));
  }

  /**
   * 格式化时间范围显示
   */
  static formatTimeRange(timeRange: { start: string; end: string }): {
    start: string;
    end: string;
  } {
    return {
      start: DateTime.format(timeRange.start),
      end: DateTime.format(timeRange.end),
    };
  }

  /**
   * 格式化API响应中的时间戳
   */
  static formatResponseTimestamp(timestamp?: string): string {
    return timestamp ? DateTime.format(timestamp) : DateTime.now();
  }
} 

/**
 * 格式化API响应
 */
export function formatResponse<T = any>(
  code: 0 | 1, 
  data: T, 
  message: string
): ApiResponse<T> {
  return {
    code,
    data,
    message
  };
}
