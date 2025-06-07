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
  }
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
    console.error('❌ ClickHouse初始连接失败:', (error as Error).message);
    console.warn('⚠️ 服务将在离线模式下启动，健康检查服务会持续尝试重连');
    
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
    console.log('✅ ClickHouse重连成功');
    
    // 确保数据库和表存在
    await clickhouseClient.command({
      query: `CREATE DATABASE IF NOT EXISTS ${clickhouseConfig.database}`,
    });
    
    await createLogTable();
    
    return true;
  } catch (error) {
    console.error('❌ ClickHouse重连失败:', (error as Error).message);
    clickhouseClient = null;
    return false;
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
    // 预处理数据，确保所有字段格式正确
    const processedData = {
      ...logData,
      // 确保 extra_data 是字符串格式
      extra_data: typeof logData.extra_data === 'string' ? 
        logData.extra_data : 
        JSON.stringify(logData.extra_data || {}),
      // 转换时间戳为 ClickHouse 兼容格式 (YYYY-MM-DD HH:mm:ss.SSS)
      timestamp: DateTime.toClickHouseFormat(logData.timestamp)
    };

    // 验证数据格式
    if (!processedData.timestamp) {
      throw new Error('时间戳字段不能为空');
    }

    if (!processedData.message) {
      throw new Error('消息字段不能为空');
    }

    const result = await clickhouseClient.insert({
      table: `${clickhouseConfig.database}.application_logs`,
      values: [processedData],
      format: 'JSONEachRow',
    });
    return result as DatabaseInsertResult;
  } catch (error) {
    console.error('❌ 插入日志失败:', (error as Error).message);
    console.error('❌ 原始数据:', JSON.stringify(logData, null, 2));
    
         // 尝试解析并输出处理后的数据
     try {
       const debugData = {
         ...logData,
         extra_data: typeof logData.extra_data === 'string' ? 
           logData.extra_data : 
           JSON.stringify(logData.extra_data || {}),
         timestamp: DateTime.toClickHouseFormat(logData.timestamp)
       };
       console.error('❌ 处理后数据:', JSON.stringify(debugData, null, 2));
     } catch (debugError) {
       console.error('❌ 数据调试输出失败:', debugError);
     }
    
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

/**
 * 数据库实例对象（用于健康检查和其他操作）
 */
export const database = {
  /**
   * 检查数据库连接
   */
  async ping(): Promise<{ success: boolean }> {
    if (!clickhouseClient) {
      throw new Error('ClickHouse客户端未初始化');
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
    }
  }> {
    if (!clickhouseClient) {
      throw new Error('ClickHouse客户端未初始化');
    }

    const details = {
      serverPing: false,
      databaseAccess: false,
      tableAccess: false,
      error: undefined as string | undefined
    };

    try {
      // 1. 检查服务器连接
      await clickhouseClient.ping();
      details.serverPing = true;
      console.log('✅ 服务器 ping 成功');

      // 2. 检查数据库访问权限
      await clickhouseClient.query({
        query: `SELECT 1 FROM system.databases WHERE name = '${clickhouseConfig.database}'`,
        format: 'JSONEachRow'
      });
      details.databaseAccess = true;
      console.log('✅ 数据库访问成功');

      // 3. 检查日志表是否存在和可访问
      const tableCheckResult = await clickhouseClient.query({
        query: `SELECT COUNT(*) as count FROM ${clickhouseConfig.database}.application_logs LIMIT 1`,
        format: 'JSONEachRow'
      });
      
      // 尝试读取结果以确保查询真的执行成功了
      await tableCheckResult.json();
      details.tableAccess = true;
      console.log('✅ 日志表访问成功');

      return {
        success: true,
        details
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      details.error = errorMessage;
      console.error('❌ 数据库健康检查失败:', errorMessage);
      
      return {
        success: false,
        details
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
  }
}; 