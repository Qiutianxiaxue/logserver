import { initClickHouse } from '../config/database';
import { logger } from '../utils/logger';

async function testLoggerDatabase() {
  console.log('🚀 测试日志记录器数据库写入功能...\n');

  try {
    // 首先初始化数据库连接
    console.log('📊 初始化ClickHouse连接...');
    await initClickHouse();
    console.log('✅ 数据库连接成功\n');

    // 测试日志写入
    console.log('📝 写入测试日志...');
    await logger.info('测试日志记录器数据库写入功能', {
      test: true,
      timestamp: new Date().toISOString(),
      module: 'logger-test'
    });

    await logger.error('测试错误日志', {
      error: 'This is a test error',
      severity: 'test'
    });

    await logger.warn('测试警告日志', {
      warning: 'This is a test warning',
      action: 'test'
    });

    console.log('✅ 日志写入完成');
    
    // 等待一段时间确保异步写入完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🔍 请查看ClickHouse数据库中的application_logs表，查找：');
    console.log('  - log_type = "system"');
    console.log('  - service_name = "application"');
    console.log('  - message 包含 "测试日志记录器"');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  testLoggerDatabase().then(() => {
    console.log('\n🎉 测试完成');
    process.exit(0);
  }).catch((error) => {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
  });
}

export { testLoggerDatabase }; 