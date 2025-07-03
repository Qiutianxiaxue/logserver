# ClickHouse 日志存储扩展指南

## 当前表设计评估

### ✅ 单表设计的优势

当前的 `application_logs` 表设计已经包含了 ClickHouse 的最佳实践：

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
- 🗑️ **自动清理**: TTL 自动删除过期数据
- 💾 **高压缩**: 列式存储 + 压缩算法，存储效率极高

### 📈 性能预估

| 日志量/天 | 月数据量  | 年数据量  | 查询性能 | 推荐方案       |
| --------- | --------- | --------- | -------- | -------------- |
| 1 万条    | 30 万条   | 360 万条  | 毫秒级   | 单表           |
| 10 万条   | 300 万条  | 3600 万条 | 毫秒级   | 单表           |
| 100 万条  | 3000 万条 | 3.6 亿条  | 秒级     | 单表           |
| 1000 万条 | 3 亿条    | 36 亿条   | 秒级     | 单表或考虑分表 |

## 🔄 何时考虑分表

### 场景 1: 超大数据量

```
日志量 > 1000万条/天 且 查询性能不满足需求
```

### 场景 2: 多租户隔离

```
不同客户/项目需要严格的数据隔离
```

### 场景 3: 不同数据生命周期

```
不同类型日志有不同的保留策略
```

## 🏗️ 分表策略

### 策略 1: 按服务分表

```sql
-- 为每个主要服务创建独立表
CREATE TABLE auth_service_logs AS application_logs;
CREATE TABLE api_service_logs AS application_logs;
CREATE TABLE payment_service_logs AS application_logs;
```

**优势**: 服务隔离，独立扩展
**劣势**: 跨服务查询复杂

### 策略 2: 按日志级别分表

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

### 策略 3: 分布式表

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

## 🔧 索引优化和重建

### 当前索引配置

我们的 `application_logs` 表采用了优化的索引配置：

```sql
CREATE TABLE application_logs (
  -- 字段定义 ...
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(timestamp), enterprise_id)  -- 按时间+企业分区
ORDER BY (timestamp, log_type, level, service_name, enterprise_id)  -- 优化的主索引
TTL toDateTime(timestamp) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192,
         index_granularity_bytes = 10485760,
         merge_with_ttl_timeout = 3600
```

### 索引优化的好处

#### 🚀 查询性能提升

- **按日志类型查询**: 10-50 倍性能提升
- **按企业 ID 查询**: 20-100 倍性能提升
- **组合查询**: 5-20 倍性能提升

#### 📊 存储优化

- **分区隔离**: 企业数据物理隔离，查询只扫描相关分区
- **压缩效率**: 相似数据聚集，压缩率更高
- **TTL 管理**: 按企业和时间精确控制数据生命周期

### 如果需要重建索引

如果您的表已经存在且有数据，需要重建索引来应用新配置：

#### 方法 1: 重命名表重建（推荐）

```sql
-- 1. 重命名现有表
RENAME TABLE application_logs TO application_logs_old;

-- 2. 创建新表（使用新的索引配置）
CREATE TABLE application_logs (
  -- 新的表结构和索引配置
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(timestamp), enterprise_id)
ORDER BY (timestamp, log_type, level, service_name, enterprise_id)
-- ... 其他配置

-- 3. 迁移数据
INSERT INTO application_logs
SELECT * FROM application_logs_old;

-- 4. 验证数据后删除旧表
-- DROP TABLE application_logs_old;
```

#### 方法 2: 使用 ALTER TABLE（较慢）

```sql
-- 修改分区键（需要重建整个表）
ALTER TABLE application_logs
MODIFY PARTITION BY (toYYYYMM(timestamp), enterprise_id);

-- 修改排序键（需要重建整个表）
ALTER TABLE application_logs
MODIFY ORDER BY (timestamp, log_type, level, service_name, enterprise_id);
```

### 监控索引效果

#### 查询执行计划

```sql
EXPLAIN SYNTAX
SELECT * FROM application_logs
WHERE log_type = 'payment_success'
  AND enterprise_id = 'ent_123'
  AND timestamp >= '2025-12-11 00:00:00';
```

#### 分区信息查询

```sql
SELECT
    partition,
    rows,
    bytes_on_disk,
    data_compressed_bytes,
    data_uncompressed_bytes
FROM system.parts
WHERE table = 'application_logs'
ORDER BY partition;
```

#### 索引使用情况

```sql
SELECT
    query,
    query_duration_ms,
    read_rows,
    read_bytes
FROM system.query_log
WHERE query LIKE '%application_logs%'
ORDER BY event_time DESC
LIMIT 10;
```

### 性能调优建议

#### 1. 分区策略

- 按时间分区避免查询过多历史数据
- 按企业分区实现多租户数据隔离
- 避免创建过多小分区（每个分区建议 > 1GB）

#### 2. 主索引设计

- 将最常用的查询字段放在 ORDER BY 前面
- 考虑字段基数：低基数字段在前，高基数字段在后
- 索引字段顺序影响查询性能

#### 3. 写入优化

- 批量写入比单条写入效率高 100 倍以上
- 按主索引顺序写入数据可提高压缩率
- 避免随机写入，尽量按时间顺序写入

### 最佳实践

#### ✅ 推荐做法

- 定期监控查询性能和分区大小
- 根据实际查询模式调整索引
- 使用合适的 TTL 策略管理历史数据
- 批量写入并保持时间顺序

#### ❌ 避免的做法

- 创建过多分区键字段
- 在主索引中包含高基数字段（如 UUID）
- 频繁 ALTER TABLE 修改索引
- 单条记录写入

## 📊 监控指标

定期监控以下指标来评估是否需要分表：

- **查询响应时间**: < 1 秒为优秀，< 5 秒为可接受
- **存储增长**: 月增长量和总存储量
- **写入性能**: 每秒插入行数
- **分区数量**: 避免过多小分区
- **内存使用**: 查询时的内存消耗

## 🚀 结论

对于当前的日志服务：

1. **短期**: 保持单表设计，专注于查询优化
2. **中期**: 根据实际数据量和查询模式调整
3. **长期**: 如果确实需要，再考虑分表策略

ClickHouse 的单表设计已经能很好地处理大部分日志场景，过早的分表可能会增加不必要的复杂度。
