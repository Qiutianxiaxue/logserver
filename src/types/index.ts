// 环境变量类型定义
export interface EnvConfig {
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
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

// 日志数据类型 - 对应 application_logs 表
export interface LogData {
  id?: string;
  timestamp?: string;
  request_id?: string;
  level: "debug" | "info" | "warn" | "error";
  log_type?: string;
  message: string;

  // 错误信息
  error_message?: string;
  file_path?: string;
  line_number?: number;

  // 客户端信息
  client_ip?: string;

  // 服务信息
  service?: string;
  service_name?: string;
  service_ip?: string;

  // 应用和企业信息
  appid?: string;
  enterprise_id?: string;

  // 用户信息
  user_id?: string;

  // HTTP请求信息
  http_url?: string;
  http_request_body?: string;

  // 追踪和额外数据
  trace_data?: string;
  extra_data?: Record<string, any> | string;
  created_date?: string;
}

// 日志查询参数类型
export interface LogQueryOptions {
  limit?: number;
  offset?: number;

  // 基础过滤
  level?: string;
  log_type?: string;
  message?: string;

  // 请求信息
  request_id?: string;

  // 错误信息过滤
  error_message?: string;
  file_path?: string;
  line_number?: number;

  // 客户端信息
  client_ip?: string;

  // 服务信息过滤
  service?: string;
  service_name?: string;
  service_ip?: string;

  // 应用和企业过滤
  appid?: string;
  enterprise_id?: string;

  // 用户过滤
  user_id?: string;

  // HTTP请求信息过滤
  http_url?: string;
  http_request_body?: string;

  // 追踪数据过滤
  trace_data?: string;

  // 时间范围
  startTime?: string;
  endTime?: string;

  // 关键词搜索
  keyword?: string;

  // 排序选项
  sort_by?: "timestamp" | "level" | "service_name" | "enterprise_id";
  sort_order?: "ASC" | "DESC";
}

// 日志统计类型
export interface LogStats {
  level: string;
  count: number;
  service: string;
  hour: number;
}

// 时间范围类型
export type TimeRange = "1h" | "24h" | "7d" | "30d" | "90d";

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
 * API请求日志数据结构 - 对应 api_request_logs 表
 */
export interface ApiRequestLogData {
  // 基础字段
  id?: string;
  request_id?: string;
  timestamp: string | Date;
  created_date?: string;

  // 请求基本信息（必填）
  method: string;
  url: string;
  host?: string;
  path?: string;
  query_params?: string;
  headers?: string | Record<string, any>;
  body?: string;
  body_size?: number;
  content_type?: string;

  // 应用信息
  appid?: string;
  app_name?: string;

  // 企业信息
  enterprise_id?: string;
  enterprise_name?: string;

  // 用户和会话信息
  user_id?: string;
  ip_address?: string;
  real_ip?: string;
  user_agent?: string;
  referer?: string;

  // 响应信息（必填：status_code, response_time）
  status_code: number;
  response_body?: string;
  response_size?: number;
  response_time: number;
  response_headers?: string | Record<string, any>;

  // 地理位置信息
  country_info?: string;

  // 设备和浏览器信息
  browser?: string;

  // 服务器信息
  service_type?: string;
  service_name?: string;
  service_ip?: string;

  // 错误和调试信息
  error_code?: string;
  error_message?: string;
  error_trace?: string;
}

/**
 * API请求日志查询选项 - 基于实际表字段
 */
export interface ApiRequestLogQueryOptions {
  // 分页
  limit?: number;
  offset?: number;

  // 基础过滤
  request_id?: string;

  // 时间范围
  startTime?: string;
  endTime?: string;

  // 基础过滤
  method?: string;
  status_code?: number;
  service_name?: string;
  service_type?: string;

  // 应用和企业过滤
  appid?: string;
  app_name?: string;
  enterprise_id?: string;
  enterprise_name?: string;

  // 用户和会话
  user_id?: string;
  ip_address?: string;
  real_ip?: string;

  // 性能过滤
  min_response_time?: number;
  max_response_time?: number;

  // 错误过滤
  has_error?: boolean;
  error_code?: string;

  // 搜索关键词
  keyword?: string;

  // 排序
  sort_by?: "timestamp" | "response_time" | "status_code";
  sort_order?: "ASC" | "DESC";
}

/**
 * API请求日志统计信息 - 基于实际表字段
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
  redirect_count: number; // 3xx
  client_error_count: number; // 4xx
  server_error_count: number; // 5xx

  // 性能指标
  avg_response_time: number;
  p50_response_time: number;
  p90_response_time: number;
  p95_response_time: number;
  p99_response_time: number;

  // 流量指标
  total_bytes_sent: number;
  total_bytes_received: number;

  // 错误分析
  error_rate: number;

  // 服务分布
  service_name?: string;
}
