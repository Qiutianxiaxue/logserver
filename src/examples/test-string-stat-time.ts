import { getSequelize, initMySQL, closeMySQL } from "../config/mysql";
import { logStatisticsService } from "../services/logStatisticsService";
import { StatType } from "../models/LogStatistics";
import dayjs from "dayjs";

async function testStringStatTime() {
  try {
    // 初始化MySQL连接
    const mysql = await initMySQL();
    if (!mysql) {
      console.error("❌ MySQL初始化失败");
      return;
    }
    console.log("✅ 数据库连接成功");

    const now = new Date();
    console.log(`\n当前时间: ${dayjs(now).format("YYYY-MM-DD HH:mm:ss")}`);

    // 测试各种时间格式的生成
    console.log("\n=== 测试时间格式生成 ===");

    // 测试小时格式
    console.log(`小时格式: ${dayjs(now).format("YYYYMMDDHH")}`); // 2025070415

    // 测试天格式
    console.log(`天格式: ${dayjs(now).format("YYYYMMDD")}`); // 20250704

    // 测试月格式
    console.log(`月格式: ${dayjs(now).format("YYYYMM")}`); // 202507

    // 测试周格式
    console.log(
      `周格式: ${dayjs(now).format("YYYY")}W${dayjs(now).format("WW")}`
    ); // 2025W30

    // 测试统计数据更新
    console.log("\n=== 测试统计数据更新 ===");

    // 先测试小时统计
    console.log("更新小时统计数据...");
    await logStatisticsService.updateStatistics(StatType.HOUR, now);

    // 测试天统计
    console.log("更新天统计数据...");
    await logStatisticsService.updateStatistics(StatType.DAY, now);

    // 查询并显示结果
    console.log("\n=== 查询统计结果 ===");

    const hourStats = await logStatisticsService.getStatistics({
      statType: StatType.HOUR,
      limit: 5,
    });

    console.log("小时统计结果:");
    hourStats.data.forEach((stat) => {
      console.log(`  ${stat.stat_time} - ${stat.level}: ${stat.count}条`);
    });

    const dayStats = await logStatisticsService.getStatistics({
      statType: StatType.DAY,
      limit: 5,
    });

    console.log("\n天统计结果:");
    dayStats.data.forEach((stat) => {
      console.log(`  ${stat.stat_time} - ${stat.level}: ${stat.count}条`);
    });

    // 测试时间范围查询
    console.log("\n=== 测试时间范围查询 ===");
    const startTime = dayjs(now).subtract(1, "day").format("YYYY-MM-DD");
    const endTime = dayjs(now).format("YYYY-MM-DD");

    console.log(`查询范围: ${startTime} 到 ${endTime}`);

    const rangeStats = await logStatisticsService.getStatistics({
      statType: StatType.DAY,
      startTime,
      endTime,
      limit: 10,
    });

    console.log("范围查询结果:");
    rangeStats.data.forEach((stat) => {
      console.log(`  ${stat.stat_time} - ${stat.level}: ${stat.count}条`);
    });

    console.log("\n✅ 测试完成");
  } catch (error) {
    console.error("❌ 测试失败:", error);
  } finally {
    await closeMySQL();
  }
}

testStringStatTime();
