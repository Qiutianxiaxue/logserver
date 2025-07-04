import { logStatisticsService } from '../services/logStatisticsService';
import { StatType } from '../models/LogStatistics';

/**
 * 统计功能测试脚本
 */
async function testStatistics() {
  console.log('🚀 开始测试统计功能');

  try {
    // 1. 测试手动更新统计数据
    console.log('\n📊 测试1: 更新小时统计数据');
    await logStatisticsService.updateStatistics(StatType.HOUR);
    console.log('✅ 小时统计数据更新成功');

    // 2. 测试查询统计数据
    console.log('\n📊 测试2: 查询统计数据');
    const stats = await logStatisticsService.getStatistics({
      statType: StatType.HOUR,
      limit: 10
    });
    console.log(`✅ 查询到 ${stats.data.length} 条统计数据`);
    if (stats.data.length > 0) {
      console.log('📋 示例数据:', stats.data[0]);
    }

    // 3. 测试聚合统计数据
    console.log('\n📊 测试3: 查询聚合统计数据');
    const aggregated = await logStatisticsService.getAggregatedStatistics({
      groupBy: 'level',
      limit: 5
    });
    console.log(`✅ 查询到 ${aggregated.data.length} 条聚合数据`);
    if (aggregated.data.length > 0) {
      console.log('📋 示例数据:', aggregated.data[0]);
    }

    // 4. 测试批量更新
    console.log('\n📊 测试4: 批量更新所有统计数据');
    await logStatisticsService.updateAllStatistics();
    console.log('✅ 批量更新完成');

    console.log('\n🎉 所有测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testStatistics();
}

export { testStatistics }; 