import {
  logger,
  wsLogger,
  dbLogger,
  systemLogger,
  LogLevel,
} from "../utils/logger";

/**
 * 日志记录器演示
 * 展示如何使用新的日志记录器，它会将日志记录到：
 * 1. 控制台（开发环境）
 * 2. 文件系统
 * 3. ClickHouse数据库
 */
async function demonstrateLogger() {
  console.log("🚀 开始演示日志记录器功能...\n");

  // 1. 基础日志记录
  console.log("=== 基础日志记录 ===");
  await logger.debug("这是一条调试信息", {
    userId: "user123",
    action: "login",
  });
  await logger.info("用户登录成功", { userId: "user123", ip: "192.168.1.100" });
  await logger.warn("密码即将过期", { userId: "user123", daysLeft: 3 });
  await logger.error("数据库连接失败", {
    error: "Connection timeout",
    retry: 3,
  });

  console.log("\n=== 不同模块的日志记录 ===");

  // 2. WebSocket模块日志
  await wsLogger.info("WebSocket连接建立", {
    clientId: "client001",
    timestamp: new Date().toISOString(),
  });
  await wsLogger.error("WebSocket连接断开", {
    clientId: "client001",
    reason: "Network error",
  });

  // 3. 数据库模块日志
  await dbLogger.info("查询执行成功", {
    query: "SELECT * FROM application_logs",
    duration: "23ms",
    rows: 150,
  });
  await dbLogger.warn("慢查询警告", {
    query: "SELECT * FROM application_logs WHERE timestamp > ?",
    duration: "2.3s",
  });

  // 4. 系统模块日志
  await systemLogger.info("系统启动完成", {
    version: "1.0.0",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });

  console.log("\n=== 同步日志记录（不等待数据库写入）===");

  // 5. 同步日志记录（适用于高频场景）
  logger.debugSync("处理HTTP请求", { path: "/api/logs", method: "POST" });
  logger.infoSync("请求处理完成", {
    path: "/api/logs",
    status: 200,
    duration: "15ms",
  });
  logger.warnSync("请求处理缓慢", { path: "/api/logs", duration: "1.2s" });
  logger.errorSync("请求处理失败", {
    path: "/api/logs",
    error: "Invalid parameters",
  });

  console.log("\n=== 配置管理 ===");

  // 6. 查看和更新配置
  const config = logger.getConfig();
  console.log("当前日志配置:", {
    level: config.level,
    enableConsole: config.enableConsole,
    enableFile: config.enableFile,
    enableDatabase: config.enableDatabase,
    service: config.service,
    serviceName: config.serviceName,
  });

  // 7. 更新日志级别
  console.log("\n更新日志级别为 WARN，DEBUG 和 INFO 将被过滤...");
  logger.updateConfig({ level: LogLevel.WARN });

  await logger.debug("这条DEBUG日志不会被记录");
  await logger.info("这条INFO日志不会被记录");
  await logger.warn("这条WARN日志会被记录");
  await logger.error("这条ERROR日志会被记录");

  // 恢复原来的日志级别
  logger.updateConfig({ level: LogLevel.INFO });

  console.log("\n=== 数据库集成演示 ===");

  // 8. 数据库相关的日志会自动存储到ClickHouse
  await logger.info("这条日志会存储到ClickHouse数据库", {
    feature: "database-integration",
    table: "application_logs",
    logType: "system",
  });

  console.log("\n✅ 日志记录器演示完成！");
  console.log("\n📋 查看效果：");
  console.log("1. 控制台输出：已在上方显示");
  console.log("2. 文件日志：查看 logs/ 目录下的日志文件");
  console.log(
    "3. 数据库日志：通过 API 查询 ClickHouse 中的 application_logs 表"
  );
  console.log('   - 日志类型为 "system"');
  console.log(
    "   - service_name 包含模块名称（app, websocket, database, system）"
  );
}

// 错误处理示例
async function demonstrateErrorHandling() {
  console.log("\n=== 错误处理演示 ===");

  try {
    // 模拟一个错误
    throw new Error("这是一个测试错误");
  } catch (error) {
    // 正确的错误日志记录方式
    await logger.error("捕获到错误", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: "error-handling-demo",
    });
  }

  // 处理异步错误
  const asyncOperation = async () => {
    throw new Error("异步操作失败");
  };

  try {
    await asyncOperation();
  } catch (error) {
    await logger.error("异步操作失败", {
      error: error instanceof Error ? error.message : String(error),
      operation: "asyncOperation",
    });
  }
}

// 主函数
async function main() {
  try {
    await demonstrateLogger();
    await demonstrateErrorHandling();
  } catch (error) {
    console.error("演示过程中发生错误:", error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🎉 演示结束");
      process.exit(0);
    })
    .catch((error) => {
      console.error("演示失败:", error);
      process.exit(1);
    });
}

export { demonstrateLogger, demonstrateErrorHandling };
