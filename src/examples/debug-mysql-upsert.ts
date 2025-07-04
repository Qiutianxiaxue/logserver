import "dotenv/config";
import { initMySQL } from "../config/mysql";
import { LogStatistics, StatType } from "../models/LogStatistics";

/**
 * 调试MySQL upsert操作
 * 测试唯一约束和upsert行为
 */
async function debugMySQLUpsert() {
  console.log("🔍 开始调试MySQL upsert操作...\n");

  try {
    // 1. 初始化MySQL
    console.log("📊 正在初始化MySQL...");
    const mysql = await initMySQL();

    if (!mysql) {
      console.error("❌ MySQL初始化失败");
      return;
    }
    console.log("✅ MySQL初始化成功\n");

    // 2. 清空表数据
    console.log("=== 清空表数据 ===");
    await LogStatistics.destroy({ where: {}, truncate: true });
    console.log("✅ 表数据已清空\n");

    // 3. 查看表结构和索引
    console.log("=== 检查表结构 ===");
    const tableInfo = await mysql.query(
      `
      SHOW CREATE TABLE qc_log_statistics
    `,
      { type: mysql.QueryTypes.SHOWTABLES }
    );

    console.log("表结构:");
    console.log(tableInfo[0]);
    console.log();

    // 4. 手动测试upsert操作
    console.log("=== 手动测试upsert操作 ===");

    const testTime = new Date("2025-07-04T15:00:00.000Z");
    const testData = [
      {
        stat_time: testTime,
        stat_type: StatType.HOUR,
        log_type: "system",
        service: "ClickHouse日志服务",
        level: "info",
        appid: "logserver",
        enterprise_id: "system",
        count: 596,
      },
      {
        stat_time: testTime,
        stat_type: StatType.HOUR,
        log_type: "system",
        service: "ClickHouse日志服务",
        level: "error",
        appid: "logserver",
        enterprise_id: "system",
        count: 247,
      },
      {
        stat_time: testTime,
        stat_type: StatType.HOUR,
        log_type: "system",
        service: "ClickHouse日志服务",
        level: "warn",
        appid: "logserver",
        enterprise_id: "system",
        count: 247,
      },
    ];

    for (let i = 0; i < testData.length; i++) {
      const data = testData[i];
      console.log(`插入第${i + 1}条数据: ${data.level} - ${data.count}条`);

      try {
        const result = await LogStatistics.upsert(data, {
          conflictFields: [
            "stat_time",
            "stat_type",
            "log_type",
            "service",
            "level",
            "appid",
            "enterprise_id",
          ],
        });

        console.log(`  upsert结果:`, result[1] ? "新插入" : "更新");

        // 检查当前表中的记录数
        const currentCount = await LogStatistics.count();
        console.log(`  当前表记录数: ${currentCount}`);
      } catch (error) {
        console.error(`  ❌ upsert失败:`, error);
      }
      console.log();
    }

    // 5. 查看最终结果
    console.log("=== 最终表数据 ===");
    const allRecords = await LogStatistics.findAll({
      order: [["level", "ASC"]],
      raw: true,
    });

    console.log(`总记录数: ${allRecords.length}`);
    allRecords.forEach((record, index) => {
      console.log(
        `  ${index + 1}. 级别: ${record.level}, 数量: ${record.count}`
      );
      console.log(`     时间: ${record.stat_time}, 类型: ${record.stat_type}`);
      console.log(`     服务: ${record.service}, 应用: ${record.appid}`);
      console.log();
    });

    console.log("\n🎉 MySQL upsert调试完成！");
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
debugMySQLUpsert().catch(console.error);
