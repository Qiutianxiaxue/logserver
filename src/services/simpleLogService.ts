import { initClickHouse, closeConnection } from "../config/database";
import { SimpleLogReceiver } from "../websocket/simpleLogReceiver";
import { logger } from "../utils/logger";

/**
 * 简化的日志服务配置
 */
export interface SimpleLogServiceConfig {
  // WebSocket配置
  wsUrl?: string;
  serviceId?: string;
  serviceName?: string;

  // 数据库配置
  autoInitDatabase?: boolean;
}

/**
 * 简化的日志服务类
 */
export class SimpleLogService {
  private logReceiver: SimpleLogReceiver | null = null;
  private config: SimpleLogServiceConfig;
  private isInitialized = false;

  constructor(config: SimpleLogServiceConfig = {}) {
    this.config = {
      wsUrl:
        process.env.WS_URL ||
        process.env.LOG_WEBSOCKET_URL ||
        "ws://localhost:13001",
      serviceId: process.env.SERVICE_ID || "log-service-001",
      serviceName: process.env.SERVICE_NAME || "ClickHouse日志服务",
      autoInitDatabase: config.autoInitDatabase !== false, // 默认为true
      ...config,
    };
  }

  /**
   * 初始化服务
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warnSync("⚠️ 日志服务已经初始化");
      return;
    }

    logger.infoSync("🚀 正在初始化简化日志服务...");

    try {
      // 1. 初始化数据库（如果需要）
      if (this.config.autoInitDatabase) {
        logger.infoSync("📊 正在初始化数据库连接...");
        await initClickHouse();
        logger.infoSync("✅ 数据库连接初始化成功");
      }

      // 2. 创建并连接WebSocket日志接收器
      logger.infoSync("📡 正在初始化WebSocket日志接收器...");
      this.logReceiver = new SimpleLogReceiver(
        this.config.serviceId!,
        this.config.serviceName!
      );

      // 连接到中间服务器
      this.logReceiver.connect(this.config.wsUrl!);
      logger.infoSync("✅ WebSocket日志接收器初始化成功");

      this.isInitialized = true;
      logger.infoSync("🎉 简化日志服务初始化完成");
    } catch (error) {
      logger.errorSync("❌ 简化日志服务初始化失败:", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  public getStatus() {
    return {
      initialized: this.isInitialized,
      config: {
        wsUrl: this.config.wsUrl,
        serviceId: this.config.serviceId,
        serviceName: this.config.serviceName,
      },
      websocket: this.logReceiver ? this.logReceiver.getStats() : null,
      uptime: process.uptime(),
    };
  }

  /**
   * 发送消息到中间服务器
   */
  public sendMessage(message: any): boolean {
    if (!this.logReceiver) {
      logger.warnSync("⚠️ WebSocket日志接收器未初始化");
      return false;
    }
    return this.logReceiver.sendMessage(message);
  }

  /**
   * 关闭服务
   */
  public async shutdown(): Promise<void> {
    logger.infoSync("🔒 正在关闭简化日志服务...");

    try {
      // 1. 断开WebSocket连接
      if (this.logReceiver) {
        this.logReceiver.disconnect();
        this.logReceiver = null;
        logger.infoSync("✅ WebSocket连接已断开");
      }

      // 2. 关闭数据库连接
      if (this.config.autoInitDatabase) {
        logger.infoSync("📊 正在关闭数据库连接...");
        await closeConnection();
        logger.infoSync("✅ 数据库连接已关闭");
      }

      this.isInitialized = false;
      logger.infoSync("🎯 简化日志服务已完全关闭");
    } catch (error) {
      logger.errorSync("❌ 关闭简化日志服务时发生错误:", {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

/**
 * 全局简化日志服务实例
 */
let simpleLogService: SimpleLogService | null = null;

/**
 * 启动简化日志服务
 */
export const startSimpleLogService = async (
  config: SimpleLogServiceConfig = {}
): Promise<SimpleLogService> => {
  if (simpleLogService) {
    logger.warnSync("⚠️ 简化日志服务已经启动");
    return simpleLogService;
  }

  simpleLogService = new SimpleLogService(config);
  await simpleLogService.initialize();

  // 设置进程退出时的清理
  const gracefulShutdown = async (signal: string) => {
    logger.infoSync(`\n📡 收到 ${signal} 信号，正在优雅关闭简化日志服务...`);
    try {
      if (simpleLogService) {
        await simpleLogService.shutdown();
        simpleLogService = null;
      }
      logger.infoSync("✅ 简化日志服务已安全关闭");
      process.exit(0);
    } catch (error) {
      logger.errorSync("❌ 关闭简化日志服务时发生错误:", {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  return simpleLogService;
};

/**
 * 获取简化日志服务实例
 */
export const getSimpleLogService = (): SimpleLogService | null => {
  return simpleLogService;
};
