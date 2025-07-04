// 加载环境变量配置
import "dotenv/config";

import express, { Request, Response, NextFunction, Application } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { initClickHouse } from "./config/database";
import { initMySQL, closeMySQL } from "./config/mysql";
import { ApiResponse, HttpError } from "./types";
import routes from "./routes";
import { startSimpleLogService } from "./services/simpleLogService";
import { statisticsScheduler } from "./utils/scheduler";
import { DatabaseHealth } from "./utils/databaseHealth";

const app: Application = express();

// 环境变量配置
const PORT: number = parseInt(process.env.PORT || "13000");
const LOG_LEVEL: string = process.env.LOG_LEVEL || "combined";
const LOG_WEBSOCKET_URL: string =
  process.env.LOG_WEBSOCKET_URL || "ws://localhost:13001";

// 中间件配置
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // 允许内联脚本（Swagger UI需要）
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // 允许内联样式（Swagger UI需要）
        ],
        imgSrc: ["'self'", "data:", "http:"], // 允许图片资源
        fontSrc: ["'self'", "http:", "data:"], // 允许字体资源
        connectSrc: ["'self'"], // API连接
        objectSrc: ["'none'"], // 禁用object元素
        mediaSrc: ["'self'"], // 媒体资源
        frameSrc: ["'none'"], // 禁用frame
      },
    },
    crossOriginOpenerPolicy: false, // 禁用COOP策略避免协议问题
    crossOriginResourcePolicy: false, // 禁用CORP策略
    hsts: false, // 禁用HSTS避免强制HTTPS重定向
  })
); // 安全头部（为Swagger UI配置CSP）
app.use(cors()); // 跨域支持
app.use(morgan(LOG_LEVEL)); // 日志记录，使用环境变量配置
app.use(express.json({ limit: process.env.JSON_LIMIT || "10mb" })); // JSON解析
app.use(
  express.urlencoded({ extended: true, limit: process.env.URL_LIMIT || "10mb" })
); // URL编码解析

// 静态文件服务配置
app.use("/docs", express.static("docs")); // 为docs文件夹提供静态文件服务

// 挂载路由
app.use("/", routes);

// 404处理
app.use("*", (req: Request, res: Response) => {
  const response: ApiResponse = {
    code: 0,
    message: "接口不存在",
    data: {
      path: req.originalUrl,
    },
  };
  res.status(404).json(response);
});

// 错误处理中间件
app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
  console.error("服务器错误:", err);
  const response: ApiResponse = {
    code: 0,
    message: `服务器内部错误: ${err.message}`,
  };
  res.status(err.status || err.statusCode || 500).json(response);
});

// 启动服务器
(async () => {
  try {
    console.log("\n🚀 正在启动日志服务器...");

    // 1. 初始化数据库连接
    console.log("📊 正在初始化数据库连接...");
    const dbClient = await initClickHouse();

    if (dbClient) {
      console.log("✅ ClickHouse数据库初始化成功");

      // 启动数据库健康检查
      console.log("🔍 正在启动数据库健康检查...");
      const dbHealth = DatabaseHealth.getInstance();
      await dbHealth.startHealthCheck();

      const healthStatus = dbHealth.getHealthStatus();
      console.log(
        `📊 数据库健康状态: ${healthStatus.isHealthy ? "健康" : "不健康"}`
      );
    } else {
      console.warn("⚠️ ClickHouse数据库初始化失败，服务将在离线模式下运行");
    }

    // 2. 初始化MySQL连接（用于统计数据）
    console.log("📊 正在初始化MySQL连接...");
    const mysqlClient = await initMySQL();

    if (mysqlClient) {
      console.log("✅ MySQL数据库初始化成功");
    } else {
      console.warn("⚠️ MySQL数据库初始化失败，统计功能将不可用");
    }

    // 3. 启动HTTP服务器
    const server = app.listen(PORT, () => {
      console.log(`🌐 HTTP服务器已启动，端口: ${PORT}`);
    });

    // 4. 启动简化日志服务（WebSocket接收器 + 数据库存储）
    console.log("📡 正在启动简化日志服务...");
    const logService = await startSimpleLogService({
      wsUrl: LOG_WEBSOCKET_URL,
      serviceId: process.env.SERVICE_ID || "log-service-001",
      serviceName: process.env.SERVICE_NAME || "ClickHouse日志服务",
      autoInitDatabase: false, // 已经在上面初始化过了
    });

    // 5. 启动统计数据更新调度器
    if (mysqlClient) {
      console.log("📊 正在启动统计数据更新调度器...");
      statisticsScheduler.start();
    }

    // 6. 打印启动信息
    console.log("\n" + "=".repeat(60));
    console.log("🎉 日志服务器启动成功！");
    console.log("=".repeat(60));
    console.log(
      `🔄 运行模式: ${dbClient ? "在线模式" : "离线模式（缓存模式）"}`
    );
    console.log(`📊 统计功能: ${mysqlClient ? "已启用" : "已禁用"}`);
    console.log("=".repeat(60));

    // 5. 优雅退出处理
    const gracefulShutdown = (signal: string) => {
      console.log(`\n📡 收到 ${signal} 信号，正在优雅关闭服务器...`);

      server.close(async () => {
        console.log("✅ HTTP服务器已关闭");

        try {
          await logService.shutdown();
          statisticsScheduler.stop();

          // 停止数据库健康检查
          const dbHealth = DatabaseHealth.getInstance();
          dbHealth.stopHealthCheck();

          await closeMySQL();
          console.log("✅ 所有服务已安全关闭");
          process.exit(0);
        } catch (error) {
          console.error("❌ 关闭服务时发生错误:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("❌ 服务器启动失败:", (error as Error).message);
    process.exit(1);
  }
})();

export default app;
