import "dotenv/config";
import { initClickHouse, getLogStats } from "../config/database";
import { logStatisticsService } from "../services/logStatisticsService";

/**
 * 日志统计调试脚本
 * 检查ClickHouse中的数据分布和统计逻辑
 */
async function debugLogStatistics() {
  console.log("🔍 开始调试日志统计数据...\n");

  try {
    // 1. 初始化数据库
    console.log("📊 正在初始化ClickHouse...");
    const client = await initClickHouse();
    
    if (!client) {
      console.error("❌ ClickHouse初始化失败");
      return;
    }
    
    console.log("✅ ClickHouse初始化成功\n");

    // 2. 检查原始日志数据的级别分布
    console.log("=== 原始日志数据检查 ===");
    
    const levelDistributionQuery = `
      SELECT 
        level,
        COUNT(*) as count,
        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM logs.application_logs) as percentage
      FROM logs.application_logs 
      GROUP BY level 
      ORDER BY count DESC
    `;

    console.log("📊 查询日志级别分布...");
    const levelResult = await client.query({
      query: levelDistributionQuery,
      format: "JSONEachRow",
    });

    const levelData = await levelResult.json() as Array<{
      level: string;
      count: number;
      percentage: number;
    }>;

    console.log("日志级别分布:");
    levelData.forEach(item => {
      console.log(`  ${item.level}: ${item.count} 条 (${item.percentage.toFixed(2)}%)`);
    });
    console.log();

    // 3. 检查最近的日志数据
    console.log("=== 最近日志数据检查 ===");
    const recentLogsQuery = `
      SELECT 
        level, 
        log_type, 
        service, 
        message,
        timestamp
      FROM logs.application_logs 
      ORDER BY timestamp DESC 
      LIMIT 10
    `;

    console.log("📊 查询最近10条日志...");
    const recentResult = await client.query({
      query: recentLogsQuery,
      format: "JSONEachRow",
    });

    const recentData = await recentResult.json() as Array<{
      level: string;
      log_type: string;
      service: string;
      message: string;
      timestamp: string;
    }>;

    console.log("最近的日志:");
    recentData.forEach((item, index) => {
      console.log(`  ${index + 1}. [${item.level}] ${item.service} - ${item.message.substring(0, 50)}...`);
      console.log(`      时间: ${item.timestamp}`);
    });
    console.log();

    // 4. 测试ClickHouse直接统计
    console.log("=== ClickHouse直接统计测试 ===");
    console.log("📊 调用getLogStats(24h)...");
    const clickhouseStats = await getLogStats("24h");
    
    console.log("ClickHouse直接统计结果:");
    clickhouseStats.forEach(stat => {
      console.log(`  级别: ${stat.level}, 服务: ${stat.service}, 数量: ${stat.count}, 小时: ${stat.hour}`);
    });
    console.log();

    // 5. 测试MySQL统计表
    console.log("=== MySQL统计表测试 ===");
    try {
      console.log("📊 查询MySQL统计表数据...");
      const mysqlStats = await logStatisticsService.getStatistics({
        limit: 20,
      });
      
      console.log("MySQL统计表结果:");
      console.log(`总记录数: ${mysqlStats.total}`);
      mysqlStats.data.forEach(stat => {
        console.log(`  时间: ${stat.stat_time}, 级别: ${stat.level}, 服务: ${stat.service}, 数量: ${stat.count}`);
      });
    } catch (error) {
      console.error("❌ MySQL统计查询失败:", error);
    }
    console.log();

    // 6. 检查24小时内的详细统计
    console.log("=== 24小时详细统计 ===");
    const detailedQuery = `
      SELECT 
        level,
        service,
        log_type,
        COUNT(*) as count,
        toHour(timestamp) as hour,
        min(timestamp) as first_log,
        max(timestamp) as last_log
      FROM logs.application_logs 
      WHERE timestamp >= now() - INTERVAL 24 HOUR
      GROUP BY level, service, log_type, toHour(timestamp)
      ORDER BY hour DESC, count DESC
    `;

    console.log("📊 查询24小时详细统计...");
    const detailedResult = await client.query({
      query: detailedQuery,
      format: "JSONEachRow",
    });

    const detailedData = await detailedResult.json() as Array<{
      level: string;
      service: string;
      log_type: string;
      count: number;
      hour: number;
      first_log: string;
      last_log: string;
    }>;

    console.log("24小时详细统计:");
    detailedData.forEach(item => {
      console.log(`  小时${item.hour}: [${item.level}] ${item.service}/${item.log_type} - ${item.count} 条`);
      console.log(`    时间范围: ${item.first_log} ~ ${item.last_log}`);
    });

    console.log("\n🎉 日志统计调试完成！");

  } catch (error) {
    console.error("❌ 调试过程中发生错误:", error);
  } finally {
    // 确保进程退出
    setTimeout(() => {
      console.log("👋 进程结束");
      process.exit(0);
    }, 1000);
  }
}

// 运行调试
debugLogStatistics().catch(console.error); 