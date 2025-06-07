import { createClient, ClickHouseClient } from '@clickhouse/client';
import { LogData, LogQueryOptions, LogStats, ClickHouseConfig, DatabaseInsertResult } from '../types';
import DateTime from '../utils/datetime';

// ClickHouse 配置
const clickhouseConfig: ClickHouseConfig = {
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:18123',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'changeme',
  database: process.env.CLICKHOUSE_DATABASE || 'default',
  // 连接选项
  clickhouse_settings: {
    // 异步插入，适合高并发场景
    async_insert: 1,
    wait_for_async_insert: 0,
  },
  // 会话设置
  session_timeout: 60000,
  // 压缩设置
  compression: {
    response: true,
    request: false,
  }
};

// 创建ClickHouse客户端
let clickhouseClient: ClickHouseClient | null = null;

/**
 * 初始化ClickHouse连接
 */
export const initClickHouse = async (): Promise<ClickHouseClient> => {
  try {
    clickhouseClient = createClient(clickhouseConfig);
    
    // 测试连接
    const result = await clickhouseClient.ping();
    console.log('✅ ClickHouse连接成功:', result);
    
    // 创建数据库（如果不存在）
    await clickhouseClient.command({
      query: `CREATE DATABASE IF NOT EXISTS ${clickhouseConfig.database}`,
    });
    
    // 创建日志表（如果不存在）
    await createLogTable();
    
    return clickhouseClient;
  } catch (error) {
    console.error('❌ ClickHouse连接失败:', (error as Error).message);
    throw error;
  }
};

/**
 * 创建日志表
 */
const createLogTable = async (): Promise<void> => {
  if (!clickhouseClient) {
    throw new Error('ClickHouse客户端未初始化');
  }

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${clickhouseConfig.database}.application_logs (
      id UUID DEFAULT generateUUIDv4(),
      timestamp DateTime64(3) DEFAULT now64(),
      level String,
      message String,
      service String DEFAULT '',
      host String DEFAULT '',
      user_id String DEFAULT '',
      session_id String DEFAULT '',
      request_id String DEFAULT '',
      ip String DEFAULT '',
      user_agent String DEFAULT '',
      url String DEFAULT '',
      method String DEFAULT '',
      status_code UInt16 DEFAULT 0,
      response_time UInt32 DEFAULT 0,
      error_stack String DEFAULT '',
      extra_data String DEFAULT '',
      created_date Date DEFAULT today()
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (timestamp, level, service)
    TTL toDateTime(timestamp) + INTERVAL 90 DAY
    SETTINGS index_granularity = 8192
  `;
  
  try {
    await clickhouseClient.command({
      query: createTableQuery,
    });
    console.log('✅ 日志表创建成功');
  } catch (error) {
    console.error('❌ 创建日志表失败:', (error as Error).message);
    throw error;
  }
};

/**
 * 插入日志数据
 */
export const insertLog = async (logData: LogData): Promise<DatabaseInsertResult> => {
  if (!clickhouseClient) {
    throw new Error('ClickHouse客户端未初始化');
  }

  try {
    const result = await clickhouseClient.insert({
      table: `${clickhouseConfig.database}.application_logs`,
      values: [logData],
      format: 'JSONEachRow',
    });
    return result as DatabaseInsertResult;
  } catch (error) {
    console.error('❌ 插入日志失败:', (error as Error).message);
    throw error;
  }
};

/**
 * 查询日志数据
 */
export const queryLogs = async (options: LogQueryOptions = {}): Promise<LogData[]> => {
  if (!clickhouseClient) {
    throw new Error('ClickHouse客户端未初始化');
  }

  const {
    limit = 100,
    offset = 0,
    level = null,
    service = null,
    startTime = null,
    endTime = null,
    keyword = null
  } = options;
  
  const whereConditions: string[] = [];
  
  if (level) {
    whereConditions.push(`level = '${level}'`);
  }
  
  if (service) {
    whereConditions.push(`service = '${service}'`);
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
  
  const whereClause = whereConditions.length > 0 ? 
    `WHERE ${whereConditions.join(' AND ')}` : '';
  
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
      format: 'JSONEachRow',
    });
    
    const data = await result.json() as LogData[];
    return data;
  } catch (error) {
    console.error('❌ 查询日志失败:', (error as Error).message);
    throw error;
  }
};

/**
 * 获取日志统计信息
 */
export const getLogStats = async (timeRange: string = '24h'): Promise<LogStats[]> => {
  if (!clickhouseClient) {
    throw new Error('ClickHouse客户端未初始化');
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
      format: 'JSONEachRow',
    });
    
    const data = await result.json() as LogStats[];
    return data;
  } catch (error) {
    console.error('❌ 获取日志统计失败:', (error as Error).message);
    throw error;
  }
};

/**
 * 关闭连接
 */
export const closeConnection = async (): Promise<void> => {
  if (clickhouseClient) {
    await clickhouseClient.close();
    console.log('🔒 ClickHouse连接已关闭');
  }
};

/**
 * 获取客户端实例
 */
export const getClient = (): ClickHouseClient | null => {
  return clickhouseClient;
}; 