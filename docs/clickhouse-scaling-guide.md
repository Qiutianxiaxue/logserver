# ClickHouse 日志存储扩展指南

## 当前表设计评估

### ✅ 单表设计的优势

当前的 `application_logs` 表设计已经包含了ClickHouse的最佳实践：

```sql
CREATE TABLE application_logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3) DEFAULT now64(),
  level String,
  message String,
  service String DEFAULT '',
  -- ... 其他字段 ...
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)      -- 按月分区
ORDER BY (timestamp, level, service)  -- 优化排序键
TTL timestamp + INTERVAL 90 DAY       -- 自动清理
SETTINGS index_granularity = 8192
```

**优势：**
- 📅 **自动分区**: 按月分区，查询时只扫描相关时间段
- 🚀 **查询优化**: 排序键针对常见查询模式优化
- 🗑️ **自动清理**: TTL自动删除过期数据
- 💾 **高压缩**: 列式存储 + 压缩算法，存储效率极高

### 📈 性能预估

| 日志量/天 | 月数据量 | 年数据量 | 查询性能 | 推荐方案 |
|---------|---------|---------|---------|---------|
| 1万条   | 30万条   | 360万条  | 毫秒级   | 单表 |
| 10万条  | 300万条  | 3600万条 | 毫秒级   | 单表 |
| 100万条 | 3000万条 | 3.6亿条  | 秒级     | 单表 |
| 1000万条| 3亿条    | 36亿条   | 秒级     | 单表或考虑分表 |

## 🔄 何时考虑分表

### 场景1: 超大数据量
```
日志量 > 1000万条/天 且 查询性能不满足需求
```

### 场景2: 多租户隔离
```
不同客户/项目需要严格的数据隔离
```

### 场景3: 不同数据生命周期
```
不同类型日志有不同的保留策略
```

## 🏗️ 分表策略

### 策略1: 按服务分表
```sql
-- 为每个主要服务创建独立表
CREATE TABLE auth_service_logs AS application_logs;
CREATE TABLE api_service_logs AS application_logs;
CREATE TABLE payment_service_logs AS application_logs;
```

**优势**: 服务隔离，独立扩展
**劣势**: 跨服务查询复杂

### 策略2: 按日志级别分表
```sql
-- 错误日志单独表（需要长期保留）
CREATE TABLE error_logs (
  -- ... 字段定义 ...
  TTL timestamp + INTERVAL 365 DAY  -- 保留1年
);

-- 普通日志表（短期保留）
CREATE TABLE info_logs (
  -- ... 字段定义 ...
  TTL timestamp + INTERVAL 30 DAY   -- 保留30天
);
```

**优势**: 不同保留策略，存储优化
**劣势**: 应用逻辑复杂

### 策略3: 分布式表
```sql
-- 在集群环境中使用分布式表
CREATE TABLE application_logs_distributed AS application_logs 
ENGINE = Distributed(cluster, database, application_logs, rand())
```

**优势**: 水平扩展，高可用
**适用**: 集群部署环境

## 📋 评估清单

在考虑分表前，请评估以下因素：

### ✅ 性能评估
- [ ] 当前查询响应时间是否满足需求？
- [ ] 存储空间增长是否可控？
- [ ] 写入性能是否有瓶颈？

### ✅ 业务需求
- [ ] 是否需要不同的数据保留策略？
- [ ] 是否需要服务间数据隔离？
- [ ] 是否有多租户需求？

### ✅ 运维复杂度
- [ ] 团队是否有管理多表的经验？
- [ ] 监控和备份策略是否能适应？
- [ ] 应用代码改动成本如何？

## 🎯 推荐方案

### 对于大多数场景 (推荐)
```
保持当前的单表设计，继续优化：
1. 监控查询性能
2. 根据查询模式调整排序键
3. 考虑添加跳数索引
4. 适当调整分区策略
```

### 对于超大规模场景
```
1. 首先尝试查询优化
2. 考虑硬件升级
3. 最后考虑分表策略
```

## 🔧 性能优化建议

### 1. 查询优化
```sql
-- 利用分区裁剪
SELECT * FROM application_logs 
WHERE timestamp >= '2025-12-01' AND timestamp < '2025-12-11'
  AND level = 'error'
  AND service = 'auth-service'

-- 避免全表扫描
SELECT count() FROM application_logs 
WHERE toYYYYMM(timestamp) = 202512  -- 利用分区
```

### 2. 索引优化
```sql
-- 考虑添加跳数索引
ALTER TABLE application_logs 
ADD INDEX idx_service service TYPE bloom_filter GRANULARITY 1;

ALTER TABLE application_logs 
ADD INDEX idx_level level TYPE set(0) GRANULARITY 1;
```

### 3. 物化视图
```sql
-- 为频繁的统计查询创建物化视图
CREATE MATERIALIZED VIEW logs_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, service, level)
AS SELECT
  toStartOfHour(timestamp) as hour,
  service,
  level,
  count() as count
FROM application_logs
GROUP BY hour, service, level;
```

## 📊 监控指标

定期监控以下指标来评估是否需要分表：

- **查询响应时间**: < 1秒为优秀，< 5秒为可接受
- **存储增长**: 月增长量和总存储量
- **写入性能**: 每秒插入行数
- **分区数量**: 避免过多小分区
- **内存使用**: 查询时的内存消耗

## 🚀 结论

对于当前的日志服务：
1. **短期**: 保持单表设计，专注于查询优化
2. **中期**: 根据实际数据量和查询模式调整
3. **长期**: 如果确实需要，再考虑分表策略

ClickHouse的单表设计已经能很好地处理大部分日志场景，过早的分表可能会增加不必要的复杂度。 