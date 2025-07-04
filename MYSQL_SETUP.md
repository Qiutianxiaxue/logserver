# MySQL 统计功能配置指南

## 概述

本项目现已支持 MySQL 数据库来存储日志统计数据，实现高效的分析和查询功能。

## 架构说明

- **ClickHouse**: 存储原始日志数据，提供高效的日志写入和查询
- **MySQL**: 存储预计算的统计数据，提供快速的分析查询

## 环境变量配置

在项目根目录创建 `.env` 文件，添加以下 MySQL 配置：

```env
# 基础配置
PORT=13000
NODE_ENV=development
API_PREFIX=/api
LOG_LEVEL=combined
JSON_LIMIT=10mb
URL_LIMIT=10mb

# ClickHouse配置（用于日志存储）
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=logs

# MySQL配置（用于统计数据）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USERNAME=root
MYSQL_PASSWORD=yourpassword
MYSQL_DATABASE=log_statistics

# 服务配置
SERVICE_ID=log-service-001
SERVICE_NAME=ClickHouse日志服务
LOG_WEBSOCKET_URL=ws://localhost:13001
```

## 数据库准备

### 创建 MySQL 数据库

```sql
CREATE DATABASE log_statistics CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 创建用户（可选）

```sql
CREATE USER 'logservice'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON log_statistics.* TO 'logservice'@'localhost';
FLUSH PRIVILEGES;
```

## 统计功能说明

### 统计维度

系统会按照以下维度进行统计：

- **时间维度**: 小时、天、周、月
- **业务维度**:
  - `log_type`: 日志类型
  - `service`: 服务名称
  - `level`: 日志级别（debug、info、warn、error）
  - `appid`: 应用 ID
  - `enterprise_id`: 企业 ID

### 自动更新

系统使用基于cron的智能调度策略，提供**实时累计统计**和**历史完整数据**：

#### 🔄 每小时综合更新 (`0 * * * *`)

每小时的第0分钟，系统会同时更新：

1. **上一完整小时统计** - 历史数据（固定不变）
2. **今日累计统计** - 从今天0点到当前时间的累计数据
3. **本周累计统计** - 从本周开始到当前时间的累计数据  
4. **本月累计统计** - 从本月开始到当前时间的累计数据

#### 🧹 数据完整性保证

为确保历史数据的完整性，系统还会在边界时间执行清理任务：

- `0 0 * * *` - 每天0点：确保前一天的完整统计
- `0 0 * * 1` - 每周一0点：确保上一周的完整统计
- `0 0 1 * *` - 每月1日0点：确保上一月的完整统计

#### 📊 实时性优势

这种设计的优势：

- ✅ **实时查看当前进度**: 随时可以查看今天/本周/本月到目前为止的统计
- ✅ **历史数据完整**: 过去的完整时间段统计数据保持不变
- ✅ **数据一致性**: 通过边界时间的清理任务确保数据准确性
- ✅ **业务友好**: 符合实际业务查看当前进度的需求

#### 📈 查询示例

现在你可以查询：
- 今天10:30时：能看到今天0:00-10:30的累计统计
- 本周三15:45时：能看到本周一0:00到现在的累计统计  
- 本月15日：能看到本月1日到现在的累计统计

## API 接口

### 查询统计数据

```bash
GET /api/logs/statistics
```

查询参数：

- `startTime`: 开始时间 (ISO 8601 格式)
- `endTime`: 结束时间 (ISO 8601 格式)
- `statType`: 统计类型 (hour/day/week/month)
- `enterprise_id`: 企业 ID
- `appid`: 应用 ID
- `service`: 服务名称
- `level`: 日志级别
- `log_type`: 日志类型
- `limit`: 返回条数限制 (默认 100)
- `offset`: 偏移量 (默认 0)

### 获取聚合统计数据

```bash
GET /api/logs/statistics/aggregated
```

查询参数：

- 基础参数同上
- `groupBy`: 分组字段 (stat_time/service/level/appid/enterprise_id/log_type)

### 获取统计概览

```bash
GET /api/logs/statistics/overview
```

返回各个维度的 TOP 统计数据。

### 获取时间序列统计

```bash
GET /api/logs/statistics/timeseries
```

返回按时间排序的统计数据，用于绘制趋势图。

### 手动更新统计数据

```bash
POST /api/logs/statistics/update
```

请求体：

```json
{
  "statType": "hour",
  "targetTime": "2024-01-01T10:00:00.000Z"
}
```

### 批量更新所有统计数据

```bash
POST /api/logs/statistics/update-all
```

请求体：

```json
{
  "targetTime": "2024-01-01T10:00:00.000Z"
}
```

## 使用示例

### 查询最近 24 小时的小时统计

```bash
curl -X GET "http://localhost:13000/api/logs/statistics?statType=hour&startTime=2024-01-01T00:00:00.000Z&endTime=2024-01-02T00:00:00.000Z"
```

### 按服务分组统计

```bash
curl -X GET "http://localhost:13000/api/logs/statistics/aggregated?groupBy=service&startTime=2024-01-01T00:00:00.000Z&endTime=2024-01-02T00:00:00.000Z"
```

### 获取统计概览

```bash
curl -X GET "http://localhost:13000/api/logs/statistics/overview?startTime=2024-01-01T00:00:00.000Z&endTime=2024-01-02T00:00:00.000Z"
```

## 注意事项

1. **数据库连接**: 确保 MySQL 服务正在运行，且连接信息正确
2. **表结构**: 系统会自动创建和同步表结构，无需手动创建
3. **性能**: 统计数据会自动更新，首次启动时会执行初始化统计
4. **错误处理**: 如果 MySQL 连接失败，统计功能会被禁用，但不影响日志服务的正常运行

## 故障排除

### MySQL 连接失败

1. 检查 MySQL 服务是否运行
2. 验证连接信息是否正确
3. 确认数据库用户权限
4. 检查防火墙设置

### 统计数据不更新

1. 检查定时任务是否正常运行
2. 查看服务日志中的错误信息
3. 手动触发统计更新进行测试
4. 确认 ClickHouse 中有日志数据

### 性能优化建议

1. 为统计表添加适当的索引
2. 定期清理过期的统计数据
3. 根据查询模式调整统计粒度
4. 考虑使用读写分离
