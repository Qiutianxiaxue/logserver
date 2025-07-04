import { createClient, ClickHouseClient } from "@clickhouse/client";
import {
  LogData,
  LogQueryOptions,
  LogStats,
  ClickHouseConfig,
  DatabaseInsertResult,
  ApiRequestLogData,
  ApiRequestLogQueryOptions,
  ApiRequestLogStats,
} from "../types";
import DateTime from "../utils/datetime";
import { dbLogger } from "../utils/logger";

// ClickHouse 配置
const clickhouseConfig: ClickHouseConfig = {
  url: process.env.CLICKHOUSE_HOST?.startsWith("http")
    ? process.env.CLICKHOUSE_HOST
    : `http://${process.env.CLICKHOUSE_HOST || "localhost"}:${
        process.env.CLICKHOUSE_PORT || "8123"
      }`,
  username: process.env.CLICKHOUSE_USERNAME || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "", // 空密码用于默认安装
  database: process.env.CLICKHOUSE_DATABASE || "logs",
  // 连接选项
  clickhouse_settings: {
    // 异步插入，但等待插入完成以确保数据已写入
    async_insert: 1,
    wait_for_async_insert: 0,
  },
  // 会话设置
  session_timeout: 60000,
  // 压缩设置
  compression: {
    response: true,
    request: false,
  },
};

// 创建ClickHouse客户端
let clickhouseClient: ClickHouseClient | null = null;

/**
 * 初始化ClickHouse连接
 */
export const initClickHouse = async (): Promise<ClickHouseClient | null> => {
  try {
    clickhouseClient = createClient(clickhouseConfig);

    // 测试连接
    await clickhouseClient.ping();

    // 创建数据库（如果不存在）
    await clickhouseClient.command({
      query: `CREATE DATABASE IF NOT EXISTS ${clickhouseConfig.database}`,
    });

    // 创建日志表（如果不存在）
    await createLogTable();

    // 创建API请求日志表（如果不存在）
    await createApiRequestLogTable();

    return clickhouseClient;
  } catch (error) {
    console.error("❌ ClickHouse初始连接失败:", (error as Error).message);
    console.warn("⚠️ 服务将在离线模式下启动，健康检查服务会持续尝试重连");

    // 重置客户端为null，让健康检查服务处理重连
    clickhouseClient = null;
    return null;
  }
};

/**
 * 尝试重新连接数据库（用于健康检查服务）
 */
export const reconnectClickHouse = async (): Promise<boolean> => {
  try {
    if (!clickhouseClient) {
      clickhouseClient = createClient(clickhouseConfig);
    }

    // 测试连接
    await clickhouseClient.ping();

    // 确保数据库和表存在
    await clickhouseClient.command({
      query: `CREATE DATABASE IF NOT EXISTS ${clickhouseConfig.database}`,
    });

    await createLogTable();

    // 创建API请求日志表（如果不存在）
    await createApiRequestLogTable();

    return true;
  } catch (error) {
    console.error("❌ ClickHouse重连失败:", (error as Error).message);
    clickhouseClient = null;
    return false;
  }
};

/**
 * 创建日志表
 */
