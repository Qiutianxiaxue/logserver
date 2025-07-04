import "dotenv/config";
import { initClickHouse } from "../config/database";
import dayjs from "dayjs";

/**
 * 调试统计查询脚本
 * 测试统计查询的具体SQL和结果
 */
async function debugStatisticsQuery() {
  console.log("🔍 开始调试统计查询...\n");

  try {
    // 1. 初始化ClickHouse
    console.log("📊 正在初始化ClickHouse...");
    const client = await initClickHouse();

    if (!client) {
      console.error("❌ ClickHouse初始化失败");
      return;
    }

    console.log("✅ ClickHouse初始化成功\n");

    // 2. 模拟统计服务的时间范围计算
    const now = new Date();
    const target = dayjs(now);

    // 当前小时范围
    const hourRange = {
      startTime: target.startOf("hour").format("YYYY-MM-DD HH:mm:ss"),
      endTime: target.endOf("hour").format("YYYY-MM-DD HH:mm:ss"),
    };

    // 今日范围
    const dayRange = {
      startTime: target.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
      endTime: target.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
    };

    console.log("=== 时间范围信息 ===");
    console.log(`当前时间: ${now.toISOString()}`);
    console.log(`当前小时范围: ${hourRange.startTime} ~ ${hourRange.endTime}`);
    console.log(`今日范围: ${dayRange.startTime} ~ ${dayRange.endTime}\n`);

    // 3. 测试当前小时的统计查询（和统计服务相同的查询）
    console.log("=== 测试当前小时统计查询 ===");
    const hourQuery = `
      SELECT
        log_type,
        service,
        level,
        appid,
        enterprise_id,
        COUNT(*) as count
      FROM ${process.env.CLICKHOUSE_DATABASE || "logs"}.application_logs
      WHERE timestamp >= '${hourRange.startTime}' 
        AND timestamp < '${hourRange.endTime}'
      GROUP BY log_type, service, level, appid, enterprise_id
      ORDER BY count DESC
    `;

    console.log("执行的SQL查询:");
    console.log(hourQuery);
    console.log();

    try {
      const hourResult = await client.query({
        query: hourQuery,
        format: "JSONEachRow",
      });

      const hourData = (await hourResult.json()) as Array<{
        log_type: string;
        service: string;
        level: string;
        appid: string;
        enterprise_id: string;
        count: number;
      }>;

      console.log(`当前小时查询结果: ${hourData.length} 条`);
      hourData.forEach((item, index) => {
        console.log(
          `  ${index + 1}. 级别: ${item.level}, 服务: ${item.service}, 数量: ${
            item.count
          }`
        );
        console.log(
          `     日志类型: ${item.log_type}, 应用: ${item.appid}, 企业: ${item.enterprise_id}`
        );
      });
    } catch (error) {
      console.error("❌ 当前小时查询失败:", error);
    }
    console.log();

    // 4. 测试今日统计查询
    console.log("=== 测试今日统计查询 ===");
    const dayQuery = `
      SELECT
        log_type,
        service,
        level,
        appid,
        enterprise_id,
        COUNT(*) as count
      FROM ${process.env.CLICKHOUSE_DATABASE || "logs"}.application_logs
      WHERE timestamp >= '${dayRange.startTime}' 
        AND timestamp < '${dayRange.endTime}'
      GROUP BY log_type, service, level, appid, enterprise_id
      ORDER BY count DESC
    `;

    try {
      const dayResult = await client.query({
        query: dayQuery,
        format: "JSONEachRow",
      });

      const dayData = (await dayResult.json()) as Array<{
        log_type: string;
        service: string;
        level: string;
        appid: string;
        enterprise_id: string;
        count: number;
      }>;

      console.log(`今日查询结果: ${dayData.length} 条`);
      dayData.forEach((item, index) => {
        console.log(
          `  ${index + 1}. 级别: ${item.level}, 服务: ${item.service}, 数量: ${
            item.count
          }`
        );
        console.log(
          `     日志类型: ${item.log_type}, 应用: ${item.appid}, 企业: ${item.enterprise_id}`
        );
      });
    } catch (error) {
      console.error("❌ 今日查询失败:", error);
    }
    console.log();

    // 5. 检查原始日志数据的时间分布
    console.log("=== 检查原始日志时间分布 ===");
    const timeDistributionQuery = `
      SELECT 
        toHour(timestamp) as hour,
        level,
        COUNT(*) as count,
        min(timestamp) as first_time,
        max(timestamp) as last_time
      FROM ${process.env.CLICKHOUSE_DATABASE || "logs"}.application_logs 
      WHERE toDate(timestamp) = today()
      GROUP BY toHour(timestamp), level
      ORDER BY hour DESC, level
    `;

    try {
      const timeResult = await client.query({
        query: timeDistributionQuery,
        format: "JSONEachRow",
      });

      const timeData = (await timeResult.json()) as Array<{
        hour: number;
        level: string;
        count: number;
        first_time: string;
        last_time: string;
      }>;

      console.log("今日各小时日志分布:");
      timeData.forEach((item) => {
        console.log(`  ${item.hour}点: ${item.level} - ${item.count} 条`);
        console.log(`    时间范围: ${item.first_time} ~ ${item.last_time}`);
      });
    } catch (error) {
      console.error("❌ 时间分布查询失败:", error);
    }

    console.log("\n🎉 统计查询调试完成！");
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
debugStatisticsQuery().catch(console.error);
