// 加载环境变量配置
import "dotenv/config";

import express, { Request, Response, NextFunction, Application } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { initClickHouse } from "./config/database";
import { ApiResponse, HttpError } from "./types";
import routes from "./routes";
import { startSimpleLogService } from "./services/simpleLogService";

const app: Application = express();

// 环境变量配置
const PORT: number = parseInt(process.env.PORT || "3000");
const NODE_ENV: string = process.env.NODE_ENV || "development";
const API_PREFIX: string = process.env.API_PREFIX || "/api";
const LOG_LEVEL: string = process.env.LOG_LEVEL || "combined";

// 中间件配置
app.use(helmet()); // 安全头部
app.use(cors()); // 跨域支持
app.use(morgan(LOG_LEVEL)); // 日志记录，使用环境变量配置
app.use(express.json({ limit: process.env.JSON_LIMIT || "10mb" })); // JSON解析
app.use(
  express.urlencoded({ extended: true, limit: process.env.URL_LIMIT || "10mb" })
); // URL编码解析

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
      console.log("✅ 数据库初始化成功，服务将在在线模式下运行");
    } else {
      console.warn("⚠️ 数据库初始化失败，服务将在离线模式下运行");
      console.warn("📦 日志将被缓存到本地，等待数据库恢复后自动同步");
    }

    // 2. 启动HTTP服务器
    const server = app.listen(PORT, () => {
      console.log(`🌐 HTTP服务器已启动，端口: ${PORT}`);
    });

    // 3. 启动简化日志服务（WebSocket接收器 + 数据库存储）
    console.log("📡 正在启动简化日志服务...");
    const logService = await startSimpleLogService({
      wsUrl:
        process.env.WS_URL ||
        process.env.LOG_WEBSOCKET_URL ||
        "ws://localhost:13001",
      serviceId: process.env.SERVICE_ID || "log-service-001",
      serviceName: process.env.SERVICE_NAME || "ClickHouse日志服务",
      autoInitDatabase: false, // 已经在上面初始化过了
    });

    // 4. 打印启动信息
    console.log("\n" + "=".repeat(60));
    console.log("🎉 日志服务器启动成功！");
    console.log("=".repeat(60));
    console.log(`📡 HTTP服务地址: http://localhost:${PORT}`);
    console.log(`📊 首页信息: POST http://localhost:${PORT}/`);
    console.log(`🔍 健康检查: POST http://localhost:${PORT}/health`);
    console.log(
      `📝 查询日志: POST http://localhost:${PORT}${API_PREFIX}/logs/query`
    );
    console.log(
      `✍️ 创建日志: POST http://localhost:${PORT}${API_PREFIX}/logs/create`
    );
    console.log(
      `📊 批量日志: POST http://localhost:${PORT}${API_PREFIX}/logs/batch`
    );
    console.log(
      `📈 日志统计: POST http://localhost:${PORT}${API_PREFIX}/logs/stats`
    );
    console.log(
      `💾 缓存状态: POST http://localhost:${PORT}${API_PREFIX}/logs/cache/status`
    );
    console.log(
      `🔧 系统报告: POST http://localhost:${PORT}${API_PREFIX}/logs/system/health`
    );
    console.log(`📡 WebSocket状态: GET http://localhost:${PORT}/ws/status`);
    console.log(`📤 发送WebSocket消息: POST http://localhost:${PORT}/ws/send`);
    console.log(`🌍 运行环境: ${NODE_ENV}`);
    console.log(
      `🔄 运行模式: ${dbClient ? "在线模式" : "离线模式（缓存模式）"}`
    );
    console.log(`📋 所有接口统一使用 POST 方法`);
    if (NODE_ENV === "development") {
      console.log(`📋 环境变量已加载: ${process.env.NODE_ENV ? "✅" : "❌"}`);
    }
    console.log("=".repeat(60));

    // 5. 优雅退出处理
    const gracefulShutdown = (signal: string) => {
      console.log(`\n📡 收到 ${signal} 信号，正在优雅关闭服务器...`);

      server.close(async () => {
        console.log("✅ HTTP服务器已关闭");

        try {
          await logService.shutdown();
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
