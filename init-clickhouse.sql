-- 创建数据库
CREATE DATABASE IF NOT EXISTS logs;

-- 使用数据库
USE logs;

-- 创建应用日志表
CREATE TABLE IF NOT EXISTS application_logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3) DEFAULT now64(),
  level String,
  log_type String DEFAULT 'application',
  message String,
  service String DEFAULT '',
  service_name String DEFAULT '',
  service_ip String DEFAULT '',
  appid String DEFAULT '',
  enterprise_id String DEFAULT '',
  user_id String DEFAULT '',
  extra_data String DEFAULT '',
  created_date Date DEFAULT today()
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(timestamp), enterprise_id)
ORDER BY (timestamp, log_type, level, service_name, enterprise_id)
TTL toDateTime(timestamp) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192,
         index_granularity_bytes = 10485760,
         merge_with_ttl_timeout = 3600;

-- 创建API请求日志表
CREATE TABLE IF NOT EXISTS api_request_logs (
  -- 基础字段
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3) DEFAULT now64(),
  created_date Date DEFAULT today(),
  
  -- 请求基本信息
  method String,
  url String,
  host String,
  path String,
  query_params String DEFAULT '',
  headers String DEFAULT '{}',
  body String DEFAULT '',
  body_size UInt32 DEFAULT 0,
  content_type String DEFAULT '',

  -- 应用信息
  appid String,
  app_name String,

  -- 企业信息
  enterprise_id String,
  enterprise_name String,

  -- 用户和会话信息
  user_id String DEFAULT '',
  ip_address String DEFAULT '',
  real_ip String DEFAULT '',
  user_agent String DEFAULT '',
  referer String DEFAULT '',

  -- 响应信息
  status_code UInt16,
  response_body String DEFAULT '',
  response_size UInt32 DEFAULT 0,
  response_time UInt32,
  response_headers String DEFAULT '{}',
  
  -- 地理位置信息
  country_info String DEFAULT '',

  -- 设备和浏览器信息
  device_type String DEFAULT '',
  browser_name String DEFAULT '',
  browser_version String DEFAULT '',
  os_name String DEFAULT '',
  os_version String DEFAULT '',

  -- 扩展信息
  trace_id String DEFAULT '',
  span_id String DEFAULT '',
  correlation_id String DEFAULT '',
  tenant_id String DEFAULT '',
  tags String DEFAULT '{}',
  extra_data String DEFAULT '{}'
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(timestamp), enterprise_id)
ORDER BY (timestamp, method, status_code, enterprise_id, appid)
TTL toDateTime(timestamp) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192,
         index_granularity_bytes = 10485760,
         merge_with_ttl_timeout = 3600; 