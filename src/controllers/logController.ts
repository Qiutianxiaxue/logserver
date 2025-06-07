import { Request, Response } from 'express';
import { insertLog, queryLogs, getLogStats } from '../config/database';
import { LogData, LogQueryOptions, ApiResponse } from '../types';
import { asyncHandler } from '../types/controller';
import DateTime from '../utils/datetime';
import { ResponseFormatter } from '../utils/responseFormatter';
import { LogCache } from '../utils/logCache';
import { DatabaseHealth } from '../utils/databaseHealth';

/**
 * 查询日志列表
 */
export const getLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const queryParams = req.query;
  
  const options: LogQueryOptions = {
    limit: queryParams.limit ? parseInt(queryParams.limit as string) : 100,
    offset: queryParams.offset ? parseInt(queryParams.offset as string) : 0,
    level: queryParams.level as string || undefined,
    service: queryParams.service as string || undefined,
    startTime: queryParams.startTime as string || undefined,
    endTime: queryParams.endTime as string || undefined,
    keyword: queryParams.keyword as string || undefined
  };
  
  const logs = await queryLogs(options);
  
  const response: ApiResponse<LogData[]> = {
    success: true,
    data: ResponseFormatter.formatLogList(logs),
    count: logs.length,
    environment: NODE_ENV,
    timestamp: DateTime.now()
  };
  
  res.json(response);
});

/**
 * 创建日志记录
 */
export const createLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const body = req.body;
  
  // 数据验证
  if (!body.message) {
    const response: ApiResponse = {
      success: false,
      error: '日志消息不能为空'
    };
    res.status(400).json(response);
    return;
  }
  
  // 验证时间戳格式（如果提供）
  let timestamp = DateTime.nowISO(); // 数据库存储使用ISO格式
  if (body.timestamp) {
    if (DateTime.isValid(body.timestamp)) {
      timestamp = DateTime.toISOString(body.timestamp);
    } else {
      const response: ApiResponse = {
        success: false,
        error: '时间戳格式无效，支持格式: YYYY-MM-DD HH:mm:ss 或 ISO 8601'
      };
      res.status(400).json(response);
      return;
    }
  }

  // 构建日志数据
  const logData: LogData = {
    level: body.level || 'info',
    message: body.message,
    service: body.service || 'unknown',
    host: body.host || req.hostname,
    user_id: body.user_id || '',
    session_id: body.session_id || '',
    request_id: body.request_id || '',
    ip: req.ip || req.socket.remoteAddress || '',
    user_agent: req.get('User-Agent') || '',
    url: body.url || '',
    method: body.method || req.method,
    status_code: body.status_code || 0,
    response_time: body.response_time || 0,
    error_stack: body.error_stack || '',
    extra_data: body.extra_data || {},
    timestamp: timestamp
  };
  
  // 检查数据库健康状态并决定写入策略
  const databaseHealth = DatabaseHealth.getInstance();
  const logCache = LogCache.getInstance();
  
  // 主动检查数据库健康状态
  if (!databaseHealth.getHealthStatus().isHealthy) {
    // 数据库不健康，直接缓存
    console.log('⚠️ 数据库不健康，直接缓存日志');
    
    try {
      await logCache.addToCache(logData);
      
      const cacheInfo = await logCache.getCacheInfo();
      
      const response: ApiResponse = {
        success: true,
        message: '数据库暂时不可用，日志已缓存到本地',
        data: {
          cached: true,
          totalCached: cacheInfo.count
        },
        timestamp: DateTime.now()
      };
      
      res.json(response);
      return;
    } catch (cacheError) {
      console.error('❌ 缓存日志失败:', cacheError);
      
      const response: ApiResponse = {
        success: false,
        error: '日志存储失败，数据库和缓存都不可用',
        timestamp: DateTime.now()
      };
      
      res.status(500).json(response);
      return;
    }
  }
  
  // 数据库健康，尝试直接写入
  try {
    await insertLog(logData);
    
    if (NODE_ENV === 'development') {
      console.log('✅ 日志已存储:', logData);
    }
    
    const response: ApiResponse = {
      success: true,
      message: '日志已成功存储',
      timestamp: DateTime.now()
    };
    
    res.json(response);
  } catch (error) {
    // 数据库插入失败，尝试缓存
    console.warn('⚠️ 数据库写入失败，转为缓存模式:', error);
    
    try {
      await logCache.addToCache(logData);
      
      const cacheInfo = await logCache.getCacheInfo();
      
      const response: ApiResponse = {
        success: true,
        message: '数据库暂时不可用，日志已缓存到本地',
        data: {
          cached: true,
          totalCached: cacheInfo.count
        },
        timestamp: DateTime.now()
      };
      
      res.json(response);
    } catch (cacheError) {
      // 缓存也失败了
      console.error('❌ 缓存日志也失败:', cacheError);
      
      const response: ApiResponse = {
        success: false,
        error: '日志存储失败，数据库和缓存都不可用',
        timestamp: DateTime.now()
      };
      
      res.status(500).json(response);
         }
   }
});

