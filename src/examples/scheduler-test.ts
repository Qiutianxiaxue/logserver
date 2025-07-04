import { statisticsScheduler } from "../utils/scheduler";
import dayjs from "dayjs";

/**
 * 调度器功能测试脚本 - 演示新的综合统计更新策略
 */
async function testScheduler() {
  console.log("🚀 开始测试统计调度器");

  try {
    // 1. 获取调度器状态
    console.log("\n📊 测试1: 获取调度器状态");
    const status = statisticsScheduler.getSchedulerStatus();
    console.log("调度器状态:", {
      isRunning: status.isRunning,
      nextExecutions: status.nextExecutions,
    });

    // 2. 展示新的调度策略
    console.log("\n🔄 新调度策略说明");
    console.log("=======================");
    console.log("📅 每小时综合更新 (每小时第0分钟):");
    console.log("   1. 更新上一完整小时统计 (历史数据)");
    console.log("   2. 更新今日累计统计 (实时数据)");
    console.log("   3. 更新本周累计统计 (实时数据)");
    console.log("   4. 更新本月累计统计 (实时数据)");
    console.log("");
    console.log("🧹 数据完整性保证:");
    console.log("   - 每天0点: 确保前一天完整统计");
    console.log("   - 每周一0点: 确保上一周完整统计");
    console.log("   - 每月1日0点: 确保上一月完整统计");

    // 3. 演示实时查询能力
    const now = dayjs();
    console.log("\n📈 实时查询示例");
    console.log("=================");
    console.log(`当前时间: ${now.format("YYYY-MM-DD HH:mm:ss")}`);
    console.log(`💡 现在可以查询:`);
    console.log(`   - 今日累计: ${now.format("YYYY-MM-DD")} 00:00 至现在`);
    console.log(
      `   - 本周累计: ${now.startOf("week").format("YYYY-MM-DD")} 至现在`
    );
    console.log(
      `   - 本月累计: ${now.startOf("month").format("YYYY-MM-DD")} 至现在`
    );

    // 4. 启动调度器
    console.log("\n📊 测试2: 启动调度器");
    statisticsScheduler.start();
    console.log("✅ 调度器已启动");

    // 5. 再次查看状态
    console.log("\n📊 测试3: 查看启动后状态");
    const statusAfterStart = statisticsScheduler.getSchedulerStatus();
    console.log("调度器状态:", {
      isRunning: statusAfterStart.isRunning,
      nextExecutions: statusAfterStart.nextExecutions,
    });

    // 6. 手动触发更新测试
    console.log("\n📊 测试4: 手动触发小时统计更新");
    await statisticsScheduler.manualUpdate("hour" as any);

    // 7. 展示业务价值
    console.log("\n💼 业务价值");
    console.log("============");
    console.log("✅ 可以随时查看今天到目前为止的统计");
    console.log("✅ 可以随时查看本周到目前为止的统计");
    console.log("✅ 可以随时查看本月到目前为止的统计");
    console.log("✅ 历史完整时间段的统计数据保持准确");
    console.log("✅ 既有实时性又有数据完整性保证");

    // 8. 等待几秒后停止调度器
    console.log("\n⏳ 等待3秒后停止调度器...");
    setTimeout(() => {
      statisticsScheduler.stop();
      console.log("✅ 调度器已停止");

      const finalStatus = statisticsScheduler.getSchedulerStatus();
      console.log("最终状态:", {
        isRunning: finalStatus.isRunning,
      });

      console.log("\n🎉 调度器测试完成！");
      console.log(
        "💡 提示: 在生产环境中，调度器会持续运行，每小时自动更新所有维度的统计数据"
      );
    }, 3000);
  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testScheduler();
}

export { testScheduler };
