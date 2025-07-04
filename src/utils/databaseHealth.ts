import { database } from "../config/database";
import { LogCache } from "./logCache";
import DateTime from "./datetime";

/**
 * 数据库健康检查和连接管理器
 */
export class DatabaseHealth {
  private static instance: DatabaseHealth;
  private isHealthy: boolean = false; // 默认为 false，需要通过检查确认
  private lastCheckTime: string = DateTime.nowISO();
  private checkInterval: NodeJS.Timeout | null = null;
  private logCache: LogCache;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000; // 5秒
  private healthCheckInterval: number = 30000; // 30秒

  private constructor() {
    this.logCache = LogCache.getInstance();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): DatabaseHealth {
    if (!DatabaseHealth.instance) {
      DatabaseHealth.instance = new DatabaseHealth();
    }
    return DatabaseHealth.instance;
  }

  /**
   * 获取数据库健康状态
   */
  public getHealthStatus(): {
    isHealthy: boolean;
    lastCheckTime: string;
    retryCount: number;
    maxRetries: number;
  } {
    return {
      isHealthy: this.isHealthy,
      lastCheckTime: DateTime.format(this.lastCheckTime),
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
    };
  }

  /**
   * 检查数据库连接
   */
  public async checkDatabaseConnection(): Promise<boolean> {
    try {
      // console.log('🔍 正在执行完整数据库健康检查...');

      // 检查客户端是否已初始化，如果未初始化则尝试重连
      if (!database.isInitialized()) {
        console.log("🔄 数据库客户端未初始化，尝试重新连接...");
        const { reconnectClickHouse } = await import("../config/database");
        const reconnectSuccess = await reconnectClickHouse();

        if (!reconnectSuccess) {
          throw new Error("数据库重连失败");
        }

        // console.log('✅ 数据库重连成功');
      }

      // 执行真实的数据库健康检查
      const healthResult = await database.healthCheck();

      if (healthResult.success) {
        // console.log('✅ 数据库完整健康检查通过');

        const wasUnhealthy = !this.isHealthy;

        if (wasUnhealthy) {
          // console.log('✅ 数据库连接已恢复');
          this.isHealthy = true;
          this.retryCount = 0;

          // 数据库恢复后处理缓存的日志
          await this.processCachedLogsOnReconnect();
        } else {
          // console.log('✅ 数据库连接正常');

          // 即使数据库一直健康，也要检查是否有缓存需要处理
          await this.checkAndProcessPendingCache();
        }

        this.isHealthy = true;
        this.lastCheckTime = DateTime.nowISO();
        return true;
      } else {
        console.error("❌ 数据库健康检查失败:", healthResult.details);

        if (this.isHealthy) {
          console.error("❌ 数据库连接丢失，切换到离线模式");
          this.isHealthy = false;
        }

        this.retryCount++;
        this.lastCheckTime = DateTime.nowISO();

        console.warn(
          `⚠️ 数据库连接检查失败 (重试 ${this.retryCount}/${this.maxRetries})`
        );
        console.warn(
          `  - 服务器 Ping: ${
            healthResult.details.serverPing ? "成功" : "失败"
          }`
        );
        console.warn(
          `  - 数据库访问: ${
            healthResult.details.databaseAccess ? "成功" : "失败"
          }`
        );
        console.warn(
          `  - 日志表访问: ${
            healthResult.details.tableAccess ? "成功" : "失败"
          }`
        );
        if (healthResult.details.error) {
          console.warn(`  - 错误信息: ${healthResult.details.error}`);
        }

        return false;
      }
    } catch (error) {
      console.error("❌ 数据库连接检查异常:", error);

      if (this.isHealthy) {
        console.error("❌ 数据库连接异常，切换到离线模式");
        this.isHealthy = false;
      }

      this.retryCount++;
      this.lastCheckTime = DateTime.nowISO();

      console.warn(
        `⚠️ 数据库连接检查异常 (重试 ${this.retryCount}/${this.maxRetries})`
      );
      return false;
    }
  }

  /**
   * 启动定期健康检查
   */
  public async startHealthCheck(): Promise<void> {
    // 立即执行一次检查并等待结果
    console.log("🔍 开始初始数据库健康检查...");
    await this.checkDatabaseConnection();

    // 设置定时检查
    this.checkInterval = setInterval(async () => {
      await this.checkDatabaseConnection();
    }, this.healthCheckInterval);

    console.log(
      `🔍 数据库健康检查已启动，当前状态: ${
        this.isHealthy ? "健康" : "不健康"
      }，检查间隔: ${this.healthCheckInterval / 1000}秒`
    );
  }

  /**
   * 检查健康检查是否已启动
   */
  public isHealthCheckRunning(): boolean {
    return this.checkInterval !== null;
  }

