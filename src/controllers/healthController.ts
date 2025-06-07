import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import DateTime from '../utils/datetime';

/**
 * 首页信息
 */
export const getHome = (req: Request, res: Response): void => {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  
  const response: ApiResponse = {
    code: 1,
    message: '欢迎使用日志服务器!',
    data: {
      timestamp: DateTime.now(),
      status: 'running',
      environment: NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      server_time: DateTime.format(),
      timezone: process.env.TZ || 'Asia/Shanghai'
    }
  };
  
  res.json(response);
};

/**
 * 健康检查
 */
export const getHealth = (req: Request, res: Response): void => {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  
  const response: ApiResponse = {
    code: 1,
    message: '系统健康状态正常',
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      uptime_human: DateTime.format(DateTime.subtract(DateTime.now(), process.uptime(), 'seconds')),
      timestamp: DateTime.now(),
      server_time: DateTime.format(),
      environment: NODE_ENV,
      memory: process.memoryUsage(),
      pid: process.pid,
      timezone: process.env.TZ || 'Asia/Shanghai'
    }
  };
  
  res.json(response);
}; 