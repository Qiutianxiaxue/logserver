import fs from "fs/promises";
import path from "path";
import DateTime from "./datetime";
import { LogData } from "../types";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableDatabase: boolean;
  logDir: string;
  maxFileSize: number; // 字节
  maxFiles: number;
  service: string;
  serviceName: string;
  serviceIp: string;
  appid: string;
  enterpriseId: string;
}

export class Logger {
  private static instances: Map<string, Logger> = new Map();
  private config: LoggerConfig;
  private logFilePath: string;

  private constructor(name: string, config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: process.env.NODE_ENV === "development",
      enableFile: true,
      enableDatabase: true,
      logDir: path.join(process.cwd(), "logs"),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      service: process.env.SERVICE_NAME || "logserver",
      serviceName: name,
      serviceIp: process.env.SERVICE_IP || "localhost",
      appid: process.env.APPID || "logserver",
      enterpriseId: process.env.ENTERPRISE_ID || "system",
      ...config,
    };

    this.logFilePath = path.join(this.config.logDir, `${name}.log`);
    this.initLogDir();
  }

  public static getInstance(
    name: string = "default",
    config?: Partial<LoggerConfig>
  ): Logger {
    if (!Logger.instances.has(name)) {
      Logger.instances.set(name, new Logger(name, config));
    }
    return Logger.instances.get(name)!;
  }

  private async initLogDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDir, { recursive: true });
    } catch {
      // 忽略目录已存在的错误
    }
  }

  private async rotateLogFile(): Promise<void> {
    try {
      const stats = await fs.stat(this.logFilePath);
      if (stats.size > this.config.maxFileSize) {
        // 轮转日志文件
        for (let i = this.config.maxFiles - 1; i > 0; i--) {
          const oldFile = `${this.logFilePath}.${i}`;
          const newFile = `${this.logFilePath}.${i + 1}`;
          try {
            await fs.rename(oldFile, newFile);
          } catch {
            // 忽略文件不存在的错误
          }
        }
        await fs.rename(this.logFilePath, `${this.logFilePath}.1`);
      }
    } catch {
      // 文件不存在，无需轮转
    }
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = DateTime.toClickHouseFormat();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level}] [${this.config.serviceName}] ${message}${metaStr}`;
  }

  private async writeToFile(formattedMessage: string): Promise<void> {
    if (!this.config.enableFile) return;

    try {
      await this.rotateLogFile();
      await fs.appendFile(this.logFilePath, formattedMessage + "\n");
    } catch (error) {
      // 如果文件写入失败，至少输出到控制台
      console.error("Failed to write to log file:", error);
    }
  }

  private writeToConsole(level: string, message: string, meta?: any): void {
    if (!this.config.enableConsole) return;

    const formattedMessage = this.formatMessage(level, message, meta);

    switch (level) {
      case "ERROR":
        console.error(formattedMessage);
        break;
      case "WARN":
        console.warn(formattedMessage);
        break;
      case "INFO":
        console.info(formattedMessage);
        break;
      case "DEBUG":
        console.log(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  private async writeToDatabase(
    level: string,
    message: string,
    meta?: any
  ): Promise<void> {
    if (!this.config.enableDatabase) return;

    try {
      // 动态导入以避免循环依赖
      const { insertLog } = await import("../config/database");
      const { LogCache } = await import("./logCache");
      const { DatabaseHealth } = await import("./databaseHealth");

      const logData: LogData = {
        level: level.toLowerCase() as "debug" | "info" | "warn" | "error",
        log_type: "system",
        message: message,
        service: this.config.service,
        service_name: this.config.serviceName,
        service_ip: this.config.serviceIp,
        appid: this.config.appid,
        enterprise_id: this.config.enterpriseId,
        user_id: "",
        extra_data: meta || {},
        timestamp: DateTime.toClickHouseFormat(),
      };

      // 检查数据库健康状态
      const databaseHealth = DatabaseHealth.getInstance();
      const healthStatus = databaseHealth.getHealthStatus();

      if (healthStatus.isHealthy) {
        // 数据库健康，直接写入
        await insertLog(logData);
      } else {
        // 数据库不健康，缓存日志
        const logCache = LogCache.getInstance();
        await logCache.addToCache(logData);
      }
    } catch (error) {
      // 数据库写入失败，只记录到文件，避免循环调用
      const errorMessage = `Database log failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      await this.writeToFile(this.formatMessage("ERROR", errorMessage));
    }
  }

  private async log(
    level: LogLevel,
    levelName: string,
    message: string,
    meta?: any
  ): Promise<void> {
    if (level < this.config.level) return;

    const formattedMessage = this.formatMessage(levelName, message, meta);

    // 输出到控制台
    this.writeToConsole(levelName, message, meta);

    // 写入文件
    await this.writeToFile(formattedMessage);

    // 写入数据库
    await this.writeToDatabase(levelName, message, meta);
  }

  public async debug(message: string, meta?: any): Promise<void> {
    await this.log(LogLevel.DEBUG, "DEBUG", message, meta);
  }

  public async info(message: string, meta?: any): Promise<void> {
    await this.log(LogLevel.INFO, "INFO", message, meta);
  }

  public async warn(message: string, meta?: any): Promise<void> {
    await this.log(LogLevel.WARN, "WARN", message, meta);
  }

  public async error(message: string, meta?: any): Promise<void> {
    await this.log(LogLevel.ERROR, "ERROR", message, meta);
  }

  // 同步版本，用于不需要等待数据库写入的场景
  public debugSync(message: string, meta?: any): void {
    if (LogLevel.DEBUG < this.config.level) return;
    this.writeToConsole("DEBUG", message, meta);
    this.writeToFile(this.formatMessage("DEBUG", message, meta)).catch(
      () => {}
    );
    this.writeToDatabase("DEBUG", message, meta).catch(() => {});
  }

  public infoSync(message: string, meta?: any): void {
    if (LogLevel.INFO < this.config.level) return;
    this.writeToConsole("INFO", message, meta);
    this.writeToFile(this.formatMessage("INFO", message, meta)).catch(() => {});
    this.writeToDatabase("INFO", message, meta).catch(() => {});
  }

  public warnSync(message: string, meta?: any): void {
    if (LogLevel.WARN < this.config.level) return;
    this.writeToConsole("WARN", message, meta);
    this.writeToFile(this.formatMessage("WARN", message, meta)).catch(() => {});
    this.writeToDatabase("WARN", message, meta).catch(() => {});
  }

  public errorSync(message: string, meta?: any): void {
    if (LogLevel.ERROR < this.config.level) return;
    this.writeToConsole("ERROR", message, meta);
    this.writeToFile(this.formatMessage("ERROR", message, meta)).catch(
      () => {}
    );
    this.writeToDatabase("ERROR", message, meta).catch(() => {});
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// 导出默认实例
export const logger = Logger.getInstance("app", {
  serviceName: "application",
});

export const wsLogger = Logger.getInstance("websocket", {
  serviceName: "websocket",
});

export const dbLogger = Logger.getInstance("database", {
  serviceName: "database",
});

export const systemLogger = Logger.getInstance("system", {
  serviceName: "system",
});

export default logger;
