import { Request, Response, NextFunction } from 'express';
import { ApiResponse, TimeRange } from '../types';
import DateTime from '../utils/datetime';

/**
 * 验证时间范围参数中间件
 */
export const validateTimeRange = (req: Request, res: Response, next: NextFunction): void => {
  const { timeRange } = req.query;
  
  if (!timeRange) {
    next();
    return;
  }
  
  const validTimeRanges: TimeRange[] = ['1h', '24h', '7d', '30d', '90d'];
  
  if (!validTimeRanges.includes(timeRange as TimeRange)) {
    const response: ApiResponse = {
      success: false,
      error: '无效的时间范围参数',
      data: {
        validRanges: validTimeRanges,
        received: timeRange
      }
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};

/**
 * 验证日期时间格式中间件
 */
export const validateDateTime = (req: Request, res: Response, next: NextFunction): void => {
  const { startTime, endTime } = req.query;
  
  // 验证开始时间
  if (startTime && !DateTime.isValid(startTime as string)) {
    const response: ApiResponse = {
      success: false,
      error: '开始时间格式无效',
      data: {
        received: startTime,
        expectedFormat: 'YYYY-MM-DD HH:mm:ss 或 ISO 8601 格式，如: 2025-12-11 10:00:00 或 2025-12-11T10:00:00Z'
      }
    };
    res.status(400).json(response);
    return;
  }
  
  // 验证结束时间
  if (endTime && !DateTime.isValid(endTime as string)) {
    const response: ApiResponse = {
      success: false,
      error: '结束时间格式无效',
      data: {
        received: endTime,
        expectedFormat: 'YYYY-MM-DD HH:mm:ss 或 ISO 8601 格式，如: 2025-12-11 10:00:00 或 2025-12-11T10:00:00Z'
      }
    };
    res.status(400).json(response);
    return;
  }
  
  // 验证时间逻辑（开始时间不能晚于结束时间）
  if (startTime && endTime) {
    const start = DateTime.parse(startTime as string);
    const end = DateTime.parse(endTime as string);
    
    if (start.isAfter(end)) {
      const response: ApiResponse = {
        success: false,
        error: '开始时间不能晚于结束时间',
        data: {
          startTime,
          endTime
        }
      };
      res.status(400).json(response);
      return;
    }
  }
  
  next();
};

/**
 * 添加请求时间戳中间件
 */
export const addRequestTimestamp = (req: Request, res: Response, next: NextFunction): void => {
  // 在请求对象上添加时间戳信息
  (req as any).requestTime = {
    iso: DateTime.nowISO(),
    unix: DateTime.unixTimestamp(),
    formatted: DateTime.now()
  };
  
  next();
}; 