// 环境变量类型定义
export interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  API_PREFIX: string;
  LOG_LEVEL: string;
  JSON_LIMIT: string;
  URL_LIMIT: string;
  CLICKHOUSE_HOST: string;
  CLICKHOUSE_USERNAME: string;
  CLICKHOUSE_PASSWORD: string;
  CLICKHOUSE_DATABASE: string;
}

// ClickHouse配置类型
export interface ClickHouseConfig {
  url: string;
  username: string;
  password: string;
  database: string;
  clickhouse_settings: {
    async_insert: 1 | 0;
    wait_for_async_insert: 1 | 0;
  };
  session_timeout: number;
  compression: {
    response: boolean;
    request: boolean;
  };
}

// 日志数据类型
export interface LogData {
  id?: string;
  timestamp?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service?: string;
  host?: string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
  ip?: string;
  user_agent?: string;
  url?: string;
  method?: string;
  status_code?: number;
  response_time?: number;
  error_stack?: string;
  extra_data?: Record<string, any>;
  created_date?: string;
}

// 日志查询参数类型
export interface LogQueryOptions {
  limit?: number;
  offset?: number;
  level?: string;
  service?: string;
  startTime?: string;
  endTime?: string;
  keyword?: string;
}

// 日志统计类型
export interface LogStats {
  level: string;
  count: number;
  service: string;
  hour: number;
}

// 时间范围类型
export type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d';

// 时间范围选项
export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  description: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  code: 0 | 1; // 0: 失败, 1: 成功
  data?: T;
  message: string;
}

// 数据库插入结果类型
export interface DatabaseInsertResult {
  query_id: string;
}

// 数据库查询结果类型
export interface DatabaseQueryResult {
  query_id: string;
  elapsed: number;
  rows_read: number;
  bytes_read: number;
}

// HTTP错误类型
export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * API请求日志数据结构
 */
export interface ApiRequestLogData {
  // 基础字段
  id?: string;
  timestamp: string | Date;
  created_date?: string;
  
  // 请求基本信息
  method: string;
  url: string;
  path: string;
  query_params?: string;
  headers?: string | Record<string, any>;
  body?: string;
  body_size?: number;
  content_type?: string;
  
  // 响应信息
  status_code: number;
  response_body?: string;
  response_size?: number;
  response_time: number;
  response_headers?: string | Record<string, any>;
  
  // 用户和会话信息
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  real_ip?: string;
  user_agent?: string;
  referer?: string;
  
  // 地理位置信息
  country_code?: string;
  country_name?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  
  // 设备和浏览器信息
  device_type?: string;
  device_brand?: string;
  device_model?: string;
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  
  // 服务信息
  service_name?: string;
  service_version?: string;
  instance_id?: string;
  host?: string;
  environment?: string;
  deployment_region?: string;
  
  // API信息
  api_version?: string;
  endpoint?: string;
  operation_id?: string;
  route_pattern?: string;
  controller?: string;
  action?: string;
  
  // 认证和授权
  auth_type?: string;
  token_type?: string;
  scopes?: string;
  roles?: string;
  permissions?: string;
  
  // 错误和调试信息
  error_code?: string;
  error_message?: string;
  error_stack?: string;
  error_type?: string;
  
  // 分布式追踪
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  
  // 业务相关
  tenant_id?: string;
  organization_id?: string;
  request_id?: string;
  correlation_id?: string;
  transaction_id?: string;
  
  // 性能监控详细指标
  dns_time?: number;
  connect_time?: number;
  ssl_time?: number;
  ttfb?: number;
  download_time?: number;
  queue_time?: number;
  processing_time?: number;
  upstream_time?: number;
  
  // 缓存相关
  cache_status?: string;
  cache_key?: string;
  cache_ttl?: number;
  cache_hit_ratio?: number;
  
  // 限流和配额
  rate_limit_remaining?: number;
  rate_limit_reset?: number;
  quota_used?: number;
  quota_remaining?: number;
  rate_limit_window?: string;
  
  // 网络信息
  protocol?: string;
  protocol_version?: string;
  connection_type?: string;
  tls_version?: string;
  cipher_suite?: string;
  
  // 代理和负载均衡
  proxy_info?: string;
  load_balancer?: string;
  upstream_server?: string;
  upstream_status?: number;
  
  // 请求特征
  is_bot?: boolean | number;
  is_mobile?: boolean | number;
  is_crawler?: boolean | number;
  is_suspicious?: boolean | number;
  
  // 业务指标
  business_metrics?: string | Record<string, any>;
  custom_fields?: string | Record<string, any>;
  tags?: string[];
  
  // 数据质量
  data_version?: string;
  validation_status?: string;
  processing_status?: string;
}

/**
 * API请求日志查询选项
 */
export interface ApiRequestLogQueryOptions {
  // 分页
  limit?: number;
  offset?: number;
  
  // 时间范围
  startTime?: string;
  endTime?: string;
  
  // 基础过滤
  method?: string;
  status_code?: number;
  service_name?: string;
  environment?: string;
  
  // 用户和会话
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  
  // API相关
  endpoint?: string;
  api_version?: string;
  
  // 性能过滤
  min_response_time?: number;
  max_response_time?: number;
  
  // 错误过滤
  has_error?: boolean;
  error_type?: string;
  
  // 追踪相关
  trace_id?: string;
  
  // 业务相关
  tenant_id?: string;
  organization_id?: string;
  
  // 搜索关键词
  keyword?: string;
  
  // 排序
  sort_by?: 'timestamp' | 'response_time' | 'status_code';
  sort_order?: 'ASC' | 'DESC';
  
  // 地理位置
  country_code?: string;
  city?: string;
  
  // 设备类型
  device_type?: string;
  is_mobile?: boolean;
  is_bot?: boolean;
}

/**
 * API请求日志统计信息
 */
export interface ApiRequestLogStats {
  // 时间维度
  timestamp: string;
  hour?: number;
  date?: string;
  
  // 基础指标
  total_requests: number;
  unique_users: number;
  unique_ips: number;
  
  // 状态码分布
  success_count: number; // 2xx
  client_error_count: number; // 4xx
  server_error_count: number; // 5xx
  redirect_count: number; // 3xx
  
  // 性能指标
  avg_response_time: number;
  p50_response_time: number;
  p90_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  
  // 流量指标
  total_bytes_sent: number;
  total_bytes_received: number;
  
  // 热门数据
  top_endpoints?: Array<{ endpoint: string; count: number }>;
  top_user_agents?: Array<{ user_agent: string; count: number }>;
  top_countries?: Array<{ country_code: string; count: number }>;
  
  // 错误分析
  error_rate: number;
  top_errors?: Array<{ error_code: string; count: number }>;
  
  // 缓存效率
  cache_hit_rate: number;
  
  // 服务分布
  service_name?: string;
  environment?: string;
} 