/**
 * 获取缓存状态信息
 */
export const getCacheStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const logCache = LogCache.getInstance();
  const databaseHealth = DatabaseHealth.getInstance();
  
  const cacheInfo = await logCache.getCacheInfo();
  const healthStatus = databaseHealth.getHealthStatus();
  
  const response: ApiResponse = {
    success: true,
    data: {
      cache: cacheInfo,
      database: healthStatus,
      timestamp: DateTime.now()
    }
  };
  
  res.json(response);
});

/**
 * 手动触发缓存处理
 */
export const processCachedLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const databaseHealth = DatabaseHealth.getInstance();
  
  const result = await databaseHealth.triggerCacheProcessing();
  
  const response: ApiResponse = {
    success: result.success,
    message: result.message,
    data: {
      processed: result.processed,
      failed: result.failed,
      errors: result.errors
    },
    timestamp: DateTime.now()
  };
  
  if (result.success) {
    res.json(response);
  } else {
    res.status(500).json(response);
  }
});

/**
 * 清空缓存
 */
export const clearCache = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const logCache = LogCache.getInstance();
  
  await logCache.clearCache();
  
  const response: ApiResponse = {
    success: true,
    message: '缓存已清空',
    timestamp: DateTime.now()
  };
  
  res.json(response);
});

/**
 * 获取详细的系统健康报告
 */
export const getSystemHealthReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const databaseHealth = DatabaseHealth.getInstance();
  
  const report = await databaseHealth.getDetailedHealthReport();
  
  const response: ApiResponse = {
    success: true,
    data: report,
    timestamp: DateTime.now()
  };
  
  res.json(response);
}); 

/**
 * 获取日志统计信息
 */
export const getLogStatistics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { timeRange = '24h' } = req.query;
  
  // 验证时间范围参数
  const validTimeRanges = ['1h', '24h', '7d', '30d', '90d'];
  if (!validTimeRanges.includes(timeRange as string)) {
    const response: ApiResponse = {
      success: false,
      error: '无效的时间范围参数，支持: 1h, 24h, 7d, 30d, 90d'
    };
    res.status(400).json(response);
    return;
  }
  
  const stats = await getLogStats(timeRange as string);
  
  const response: ApiResponse = {
    success: true,
    data: ResponseFormatter.formatLogStats(stats),
    timeRange: timeRange as string,
    timestamp: DateTime.now()
  };
  
  res.json(response);
});

/**
 * 批量创建日志记录
 */
