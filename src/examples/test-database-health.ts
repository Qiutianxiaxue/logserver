import "dotenv/config";
import { initClickHouse } from "../config/database";
import { DatabaseHealth } from "../utils/databaseHealth";

/**
 * 数据库健康检查测试脚本
 * 用于验证健康检查逻辑是否正常工作
 */
async function testDatabaseHealth() {
  console.log("🧪 开始数据库健康检查测试...\n");

  try {
    // 1. 初始化数据库
    console.log("📊 正在初始化ClickHouse...");
    const client = await initClickHouse();

    if (!client) {
      console.error("❌ ClickHouse初始化失败");
      return;
    }

    console.log("✅ ClickHouse初始化成功\n");

    // 2. 获取DatabaseHealth实例
    const dbHealth = DatabaseHealth.getInstance();

    // 3. 检查初始状态（应该是不健康的，因为还没启动健康检查）
    console.log("🔍 检查初始健康状态...");
    let healthStatus = dbHealth.getHealthStatus();
    console.log(`初始状态: ${healthStatus.isHealthy ? "健康✅" : "不健康❌"}`);
    console.log(`最后检查时间: ${healthStatus.lastCheckTime}`);
    console.log(
      `重试次数: ${healthStatus.retryCount}/${healthStatus.maxRetries}\n`
    );

    // 4. 手动执行一次健康检查
    console.log("🔍 手动执行健康检查...");
    const checkResult = await dbHealth.checkDatabaseConnection();
    console.log(`手动检查结果: ${checkResult ? "成功✅" : "失败❌"}\n`);

    // 5. 检查更新后的状态
    console.log("🔍 检查更新后的健康状态...");
    healthStatus = dbHealth.getHealthStatus();
    console.log(
      `更新后状态: ${healthStatus.isHealthy ? "健康✅" : "不健康❌"}`
    );
    console.log(`最后检查时间: ${healthStatus.lastCheckTime}`);
    console.log(
      `重试次数: ${healthStatus.retryCount}/${healthStatus.maxRetries}\n`
    );

    // 6. 启动定期健康检查
    console.log("🔄 启动定期健康检查...");
    if (!dbHealth.isHealthCheckRunning()) {
      await dbHealth.startHealthCheck();
      console.log("✅ 定期健康检查已启动\n");
    } else {
      console.log("⚠️ 健康检查已经在运行\n");
    }

    // 7. 等待几秒，观察健康状态
    console.log("⏳ 等待5秒观察健康状态变化...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 8. 检查最终状态
    console.log("🔍 检查最终健康状态...");
    healthStatus = dbHealth.getHealthStatus();
    console.log(`最终状态: ${healthStatus.isHealthy ? "健康✅" : "不健康❌"}`);
    console.log(`最后检查时间: ${healthStatus.lastCheckTime}`);
    console.log(
      `重试次数: ${healthStatus.retryCount}/${healthStatus.maxRetries}\n`
    );

    // 9. 获取详细健康报告
    console.log("📋 获取详细健康报告...");
    const detailedReport = await dbHealth.getDetailedHealthReport();
    console.log("详细报告:");
    console.log(
      `  数据库状态: ${
        detailedReport.database.isHealthy ? "健康✅" : "不健康❌"
      }`
    );
    console.log(`  缓存数量: ${detailedReport.cache.count} 条`);
    console.log(`  缓存大小: ${detailedReport.cache.fileSizeMB}`);
    console.log(
      `  系统内存: ${Math.round(
        detailedReport.system.memory.rss / 1024 / 1024
      )}MB\n`
    );

    // 10. 停止健康检查
    console.log("🛑 停止健康检查...");
    dbHealth.stopHealthCheck();
    console.log("✅ 健康检查已停止");

    console.log("\n🎉 数据库健康检查测试完成！");
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
  } finally {
    // 确保进程退出
    setTimeout(() => {
      console.log("👋 进程结束");
      process.exit(0);
    }, 1000);
  }
}

// 运行测试
testDatabaseHealth().catch(console.error);
