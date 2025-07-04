import { createClient } from '@clickhouse/client';

/**
 * ClickHouse连接诊断工具
 */
async function diagnoseClickHouse() {
  console.log('🔍 ClickHouse连接诊断工具\n');

  // 显示当前环境变量
  console.log('=== 当前环境变量配置 ===');
  console.log('CLICKHOUSE_HOST:', process.env.CLICKHOUSE_HOST || '(未设置，使用默认值: localhost)');
  console.log('CLICKHOUSE_PORT:', process.env.CLICKHOUSE_PORT || '(未设置，使用默认值: 8123)');
  console.log('CLICKHOUSE_USERNAME:', process.env.CLICKHOUSE_USERNAME || '(未设置，使用默认值: default)');
  console.log('CLICKHOUSE_PASSWORD:', process.env.CLICKHOUSE_PASSWORD ? '(已设置)' : '(未设置，使用空密码)');
  console.log('CLICKHOUSE_DATABASE:', process.env.CLICKHOUSE_DATABASE || '(未设置，使用默认值: logs)');

  const host = process.env.CLICKHOUSE_HOST || 'localhost';
  const port = process.env.CLICKHOUSE_PORT || '8123';
  const username = process.env.CLICKHOUSE_USERNAME || 'default';
  const password = process.env.CLICKHOUSE_PASSWORD || '';
  const database = process.env.CLICKHOUSE_DATABASE || 'logs';

  const url = host.startsWith('http') ? host : `http://${host}:${port}`;

  console.log('\n=== 连接配置 ===');
  console.log('URL:', url);
  console.log('用户名:', username);
  console.log('密码:', password ? '(已设置)' : '(空密码)');
  console.log('数据库:', database);

  // 测试1: 基础连接测试
  console.log('\n=== 测试1: 基础连接测试 ===');
  try {
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      console.log('✅ ClickHouse HTTP接口可访问');
      console.log('响应:', text);
    } else {
      console.log('❌ ClickHouse HTTP接口访问失败');
      console.log('状态码:', response.status);
      console.log('状态信息:', response.statusText);
    }
  } catch (error) {
    console.log('❌ 无法连接到ClickHouse HTTP接口');
    console.log('错误:', (error as Error).message);
    console.log('\n💡 解决建议:');
    console.log('1. 确保ClickHouse服务正在运行');
    console.log('2. 检查主机名和端口是否正确');
    console.log('3. 检查防火墙设置');
    return;
  }

  // 测试2: 带认证的连接测试
  console.log('\n=== 测试2: 认证连接测试 ===');
  const configs = [
    // 测试1: 使用配置的用户名密码
    {
      name: '当前配置',
      config: { url, username, password, database }
    },
    // 测试2: 使用默认无密码
    {
      name: '默认无密码',
      config: { url, username: 'default', password: '', database }
    },
  ];

  for (const test of configs) {
    console.log(`\n--- 测试: ${test.name} ---`);
    try {
      const client = createClient(test.config);
      
      // 测试ping
      const pingResult = await client.ping();
      console.log('✅ Ping成功:', pingResult);

      // 测试查询
      const queryResult = await client.query({
        query: 'SELECT 1 as test',
        format: 'JSONEachRow'
      });
      const data = await queryResult.json();
      console.log('✅ 查询成功:', data);

      // 测试数据库创建权限
      try {
        await client.command({
          query: `CREATE DATABASE IF NOT EXISTS ${database}`
        });
        console.log('✅ 数据库操作权限正常');
      } catch (dbError) {
        console.log('⚠️ 数据库操作权限受限:', (dbError as Error).message);
      }

      console.log('🎉 此配置可以正常使用！');
      
      // 如果测试成功，显示环境变量配置建议
      if (test.name === '默认无密码' && password !== '') {
        console.log('\n💡 建议: 移除CLICKHOUSE_PASSWORD环境变量或设置为空字符串');
      }
      
      break; // 找到可用配置就停止测试

    } catch (error) {
      console.log('❌ 连接失败:', (error as Error).message);
    }
  }

  console.log('\n=== 解决方案建议 ===');
  console.log('如果连接失败，请尝试以下解决方案：');
  console.log('\n1. 检查ClickHouse安装:');
  console.log('   - Windows: 确保ClickHouse服务正在运行');
  console.log('   - 默认端口: 8123 (HTTP), 9000 (Native)');
  
  console.log('\n2. 创建.env文件设置环境变量:');
  console.log('   CLICKHOUSE_HOST=localhost');
  console.log('   CLICKHOUSE_PORT=8123');
  console.log('   CLICKHOUSE_USERNAME=default');
  console.log('   CLICKHOUSE_PASSWORD=           # 空密码或实际密码');
  console.log('   CLICKHOUSE_DATABASE=logs');

  console.log('\n3. ClickHouse用户配置:');
  console.log('   - 默认用户: default (通常无密码)');
  console.log('   - 如需创建用户，登录ClickHouse执行:');
  console.log('     CREATE USER your_user IDENTIFIED BY \'your_password\'');
  console.log('     GRANT ALL ON *.* TO your_user');

  console.log('\n4. Windows ClickHouse安装:');
  console.log('   - 下载: https://clickhouse.com/docs/en/install');
  console.log('   - 或使用Docker: docker run -d --name clickhouse -p 8123:8123 clickhouse/clickhouse-server');
}

// 如果直接运行此文件
if (require.main === module) {
  diagnoseClickHouse().then(() => {
    console.log('\n🎉 诊断完成');
    process.exit(0);
  }).catch((error) => {
    console.error('诊断过程中发生错误:', error);
    process.exit(1);
  });
}

export { diagnoseClickHouse }; 