export const createLogsBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const { logs } = req.body;
  
  // 数据验证
  if (!Array.isArray(logs) || logs.length === 0) {
    const response: ApiResponse = {
      success: false,
      error: '日志数组不能为空'
    };
    res.status(400).json(response);
    return;
  }
  
  if (logs.length > 1000) {
    const response: ApiResponse = {
      success: false,
      error: '单次批量插入不能超过1000条记录'
    };
    res.status(400).json(response);
    return;
  }
  
  // 处理每条日志
  const processedLogs: LogData[] = logs.map((logItem: any) => {
    // 验证时间戳
    let timestamp = DateTime.nowISO(); // 数据库存储使用ISO格式
    if (logItem.timestamp && DateTime.isValid(logItem.timestamp)) {
      timestamp = DateTime.toISOString(logItem.timestamp);
    }

    return {
      level: logItem.level || 'info',
      message: logItem.message || '',
      service: logItem.service || 'unknown',
      host: logItem.host || req.hostname,
      user_id: logItem.user_id || '',
      session_id: logItem.session_id || '',
      request_id: logItem.request_id || '',
      ip: req.ip || req.socket.remoteAddress || '',
      user_agent: req.get('User-Agent') || '',
      url: logItem.url || '',
      method: logItem.method || req.method,
      status_code: logItem.status_code || 0,
      response_time: logItem.response_time || 0,
      error_stack: logItem.error_stack || '',
      extra_data: logItem.extra_data || {},
      timestamp: timestamp
    };
  });
  
  // 检查数据库健康状态并决定写入策略
  const databaseHealth = DatabaseHealth.getInstance();
  const logCache = LogCache.getInstance();
  
  // 主动检查数据库健康状态
  if (!databaseHealth.getHealthStatus().isHealthy) {
    // 数据库不健康，直接缓存
    console.log(`⚠️ 数据库不健康，直接缓存 ${processedLogs.length} 条日志`);
    
    try {
      await logCache.addToCache(processedLogs);
      
      const cacheInfo = await logCache.getCacheInfo();
      
      const response: ApiResponse = {
        success: true,
        message: `数据库暂时不可用，已缓存${processedLogs.length}条日志到本地`,
        data: {
          count: processedLogs.length,
          cached: true,
          totalCached: cacheInfo.count
        },
        timestamp: DateTime.now()
      };
      
      res.json(response);
      return;
    } catch (cacheError) {
      console.error('❌ 批量缓存日志失败:', cacheError);
      
      const response: ApiResponse = {
        success: false,
        error: '批量日志存储失败，数据库和缓存都不可用',
        timestamp: DateTime.now()
      };
      
      res.status(500).json(response);
      return;
    }
  }
  
  // 数据库健康，尝试批量写入
  try {
    const insertPromises = processedLogs.map(logData => insertLog(logData));
    await Promise.all(insertPromises);
    
    if (NODE_ENV === 'development') {
      console.log(`✅ 批量插入${processedLogs.length}条日志成功`);
    }
    
    const response: ApiResponse = {
      success: true,
      message: `成功存储${processedLogs.length}条日志`,
      data: {
        count: processedLogs.length,
        cached: false
      },
      timestamp: DateTime.now()
    };
    
    res.json(response);
  } catch (error) {
    // 批量插入失败，尝试缓存
    console.warn('⚠️ 批量数据库写入失败，转为缓存模式:', error);
    
    try {
      await logCache.addToCache(processedLogs);
      
      const cacheInfo = await logCache.getCacheInfo();
      
      const response: ApiResponse = {
        success: true,
        message: `数据库暂时不可用，已缓存${processedLogs.length}条日志到本地`,
        data: {
          count: processedLogs.length,
          cached: true,
          totalCached: cacheInfo.count
        },
        timestamp: DateTime.now()
      };
      
      res.json(response);
    } catch (cacheError) {
      // 缓存也失败了
      console.error('❌ 批量缓存日志也失败:', cacheError);
      
      const response: ApiResponse = {
        success: false,
        error: '批量日志存储失败，数据库和缓存都不可用',
        timestamp: DateTime.now()
      };
      
      res.status(500).json(response);
    }
  }
}); 