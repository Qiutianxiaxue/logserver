import "dotenv/config";
import { initMySQL } from "../config/mysql";
import { initClickHouse } from "../config/database";
import { logStatisticsService } from "../services/logStatisticsService";
import { LogStatistics, StatType } from "../models/LogStatistics";

/**
 * 测试查询-更新逻辑
 * 验证新的先查询再决定更新或插入的逻辑是否正确
 */
async function testQueryUpdateLogic() {
  console.log("🔄 开始测试查询-更新逻辑...\n");

  try {
    // 1. 初始化数据库连接
    console.log("📊 正在初始化数据库连接...");

    const clickhouse = await initClickHouse();
    if (!clickhouse) {
      console.error("❌ ClickHouse初始化失败");
      return;
    }
    console.log("✅ ClickHouse初始化成功");

    const mysql = await initMySQL();
    if (!mysql) {
      console.error("❌ MySQL初始化失败");
      return;
    }
    console.log("✅ MySQL初始化成功\n");

    // 2. 清空旧的统计数据
    console.log("=== 清空旧统计数据 ===");
    try {
      await LogStatistics.destroy({
        where: {},
        truncate: true,
      });
      console.log("✅ 清空了旧的统计数据\n");
    } catch (error) {
      console.error("❌ 清空统计数据失败:", error);
    }

    // 3. 第一次运行统计更新（应该全部创建新记录）
    console.log("=== 第一次统计更新（全部创建） ===");
    try {
      await logStatisticsService.updateStatistics(StatType.HOUR);
      console.log("✅ 第一次统计更新完成");
    } catch (error) {
      console.error("❌ 第一次统计更新失败:", error);
    }

    // 4. 查看第一次更新后的结果
    console.log("\n=== 第一次更新后的结果 ===");
    let result = await logStatisticsService.getStatistics({ limit: 10 });
    console.log(`总记录数: ${result.total}`);
    result.data.forEach((stat, index) => {
      console.log(
        `  ${index + 1}. 级别: ${stat.level}, 数量: ${
          stat.count
        }, 时间: ${stat.stat_time.substring(0, 19)}`
      );
    });

    // 5. 第二次运行统计更新（应该更新现有记录）
    console.log("\n=== 第二次统计更新（应该更新） ===");
    // 等待1秒，让日志数量可能有变化
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      await logStatisticsService.updateStatistics(StatType.HOUR);
      console.log("✅ 第二次统计更新完成");
    } catch (error) {
      console.error("❌ 第二次统计更新失败:", error);
    }

    // 6. 查看第二次更新后的结果
    console.log("\n=== 第二次更新后的结果 ===");
    result = await logStatisticsService.getStatistics({ limit: 10 });
    console.log(`总记录数: ${result.total}`);
    result.data.forEach((stat, index) => {
      console.log(
        `  ${index + 1}. 级别: ${stat.level}, 数量: ${
          stat.count
        }, 时间: ${stat.stat_time.substring(0, 19)}`
      );
    });

    // 7. 按级别聚合统计验证
    console.log("\n=== 按级别聚合统计验证 ===");
    const levelStats = await logStatisticsService.getAggregatedStatistics({
      groupBy: "level",
      limit: 10,
    });

    console.log(`总统计量: ${levelStats.total}`);
    console.log("各级别统计:");
    levelStats.data.forEach((stat) => {
      console.log(`  ${stat.value}: ${stat.count} 条`);
    });

    // 8. 验证是否包含了所有级别
    const levels = levelStats.data.map((stat) => stat.value);
    console.log(`\n发现的日志级别: ${levels.join(", ")}`);

    if (
      levels.includes("info") &&
      levels.includes("error") &&
      levels.includes("warn")
    ) {
      console.log("✅ 修复成功！现在统计包含了所有日志级别");
    } else {
      console.log("❌ 修复可能不完整，仍然缺少某些日志级别");
      console.log("需要的级别: info, error, warn");
      console.log("实际的级别:", levels);
    }

    console.log("\n🎉 查询-更新逻辑测试完成！");
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
testQueryUpdateLogic().catch(console.error);