const createLogTable = async (): Promise<void> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${clickhouseConfig.database}.application_logs (
      id UUID DEFAULT generateUUIDv4(),
      timestamp DateTime64(3) DEFAULT now64(),
      level String,
      log_type String DEFAULT 'application',
      message String,
      service String DEFAULT '',
      service_name String DEFAULT '',
      service_ip String DEFAULT '',
      appid String DEFAULT '',
      enterprise_id String DEFAULT '',
      user_id String DEFAULT '',
      extra_data String DEFAULT '',
      created_date Date DEFAULT today()
    ) ENGINE = MergeTree()
    PARTITION BY (toYYYYMM(timestamp), enterprise_id)
    ORDER BY (timestamp, log_type, level, service_name, enterprise_id)
    TTL toDateTime(timestamp) + INTERVAL 90 DAY
    SETTINGS index_granularity = 8192,
             index_granularity_bytes = 10485760,
             merge_with_ttl_timeout = 3600
  `;

  try {
    await clickhouseClient.command({
      query: createTableQuery,
    });
  } catch (error) {
    console.error("❌ 创建日志表失败:", (error as Error).message);
    throw error;
  }
};

/**
 * 创建API请求日志表
 */
const createApiRequestLogTable = async (): Promise<void> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${clickhouseConfig.database}.api_request_logs (
      -- 基础字段
      id UUID DEFAULT generateUUIDv4(),
      timestamp DateTime64(3) DEFAULT now64(),
      created_date Date DEFAULT today(),
      
      -- 请求基本信息
      method String,
      url String,
      host String,
      path String,
      query_params String DEFAULT '',
      headers String DEFAULT '{}',
      body String DEFAULT '',
      body_size UInt32 DEFAULT 0,
      content_type String DEFAULT '',

      -- 应用信息
      appid String,
      app_name String,

      -- 企业信息
      enterprise_id String,
      enterprise_name String,

      -- 用户和会话信息
      user_id String DEFAULT '',
      ip_address String DEFAULT '',
      real_ip String DEFAULT '',
      user_agent String DEFAULT '',
      referer String DEFAULT '',

      -- 响应信息
      status_code UInt16,
      response_body String DEFAULT '',
      response_size UInt32 DEFAULT 0,
      response_time UInt32,
      response_headers String DEFAULT '{}',
      
      -- 地理位置信息
      country_info String DEFAULT '',
    
      -- 设备和浏览器信息
      browser String DEFAULT '',
      
      -- 服务器信息
      service_type String DEFAULT '',
      service_name String DEFAULT '',
      service_ip String DEFAULT '',
      
      -- 错误和调试信息
      error_code String DEFAULT '',
      error_message String DEFAULT '',
      error_trace String DEFAULT '',
      
    ) ENGINE = MergeTree()
    PARTITION BY (toYYYYMM(timestamp), service_name)
    ORDER BY (timestamp, service_name, status_code, response_time)
    TTL toDateTime(timestamp) + INTERVAL 180 DAY
    SETTINGS index_granularity = 8192,
             merge_with_ttl_timeout = 3600,
             max_parts_in_total = 10000
  `;

  try {
    await clickhouseClient.command({
      query: createTableQuery,
    });
  } catch (error) {
    console.error("❌ 创建API请求日志表失败:", (error as Error).message);
    throw error;
  }
};

/**
 * 插入日志数据
 */
export const insertLog = async (
  logData: LogData
): Promise<DatabaseInsertResult> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  try {
    // 预处理数据，确保所有字段格式正确
    const processedData = {
      ...logData,
      // 确保 extra_data 是字符串格式
      extra_data:
        typeof logData.extra_data === "string"
          ? logData.extra_data
          : JSON.stringify(logData.extra_data || {}),
      // 转换时间戳为 ClickHouse 兼容格式 (YYYY-MM-DD HH:mm:ss.SSS)
      timestamp: DateTime.toClickHouseFormat(logData.timestamp),
    };

    // 验证数据格式
    if (!processedData.timestamp) {
      throw new Error("时间戳字段不能为空");
    }

    if (!processedData.message) {
      throw new Error("消息字段不能为空");
    }

    const result = await clickhouseClient.insert({
      table: `${clickhouseConfig.database}.application_logs`,
      values: [processedData],
      format: "JSONEachRow",
    });
    return result as DatabaseInsertResult;
  } catch (error) {
    // 记录详细错误到日志系统（避免循环）
    try {
      await dbLogger.error("ClickHouse日志插入失败", {
        error: (error as Error).message,
        logType: logData.log_type,
        level: logData.level,
        service: logData.service,
        appid: logData.appid,
        enterprise_id: logData.enterprise_id,
      });
    } catch {
      // 静默处理logger错误，避免无限循环
    }

    throw error;
  }
};

/**
 * 查询日志数据
 */
export const queryLogs = async (
  options: LogQueryOptions = {}
): Promise<LogData[]> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  const {
    limit = 100,
    offset = 0,
    level = null,
    log_type = null,
    service = null,
    service_name = null,
    service_ip = null,
    appid = null,
    enterprise_id = null,
    user_id = null,
    startTime = null,
    endTime = null,
    keyword = null,
  } = options;

  const whereConditions: string[] = [];

  if (level) {
    whereConditions.push(`level = '${level}'`);
  }

  if (log_type) {
    whereConditions.push(`log_type = '${log_type}'`);
  }

  if (service) {
    whereConditions.push(`service = '${service}'`);
  }

  if (service_name) {
    whereConditions.push(`service_name = '${service_name}'`);
  }

  if (service_ip) {
    whereConditions.push(`service_ip = '${service_ip}'`);
  }

  if (appid) {
    whereConditions.push(`appid = '${appid}'`);
  }

  if (enterprise_id) {
    whereConditions.push(`enterprise_id = '${enterprise_id}'`);
  }

  if (user_id) {
    whereConditions.push(`user_id = '${user_id}'`);
  }

  if (startTime) {
    whereConditions.push(`timestamp >= '${startTime}'`);
  }

  if (endTime) {
    whereConditions.push(`timestamp <= '${endTime}'`);
  }

  if (keyword) {
    whereConditions.push(`message LIKE '%${keyword}%'`);
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    SELECT *
    FROM ${clickhouseConfig.database}.application_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  try {
    const result = await clickhouseClient.query({
      query: query,
      format: "JSONEachRow",
    });

    const data = (await result.json()) as LogData[];
    return data;
  } catch (error) {
    await dbLogger.error("查询日志失败", {
      error: (error as Error).message,
      options: JSON.stringify(options),
    });
    throw error;
  }
};