  /**
   * 停止健康检查
   */
  public stopHealthCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("🛑 数据库健康检查已停止");
    }
  }

  /**
   * 检查并处理待处理的缓存（用于定期检查）
   */
  private async checkAndProcessPendingCache(): Promise<void> {
    try {
      const cacheInfo = await this.logCache.getCacheInfo();

      if (cacheInfo.count === 0) {
        // 没有缓存，无需处理
        return;
      }

      console.log(`🔄 发现 ${cacheInfo.count} 条待处理缓存日志，开始处理...`);

      // 备份缓存文件
      await this.logCache.backupCache();

      // 处理缓存的日志
      const result = await this.logCache.processCachedLogs(async (logData) => {
        const { insertLog } = await import("../config/database");
        await insertLog(logData);
      });

      console.log(
        `✅ 待处理缓存日志处理完成: 成功 ${result.processed} 条, 失败 ${result.failed} 条`
      );

      if (result.failed > 0) {
        console.error("❌ 部分缓存日志处理失败:", result.errors);
      }
    } catch (error) {
      console.error("❌ 检查和处理缓存日志时发生错误:", error);
    }
  }

  /**
   * 数据库重连后处理缓存的日志
   */
  private async processCachedLogsOnReconnect(): Promise<void> {
    try {
      const cacheInfo = await this.logCache.getCacheInfo();

      if (cacheInfo.count === 0) {
        console.log("📭 没有缓存的日志需要处理");
        return;
      }

      console.log(
        `🔄 数据库重连成功，开始处理 ${cacheInfo.count} 条缓存日志...`
      );

      // 备份缓存文件
      await this.logCache.backupCache();

      // 处理缓存的日志
      const result = await this.logCache.processCachedLogs(async (logData) => {
        const { insertLog } = await import("../config/database");
        await insertLog(logData);
      });

      console.log(
        `✅ 缓存日志处理完成: 成功 ${result.processed} 条, 失败 ${result.failed} 条`
      );

      if (result.failed > 0) {
        console.error("❌ 部分缓存日志处理失败:", result.errors);
      }
    } catch (error) {
      console.error("❌ 处理缓存日志时发生错误:", error);
    }
  }

  /**
   * 手动触发缓存处理
   */
  public async triggerCacheProcessing(): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    errors: string[];
    message: string;
  }> {
    try {
      if (!this.isHealthy) {
        return {
          success: false,
          processed: 0,
          failed: 0,
          errors: ["数据库连接不健康，无法处理缓存"],
          message: "数据库连接不可用",
        };
      }

      const result = await this.logCache.processCachedLogs(async (logData) => {
        const { insertLog } = await import("../config/database");
        await insertLog(logData);
      });

      return {
        success: true,
        processed: result.processed,
        failed: result.failed,
        errors: result.errors,
        message: `处理完成: 成功 ${result.processed} 条, 失败 ${result.failed} 条`,
      };
    } catch (error) {
      return {
        success: false,
        processed: 0,
        failed: 0,
        errors: [`处理错误: ${error}`],
        message: "缓存处理失败",
      };
    }
  }

  /**
   * 设置健康检查间隔
   */
  public setHealthCheckInterval(intervalMs: number): void {
    if (intervalMs < 5000) {
      throw new Error("健康检查间隔不能少于5秒");
    }

    this.healthCheckInterval = intervalMs;

    // 重启健康检查
    this.stopHealthCheck();
    this.startHealthCheck();

    console.log(`⚙️ 健康检查间隔已更新为: ${intervalMs / 1000}秒`);
  }

  /**
   * 设置最大重试次数
   */
  public setMaxRetries(maxRetries: number): void {
    if (maxRetries < 1) {
      throw new Error("最大重试次数不能少于1");
    }

    this.maxRetries = maxRetries;
    console.log(`⚙️ 最大重试次数已更新为: ${maxRetries}`);
  }

  /**
   * 重置重试计数器
   */
  public resetRetryCount(): void {
    this.retryCount = 0;
    console.log("🔄 重试计数器已重置");
  }

  /**
   * 获取详细的健康状态报告
   */
  public async getDetailedHealthReport(): Promise<{
    database: {
      isHealthy: boolean;
      lastCheckTime: string;
      retryCount: number;
      maxRetries: number;
    };
    cache: {
      count: number;
      oldestCacheTime?: string;
      newestCacheTime?: string;
      fileSizeBytes: number;
      fileSizeMB: string;
    };
    system: {
      uptime: number;
      memory: NodeJS.MemoryUsage;
      timestamp: string;
    };
  }> {
    const cacheInfo = await this.logCache.getCacheInfo();

    return {
      database: this.getHealthStatus(),
      cache: cacheInfo,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: DateTime.now(),
      },
    };
  }
}
