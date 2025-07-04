import "dotenv/config";
import { initMySQL } from "../config/mysql";
import { initClickHouse } from "../config/database";
import { logStatisticsService } from "../services/logStatisticsService";
import { LogStatistics, StatType } from "../models/LogStatistics";

/**
 * 测试修复后的统计功能
 * 验证conflictFields配置是否解决了统计问题
 */
async function testFixedStatistics() {
  console.log("🔄 开始测试修复后的统计功能...\n");

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

    // 2. 清空旧的统计数据（重新开始）
    console.log("=== 清空旧统计数据 ===");
    try {
      const deletedCount = await LogStatistics.destroy({
        where: {},
        truncate: true,
      });
      console.log(`✅ 清空了旧的统计数据: ${deletedCount} 条\n`);
    } catch (error) {
      console.error("❌ 清空统计数据失败:", error);
    }

    // 3. 重新生成当前小时的统计数据
    console.log("=== 重新生成当前小时统计 ===");
    try {
      await logStatisticsService.updateStatistics(StatType.HOUR);
      console.log("✅ 当前小时统计生成完成");
    } catch (error) {
      console.error("❌ 当前小时统计生成失败:", error);
    }

    // 4. 重新生成今日统计数据
    console.log("\n=== 重新生成今日统计 ===");
    try {
      await logStatisticsService.updateStatistics(StatType.DAY);
      console.log("✅ 今日统计生成完成");
    } catch (error) {
      console.error("❌ 今日统计生成失败:", error);
    }

    // 5. 查看生成后的统计数据
    console.log("\n=== 查看生成后的统计数据 ===");

    try {
      const result = await logStatisticsService.getStatistics({
        limit: 20,
      });

      console.log(`\n查询结果: 总共 ${result.total} 条记录`);
      console.log("\n所有统计数据:");
      result.data.forEach((stat, index) => {
        console.log(
          `  ${index + 1}. 时间: ${stat.stat_time.substring(0, 19)}, 类型: ${
            stat.stat_type
          }`
        );
        console.log(
          `     级别: ${stat.level}, 服务: ${stat.service}, 日志类型: ${stat.log_type}`
        );
        console.log(
          `     应用: ${stat.appid}, 企业: ${stat.enterprise_id}, 数量: ${stat.count}`
        );
        console.log();
      });

      // 6. 按级别聚合统计（关键测试）
      console.log("=== 按级别聚合统计（修复后） ===");
      const levelStats = await logStatisticsService.getAggregatedStatistics({
        groupBy: "level",
        limit: 10,
      });

      console.log(`总统计量: ${levelStats.total}`);
      console.log("各级别统计:");
      levelStats.data.forEach((stat) => {
        console.log(`  ${stat.value}: ${stat.count} 条`);
      });

      // 7. 验证是否包含了所有级别
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
      }
    } catch (error) {
      console.error("❌ 查询统计数据失败:", error);
    }

    console.log("\n🎉 统计功能测试完成！");
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
testFixedStatistics().catch(console.error);
