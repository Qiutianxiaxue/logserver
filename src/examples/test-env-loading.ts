import "dotenv/config";

/**
 * 环境变量加载测试脚本
 * 验证.env文件中的配置是否被正确读取
 */
function testEnvLoading() {
  console.log("🧪 测试环境变量加载情况...\n");

  // 基本服务器配置
  console.log("=== 服务器基本配置 ===");
  console.log(`PORT: ${process.env.PORT || "(未设置)"}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "(未设置)"}`);
  console.log(`API_PREFIX: ${process.env.API_PREFIX || "(未设置)"}`);
  console.log(`LOG_LEVEL: ${process.env.LOG_LEVEL || "(未设置)"}\n`);

  // ClickHouse配置
  console.log("=== ClickHouse数据库配置 ===");
  console.log(`CLICKHOUSE_HOST: ${process.env.CLICKHOUSE_HOST || "(未设置)"}`);
  console.log(`CLICKHOUSE_PORT: ${process.env.CLICKHOUSE_PORT || "(未设置)"}`);
  console.log(
    `CLICKHOUSE_USERNAME: ${process.env.CLICKHOUSE_USERNAME || "(未设置)"}`
  );
  console.log(
    `CLICKHOUSE_PASSWORD: ${
      process.env.CLICKHOUSE_PASSWORD ? "(已设置)" : "(未设置)"
    }`
  );
  console.log(
    `CLICKHOUSE_DATABASE: ${process.env.CLICKHOUSE_DATABASE || "(未设置)"}\n`
  );

  // MySQL配置
  console.log("=== MySQL数据库配置 ===");
  console.log(`MYSQL_HOST: ${process.env.MYSQL_HOST || "(未设置)"}`);
  console.log(`MYSQL_PORT: ${process.env.MYSQL_PORT || "(未设置)"}`);
  console.log(`MYSQL_USERNAME: ${process.env.MYSQL_USERNAME || "(未设置)"}`);
  console.log(
    `MYSQL_PASSWORD: ${process.env.MYSQL_PASSWORD ? "(已设置)" : "(未设置)"}`
  );
  console.log(`MYSQL_DATABASE: ${process.env.MYSQL_DATABASE || "(未设置)"}\n`);

  // WebSocket配置
  console.log("=== WebSocket配置 ===");
  console.log(
    `LOG_WEBSOCKET_URL: ${process.env.LOG_WEBSOCKET_URL || "(未设置)"}`
  );
  console.log(`WS_URL: ${process.env.WS_URL || "(未设置)"}\n`);

  // 服务标识
  console.log("=== 服务标识配置 ===");
  console.log(`SERVICE_ID: ${process.env.SERVICE_ID || "(未设置)"}`);
  console.log(`SERVICE_NAME: ${process.env.SERVICE_NAME || "(未设置)"}`);
  console.log(`SERVICE_IP: ${process.env.SERVICE_IP || "(未设置)"}`);
  console.log(`APPID: ${process.env.APPID || "(未设置)"}`);
  console.log(`ENTERPRISE_ID: ${process.env.ENTERPRISE_ID || "(未设置)"}\n`);

  // 检查配置问题
  console.log("=== 配置问题检查 ===");
  const issues = [];

  if (
    !process.env.NODE_ENV ||
    !["development", "production", "test"].includes(process.env.NODE_ENV)
  ) {
    issues.push(
      `❌ NODE_ENV值异常: "${process.env.NODE_ENV}" (应该是: development/production/test)`
    );
  }

  if (!process.env.CLICKHOUSE_PASSWORD) {
    issues.push("⚠️ CLICKHOUSE_PASSWORD未设置，将使用空密码");
  }

  if (!process.env.MYSQL_PASSWORD) {
    issues.push("⚠️ MYSQL_PASSWORD未设置，可能导致MySQL连接失败");
  }

  if (issues.length === 0) {
    console.log("✅ 未发现配置问题");
  } else {
    issues.forEach((issue) => console.log(issue));
  }

  console.log("\n🎉 环境变量测试完成！");
}

// 运行测试
testEnvLoading();