/**
 * 获取日志统计信息
 */
export const getLogStats = async (
  timeRange: string = "24h"
): Promise<LogStats[]> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  // 使用DateTime工具类获取时间条件
  const timeCondition = DateTime.getClickHouseTimeCondition(timeRange);

  const query = `
    SELECT 
      level,
      count() as count,
      service,
      toHour(timestamp) as hour
    FROM ${clickhouseConfig.database}.application_logs
    WHERE ${timeCondition}
    GROUP BY level, service, hour
    ORDER BY hour DESC, count DESC
  `;

  try {
    const result = await clickhouseClient.query({
      query: query,
      format: "JSONEachRow",
    });

    const data = (await result.json()) as LogStats[];
    return data;
  } catch (error) {
    await dbLogger.error("获取日志统计失败", {
      error: (error as Error).message,
      timeRange,
    });
    throw error;
  }
};

/**
 * 关闭连接
 */
export const closeConnection = async (): Promise<void> => {
  if (clickhouseClient) {
    await clickhouseClient.close();
    console.log("🔒 ClickHouse连接已关闭");
  }
};

/**
 * 获取客户端实例
 */
export const getClient = (): ClickHouseClient | null => {
  return clickhouseClient;
};

/**
 * 导出ClickHouse客户端实例
 */
export { clickhouseClient };

/**
 * 数据库实例对象（用于健康检查和其他操作）
 */
export const database = {
  /**
   * 检查数据库连接
   */
  async ping(): Promise<{ success: boolean }> {
    if (!clickhouseClient) {
      throw new Error("ClickHouse客户端未初始化");
    }

    await clickhouseClient.ping();
    return { success: true };
  },

  /**
   * 真实的数据库连接和权限检查
   */
  async healthCheck(): Promise<{
    success: boolean;
    details: {
      serverPing: boolean;
      databaseAccess: boolean;
      tableAccess: boolean;
      error?: string;
    };
  }> {
    if (!clickhouseClient) {
      throw new Error("ClickHouse客户端未初始化");
    }

    const details = {
      serverPing: false,
      databaseAccess: false,
      tableAccess: false,
      error: undefined as string | undefined,
    };

    try {
      // 1. 检查服务器连接
      await clickhouseClient.ping();
      details.serverPing = true;

      // 2. 检查数据库访问权限
      await clickhouseClient.query({
        query: `SELECT 1 FROM system.databases WHERE name = '${clickhouseConfig.database}'`,
        format: "JSONEachRow",
      });
      details.databaseAccess = true;

      // 3. 检查日志表是否存在和可访问
      const tableCheckResult = await clickhouseClient.query({
        query: `SELECT COUNT(*) as count FROM ${clickhouseConfig.database}.application_logs LIMIT 1`,
        format: "JSONEachRow",
      });

      // 尝试读取结果以确保查询真的执行成功了
      await tableCheckResult.json();
      details.tableAccess = true;

      return {
        success: true,
        details,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      details.error = errorMessage;
      console.error("❌ 数据库健康检查失败:", errorMessage);

      return {
        success: false,
        details,
      };
    }
  },

  /**
   * 获取客户端实例
   */
  getClient(): ClickHouseClient | null {
    return clickhouseClient;
  },

  /**
   * 检查客户端是否已初始化
   */
  isInitialized(): boolean {
    return clickhouseClient !== null;
  },
};

/**
 * 插入API请求日志数据
 */
export const insertApiRequestLog = async (
  logData: ApiRequestLogData
): Promise<DatabaseInsertResult> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  try {
    // 预处理数据，确保所有字段格式正确
    const processedData = {
      ...logData,
      // 确保复杂字段是字符串格式
      headers:
        typeof logData.headers === "string"
          ? logData.headers
          : JSON.stringify(logData.headers || {}),
      response_headers:
        typeof logData.response_headers === "string"
          ? logData.response_headers
          : JSON.stringify(logData.response_headers || {}),
      // 转换时间戳为 ClickHouse 兼容格式
      timestamp: DateTime.toClickHouseFormat(logData.timestamp),
    };

    // 验证必填字段
    if (!processedData.timestamp) {
      throw new Error("时间戳字段不能为空");
    }

    if (!processedData.method) {
      throw new Error("HTTP方法字段不能为空");
    }

    if (!processedData.url) {
      throw new Error("URL字段不能为空");
    }

    if (!processedData.status_code) {
      throw new Error("状态码字段不能为空");
    }

    if (
      processedData.response_time === undefined ||
      processedData.response_time === null
    ) {
      throw new Error("响应时间字段不能为空");
    }

    const result = await clickhouseClient.insert({
      table: `${clickhouseConfig.database}.api_request_logs`,
      values: [processedData],
      format: "JSONEachRow",
    });

    return result as DatabaseInsertResult;
  } catch (error) {
    console.error("❌ 插入API请求日志失败:", (error as Error).message);
    console.error("❌ 原始数据:", JSON.stringify(logData, null, 2));

    // 记录详细错误到日志系统
    try {
      await dbLogger.error("ClickHouse API日志插入失败", {
        error: (error as Error).message,
        method: logData.method,
        url: logData.url,
        appid: logData.appid,
        enterprise_id: logData.enterprise_id,
        status_code: logData.status_code,
      });
    } catch {
      // 静默处理logger错误
    }

    throw error;
  }
};

