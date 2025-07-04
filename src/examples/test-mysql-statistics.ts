import "dotenv/config";
import { initMySQL, MySQLHealthCheck } from "../config/mysql";
import {
  logStatisticsService,
  StatisticsQueryOptions,
} from "../services/logStatisticsService";
import { LogStatistics, StatType } from "../models/LogStatistics";

/**
 * MySQL统计表测试脚本
 * 检查MySQL连接、模型初始化和统计数据
 */
async function testMySQLStatistics() {
  console.log("🔍 开始测试MySQL统计功能...\n");

  try {
    // 1. 初始化MySQL连接
    console.log("📊 正在初始化MySQL...");
    const mysql = await initMySQL();

    if (!mysql) {
      console.error("❌ MySQL初始化失败");
      console.log("🔍 检查.env文件中的MySQL配置:");
      console.log(`  MYSQL_HOST: ${process.env.MYSQL_HOST || "(未设置)"}`);
      console.log(`  MYSQL_PORT: ${process.env.MYSQL_PORT || "(未设置)"}`);
      console.log(
        `  MYSQL_USERNAME: ${process.env.MYSQL_USERNAME || "(未设置)"}`
      );
      console.log(
        `  MYSQL_PASSWORD: ${
          process.env.MYSQL_PASSWORD ? "(已设置)" : "(未设置)"
        }`
      );
      console.log(
        `  MYSQL_DATABASE: ${process.env.MYSQL_DATABASE || "(未设置)"}`
      );
      return;
    }

    console.log("✅ MySQL初始化成功\n");

    // 2. 测试MySQL健康检查
    console.log("=== MySQL健康检查 ===");
    const healthCheck = await MySQLHealthCheck.healthCheck();
    console.log(`健康状态: ${healthCheck.success ? "健康✅" : "不健康❌"}`);
    console.log(
      `服务器ping: ${healthCheck.details.serverPing ? "成功✅" : "失败❌"}`
    );
    console.log(
      `数据库访问: ${healthCheck.details.databaseAccess ? "成功✅" : "失败❌"}`
    );
    console.log(
      `表访问: ${healthCheck.details.tableAccess ? "成功✅" : "失败❌"}`
    );
    if (healthCheck.details.error) {
      console.log(`错误信息: ${healthCheck.details.error}`);
    }
    console.log();

    // 3. 检查统计表结构
    console.log("=== 检查统计表结构 ===");
    try {
      const tableInfo = await mysql.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = 'qc_log_statistics'
      `);

      const [tableCount] = tableInfo[0] as Array<{ count: number }>;
      console.log(
        `qc_log_statistics表存在: ${tableCount.count > 0 ? "是✅" : "否❌"}`
      );

      if (tableCount.count > 0) {
        const recordCount = await LogStatistics.count();
        console.log(`统计表记录数: ${recordCount} 条`);
      }
    } catch (error) {
      console.error("❌ 检查统计表失败:", error);
    }
    console.log();

    // 4. 测试统计服务
    console.log("=== 测试统计服务 ===");
    try {
      // 先检查是否有统计数据
      const totalCount = await LogStatistics.count();
      console.log(`统计表总记录数: ${totalCount} 条`);

      if (totalCount === 0) {
        console.log("⚠️ 统计表为空，需要先运行统计任务");

        // 尝试手动执行一次统计更新
        console.log("🔄 尝试手动更新统计数据...");
        await logStatisticsService.updateStatistics(StatType.HOUR);
        console.log("✅ 统计数据更新完成");

        const newCount = await LogStatistics.count();
        console.log(`更新后记录数: ${newCount} 条`);
      }

      // 查询最近的统计数据
      const options: StatisticsQueryOptions = {
        limit: 10,
      };

      const result = await logStatisticsService.getStatistics(options);
      console.log(`\n查询结果: 总共 ${result.total} 条记录`);

      console.log("\n最近的统计数据:");
      result.data.forEach((stat, index) => {
        console.log(`  ${index + 1}. 时间: ${stat.stat_time.substring(0, 19)}`);
        console.log(
          `     级别: ${stat.level}, 服务: ${stat.service}, 类型: ${stat.log_type}`
        );
        console.log(
          `     应用: ${stat.appid}, 企业: ${stat.enterprise_id}, 数量: ${stat.count}`
        );
        console.log();
      });
    } catch (error) {
      console.error("❌ 统计服务测试失败:", error);
    }

    // 5. 按级别聚合统计
    console.log("=== 按级别聚合统计 ===");
    try {
      const levelStats = await logStatisticsService.getAggregatedStatistics({
        groupBy: "level",
        limit: 10,
      });

      console.log(`总统计量: ${levelStats.total}`);
      console.log("各级别统计:");
      levelStats.data.forEach((stat) => {
        console.log(`  ${stat.value}: ${stat.count} 条`);
      });
    } catch (error) {
      console.error("❌ 聚合统计失败:", error);
    }

    console.log("\n🎉 MySQL统计测试完成！");
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
testMySQLStatistics().catch(console.error);
