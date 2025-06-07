// 加载环境变量配置
import 'dotenv/config';

import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { initClickHouse, closeConnection } from './config/database';
import { ApiResponse, HttpError } from './types';
import routes from './routes';
import { DatabaseHealth } from './utils/databaseHealth';

const app: Application = express();

// 环境变量配置
const PORT: number = parseInt(process.env.PORT || '3000');
const NODE_ENV: string = process.env.NODE_ENV || 'development';
const API_PREFIX: string = process.env.API_PREFIX || '/api';
const LOG_LEVEL: string = process.env.LOG_LEVEL || 'combined';

// 中间件配置
app.use(helmet()); // 安全头部
app.use(cors()); // 跨域支持
app.use(morgan(LOG_LEVEL)); // 日志记录，使用环境变量配置
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true, limit: process.env.URL_LIMIT || '10mb' })); // URL编码解析

// 挂载路由
app.use('/', routes);

// 404处理
app.use('*', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: '接口不存在',
    data: {
      path: req.originalUrl
    }
  };
  res.status(404).json(response);
});

// 错误处理中间件
app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
  console.error('服务器错误:', err);
  const response: ApiResponse = {
    success: false,
    error: '服务器内部错误',
    message: err.message
  };
  res.status(err.status || err.statusCode || 500).json(response);
});

// 初始化数据库并启动服务器
const startServer = async (): Promise<void> => {
  try {
    // 尝试初始化ClickHouse连接（失败不会阻止服务启动）
    const dbClient = await initClickHouse();
    
    if (dbClient) {
      console.log('✅ 数据库初始化成功，服务将在在线模式下运行');
    } else {
      console.warn('⚠️ 数据库初始化失败，服务将在离线模式下运行');
      console.warn('📦 日志将被缓存到本地，等待数据库恢复后自动同步');
    }
    
    // 初始化并启动数据库健康检查（无论数据库是否可用都要启动）
    const databaseHealth = DatabaseHealth.getInstance();
    if (!databaseHealth.isHealthCheckRunning()) {
      await databaseHealth.startHealthCheck();
    }
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/health`);
      console.log(`📝 日志API: http://localhost:${PORT}${API_PREFIX}/logs`);
      console.log(`📈 日志统计: http://localhost:${PORT}${API_PREFIX}/logs/stats`);
      console.log(`💾 缓存状态: http://localhost:${PORT}${API_PREFIX}/logs/cache/status`);
      console.log(`🔧 系统报告: http://localhost:${PORT}${API_PREFIX}/logs/system/health`);
      console.log(`🌍 运行环境: ${NODE_ENV}`);
      console.log(`🔄 运行模式: ${dbClient ? '在线模式' : '离线模式（缓存模式）'}`);
      if (NODE_ENV === 'development') {
        console.log(`📋 环境变量已加载: ${process.env.NODE_ENV ? '✅' : '❌'}`);
      }
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', (error as Error).message);
    process.exit(1);
  }
};

// 优雅关闭处理
process.on('SIGTERM', async () => {
  console.log('🛑 收到SIGTERM信号，正在关闭服务器...');
  
  // 停止数据库健康检查
  const databaseHealth = DatabaseHealth.getInstance();
  databaseHealth.stopHealthCheck();
  
  // 关闭数据库连接
  await closeConnection();
  
  console.log('👋 服务器已优雅关闭');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 收到SIGINT信号，正在关闭服务器...');
  
  // 停止数据库健康检查
  const databaseHealth = DatabaseHealth.getInstance();
  databaseHealth.stopHealthCheck();
  
  // 关闭数据库连接
  await closeConnection();
  
  console.log('👋 服务器已优雅关闭');
  process.exit(0);
});

// 启动服务器
startServer();

export default app; 