/**
 * 查询API请求日志数据
 */
export const queryApiRequestLogs = async (
  options: ApiRequestLogQueryOptions = {}
): Promise<ApiRequestLogData[]> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  const {
    limit = 100,
    offset = 0,
    startTime = null,
    endTime = null,
    method = null,
    status_code = null,
    service_name = null,
    service_type = null,
    appid = null,
    app_name = null,
    enterprise_id = null,
    enterprise_name = null,
    user_id = null,
    ip_address = null,
    real_ip = null,
    min_response_time = null,
    max_response_time = null,
    has_error = null,
    error_code = null,
    keyword = null,
    sort_by = "timestamp",
    sort_order = "DESC",
  } = options;

  const whereConditions: string[] = [];

  // 时间过滤
  if (startTime) {
    whereConditions.push(`timestamp >= '${startTime}'`);
  }

  if (endTime) {
    whereConditions.push(`timestamp <= '${endTime}'`);
  }

  // 基础过滤
  if (method) {
    whereConditions.push(`method = '${method}'`);
  }

  if (status_code) {
    whereConditions.push(`status_code = ${status_code}`);
  }

  if (service_name) {
    whereConditions.push(`service_name = '${service_name}'`);
  }

  if (service_type) {
    whereConditions.push(`service_type = '${service_type}'`);
  }

  // 应用和企业过滤
  if (appid) {
    whereConditions.push(`appid = '${appid}'`);
  }

  if (app_name) {
    whereConditions.push(`app_name = '${app_name}'`);
  }

  if (enterprise_id) {
    whereConditions.push(`enterprise_id = '${enterprise_id}'`);
  }

  if (enterprise_name) {
    whereConditions.push(`enterprise_name = '${enterprise_name}'`);
  }

  // 用户和会话过滤
  if (user_id) {
    whereConditions.push(`user_id = '${user_id}'`);
  }

  if (ip_address) {
    whereConditions.push(`ip_address = '${ip_address}'`);
  }

  if (real_ip) {
    whereConditions.push(`real_ip = '${real_ip}'`);
  }

  // 性能过滤
  if (min_response_time !== null) {
    whereConditions.push(`response_time >= ${min_response_time}`);
  }

  if (max_response_time !== null) {
    whereConditions.push(`response_time <= ${max_response_time}`);
  }

  // 错误过滤
  if (has_error !== null) {
    if (has_error) {
      whereConditions.push(`(status_code >= 400 OR error_code != '')`);
    } else {
      whereConditions.push(`(status_code < 400 AND error_code = '')`);
    }
  }

  if (error_code) {
    whereConditions.push(`error_code = '${error_code}'`);
  }

  // 关键词搜索
  if (keyword) {
    whereConditions.push(
      `(url LIKE '%${keyword}%' OR error_message LIKE '%${keyword}%' OR user_agent LIKE '%${keyword}%')`
    );
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    SELECT *
    FROM ${clickhouseConfig.database}.api_request_logs
    ${whereClause}
    ORDER BY ${sort_by} ${sort_order}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  try {
    const result = await clickhouseClient.query({
      query: query,
      format: "JSONEachRow",
    });

    const data = (await result.json()) as ApiRequestLogData[];
    return data;
  } catch (error) {
    await dbLogger.error("查询API请求日志失败", {
      error: (error as Error).message,
      options: JSON.stringify(options),
    });
    throw error;
  }
};

