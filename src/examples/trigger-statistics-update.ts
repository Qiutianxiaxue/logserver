import "dotenv/config";
import { initMySQL } from "../config/mysql";
import { initClickHouse } from "../config/database";
import { logStatisticsService } from "../services/logStatisticsService";
import { StatType } from "../models/LogStatistics";

/**
 * 手动触发统计更新脚本
 * 从ClickHouse获取最新数据并更新到MySQL统计表
 */
async function triggerStatisticsUpdate() {
  console.log("🔄 开始手动触发统计更新...\n");

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

    // 2. 更新当前小时的统计数据
    console.log("=== 更新当前小时统计 ===");
    console.log("🔄 正在更新当前小时统计数据...");
    
    try {
      await logStatisticsService.updateStatistics(StatType.HOUR);
      console.log("✅ 当前小时统计更新完成");
    } catch (error) {
      console.error("❌ 当前小时统计更新失败:", error);
    }

    // 3. 更新今日统计数据
    console.log("\n=== 更新今日统计 ===");
    console.log("🔄 正在更新今日统计数据...");
    
    try {
      await logStatisticsService.updateStatistics(StatType.DAY);
      console.log("✅ 今日统计更新完成");
    } catch (error) {
      console.error("❌ 今日统计更新失败:", error);
    }

    // 4. 查看更新后的统计数据
    console.log("\n=== 查看更新后的统计数据 ===");
    
    try {
      const result = await logStatisticsService.getStatistics({
        limit: 10,
      });
      
      console.log(`\n查询结果: 总共 ${result.total} 条记录`);
      console.log("\n最新的统计数据:");
      result.data.forEach((stat, index) => {
        console.log(`  ${index + 1}. 时间: ${stat.stat_time.substring(0, 19)}, 类型: ${stat.stat_type}`);
        console.log(`     级别: ${stat.level}, 服务: ${stat.service}, 日志类型: ${stat.log_type}`);
        console.log(`     应用: ${stat.appid}, 企业: ${stat.enterprise_id}, 数量: ${stat.count}`);
        console.log();
      });

      // 5. 按级别聚合统计
      console.log("=== 按级别聚合统计（更新后） ===");
      const levelStats = await logStatisticsService.getAggregatedStatistics({
        groupBy: "level",
        limit: 10,
      });
      
      console.log(`总统计量: ${levelStats.total}`);
      console.log("各级别统计:");
      levelStats.data.forEach(stat => {
        console.log(`  ${stat.value}: ${stat.count} 条`);
      });

    } catch (error) {
      console.error("❌ 查询更新后数据失败:", error);
    }

    console.log("\n🎉 统计更新完成！");

  } catch (error) {
    console.error("❌ 统计更新过程中发生错误:", error);
  } finally {
    // 确保进程退出
    setTimeout(() => {
      console.log("👋 进程结束");
      process.exit(0);
    }, 1000);
  }
}

// 运行统计更新
triggerStatisticsUpdate().catch(console.error); 