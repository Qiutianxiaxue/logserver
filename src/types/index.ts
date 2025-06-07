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
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
  count?: number;
  environment?: string;
  timeRange?: string;
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