/**
 * 获取API请求日志统计信息
 */
export const getApiRequestLogStats = async (
  timeRange: string = "24h",
  groupBy: string = "hour"
): Promise<ApiRequestLogStats[]> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  // 使用DateTime工具类获取时间条件
  const timeCondition = DateTime.getClickHouseTimeCondition(timeRange);

  let timeGroupBy = "";
  switch (groupBy) {
    case "hour":
      timeGroupBy =
        "toStartOfHour(timestamp) as timestamp, toHour(timestamp) as hour";
      break;
    case "day":
      timeGroupBy =
        "toStartOfDay(timestamp) as timestamp, toDate(timestamp) as date";
      break;
    case "minute":
      timeGroupBy = "toStartOfMinute(timestamp) as timestamp";
      break;
    default:
      timeGroupBy =
        "toStartOfHour(timestamp) as timestamp, toHour(timestamp) as hour";
  }

  const query = `
    SELECT 
      ${timeGroupBy},
      
      -- 基础指标
      count() as total_requests,
      uniq(user_id) as unique_users,
      uniq(ip_address) as unique_ips,
      
      -- 状态码分布
      countIf(status_code >= 200 AND status_code < 300) as success_count,
      countIf(status_code >= 300 AND status_code < 400) as redirect_count,
      countIf(status_code >= 400 AND status_code < 500) as client_error_count,
      countIf(status_code >= 500) as server_error_count,
      
      -- 性能指标
      avg(response_time) as avg_response_time,
      quantile(0.5)(response_time) as p50_response_time,
      quantile(0.9)(response_time) as p90_response_time,
      quantile(0.95)(response_time) as p95_response_time,
      quantile(0.99)(response_time) as p99_response_time,
      
      -- 流量指标
      sum(response_size) as total_bytes_sent,
      sum(body_size) as total_bytes_received,
      
      -- 错误率
      (countIf(status_code >= 400) * 100.0 / count()) as error_rate,
      
      -- 服务信息
      any(service_name) as service_name
      
    FROM ${clickhouseConfig.database}.api_request_logs
    WHERE ${timeCondition}
    GROUP BY ${timeGroupBy.split(" as ")[0]}
    ORDER BY timestamp DESC
  `;

  try {
    const result = await clickhouseClient.query({
      query: query,
      format: "JSONEachRow",
    });

    const data = (await result.json()) as ApiRequestLogStats[];
    return data;
  } catch (error) {
    await dbLogger.error("获取API请求日志统计失败", {
      error: (error as Error).message,
      timeRange,
      groupBy,
    });
    throw error;
  }
};

/**
 * 获取热门端点统计
 */
export const getTopEndpoints = async (
  timeRange: string = "24h",
  limit: number = 10
): Promise<
  Array<{ endpoint: string; count: number; avg_response_time: number }>
> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  const timeCondition = DateTime.getClickHouseTimeCondition(timeRange);

  const query = `
    SELECT 
      path as endpoint,
      count() as count,
      avg(response_time) as avg_response_time
    FROM ${clickhouseConfig.database}.api_request_logs
    WHERE ${timeCondition} AND path != ''
    GROUP BY path
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  try {
    const result = await clickhouseClient.query({
      query: query,
      format: "JSONEachRow",
    });

    const data = (await result.json()) as Array<{
      endpoint: string;
      count: number;
      avg_response_time: number;
    }>;
    return data;
  } catch (error) {
    await dbLogger.error("获取热门端点统计失败", {
      error: (error as Error).message,
      timeRange,
      limit,
    });
    throw error;
  }
};

/**
 * 获取错误统计
 */
export const getErrorStats = async (
  timeRange: string = "24h",
  limit: number = 10
): Promise<
  Array<{ error_code: string; error_message: string; count: number }>
> => {
  if (!clickhouseClient) {
    throw new Error("ClickHouse客户端未初始化");
  }

  const timeCondition = DateTime.getClickHouseTimeCondition(timeRange);

  const query = `
    SELECT 
      error_code,
      error_message,
      count() as count
    FROM ${clickhouseConfig.database}.api_request_logs
    WHERE ${timeCondition} AND (status_code >= 400 OR error_code != '')
    GROUP BY error_code, error_message
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  try {
    const result = await clickhouseClient.query({
      query: query,
      format: "JSONEachRow",
    });

    const data = (await result.json()) as Array<{
      error_code: string;
      error_message: string;
      count: number;
    }>;
    return data;
  } catch (error) {
    await dbLogger.error("获取错误统计失败", {
      error: (error as Error).message,
      timeRange,
      limit,
    });
    throw error;
  }
};
