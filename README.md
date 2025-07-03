# 日志服务器项目

基于 Node.js、Express 和 TypeScript 的日志服务器，支持热加载开发。

## 功能特性

- ✅ TypeScript 类型安全支持
- ✅ Express.js 服务器框架
- ✅ 热加载开发支持 (nodemon + ts-node)
- ✅ CORS 跨域支持
- ✅ 安全头部配置 (helmet)
- ✅ HTTP 请求日志记录 (morgan)
- ✅ JSON 数据解析
- ✅ 错误处理中间件
- ✅ 健康检查接口
- ✅ ClickHouse 数据库集成
- ✅ 环境变量配置支持 (dotenv)
- ✅ 日志存储和查询功能
- ✅ 日志统计分析接口
- ✅ 完整的类型定义
- ✅ MVC 架构模式 (控制器/路由分离)
- ✅ 批量日志提交支持
- ✅ Day.js 时间处理库集成
- ✅ 时间验证中间件
- ✅ 多时区支持
- ✅ 本地日志缓存机制
- ✅ 数据库健康检查和自动恢复
- ✅ 数据库断线时本地缓存保障

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制环境变量示例文件：

```bash
copy .env.example .env
```

根据需要修改 `.env` 文件中的配置。

### 3. 启动 ClickHouse 数据库

确保 ClickHouse 数据库服务正在运行：

- 默认地址：`http://localhost:8123`
- 默认用户：`default`
- 项目会自动创建数据库和表结构

### 4. 构建项目

```bash
pnpm build
```

### 5. 开发模式运行（热加载）

```bash
pnpm dev
```

### 6. 生产模式运行

```bash
pnpm start
```

### 其他命令

```bash
# 类型检查
pnpm type-check

# 监视模式构建
pnpm build:watch

# 清理构建文件
pnpm clean
```

## API 接口

### 响应格式说明

所有接口统一返回格式：

```json
{
  "code": 1, // 0: 失败, 1: 成功
  "message": "操作成功", // 操作结果说明
  "data": {} // 返回的数据 (可选)
}
```

**注意：** 所有接口都使用 **POST** 方法，查询参数通过请求体（Request Body）传递。

### API 文档

项目提供完整的 API 文档，支持多种格式和工具：

#### 📁 文档文件

- **Swagger 3.0 规范**: `docs/api-swagger.yaml` (完整版)
- **Apifox 优化版**: `docs/api-apifox.yaml` (推荐用于 Apifox 导入)
- **Postman/Apifox 集合**: `docs/api-collection.json`
- **浏览器查看**: `docs/swagger-ui.html`

#### 🚀 使用方式

**Apifox 导入** (推荐方式)：

1. 打开 Apifox
2. 点击"导入" → "数据导入"
3. 选择"URL 导入"或"文件导入"
4. **文件导入**: 选择 `docs/api-apifox.yaml`
5. **URL 导入**: 如果你的项目在 GitHub 上，使用原始文件链接
6. 导入后设置环境变量 `baseUrl = http://localhost:3000`

**备选方案 - 使用 JSON 集合**：

1. 如果 YAML 导入失败，使用 `docs/api-collection.json`
2. 在 Apifox 中选择"Postman 导入"
3. 选择 `docs/api-collection.json` 文件

**Postman 导入**：

1. 打开 Postman
2. 点击"Import" → "File"
3. 选择 `docs/api-collection.json` 文件导入
4. 自动配置环境变量和示例请求

**在线查看**：

1. 使用浏览器打开 `docs/swagger-ui.html`
2. 或访问 [Swagger Editor](https://editor.swagger.io/) 导入 YAML 文件

### 基本接口

- `POST /` - 首页信息
- `POST /health` - 健康检查

### 日志接口

- `POST /api/logs/query` - 查询日志列表（支持分页和过滤）
  - 请求体参数：
    - `limit` - 限制数量（默认 100）
    - `offset` - 偏移量（默认 0）
    - `level` - 日志级别过滤 (debug/info/warn/error)
    - `service` - 服务名过滤
    - `startTime` - 开始时间（格式: 2025-12-11 10:00:00）
    - `endTime` - 结束时间（格式: 2025-12-11 18:30:00）
    - `keyword` - 关键词搜索
- `POST /api/logs/create` - 提交单条日志数据
- `POST /api/logs/batch` - 批量提交日志数据（最多 1000 条）
- `POST /api/logs/stats` - 获取日志统计信息
  - 请求体参数：
    - `timeRange` - 时间范围（1h/24h/7d/30d/90d）

### 缓存管理接口

- `POST /api/logs/cache/status` - 获取缓存状态信息
- `POST /api/logs/cache/process` - 手动触发缓存处理
- `POST /api/logs/cache/clear` - 清空缓存

### 系统监控接口

- `POST /api/logs/system/health` - 获取详细的系统健康报告

## 项目结构

```bash
logserver/
├── src/                        # TypeScript源代码
│   ├── controllers/            # 控制器目录
│   │   ├── healthController.ts # 健康检查控制器
│   │   └── logController.ts    # 日志管理控制器
│   ├── routes/                 # 路由目录
│   │   ├── index.ts            # 主路由入口
│   │   ├── healthRoutes.ts     # 健康检查路由
│   │   └── logRoutes.ts        # 日志相关路由
│   ├── middleware/             # 中间件目录
│   │   └── timeValidation.ts   # 时间验证中间件
│   ├── utils/                  # 工具类目录
│   │   └── datetime.ts         # Day.js时间工具类
│   ├── config/
│   │   └── database.ts         # ClickHouse数据库配置
│   ├── types/
│   │   ├── index.ts            # 通用类型定义
│   │   └── controller.ts       # 控制器类型定义
│   └── index.ts                # 主入口文件
├── dist/                       # 编译后的JavaScript代码
├── docs/                       # API文档目录
│   ├── api-swagger.yaml        # Swagger 3.0 规范文档
│   ├── api-collection.json     # Postman/Apifox 接口集合
│   └── swagger-ui.html         # 浏览器查看文档
├── package.json                # 项目配置
├── tsconfig.json               # TypeScript配置
├── nodemon.json                # 热加载配置
├── .env.example                # 环境变量示例
├── .env                        # 环境变量配置（需手动创建）
├── .gitignore                  # Git忽略文件
└── README.md                   # 项目说明
```

## 缓存机制说明

### 本地日志缓存

当数据库连接不可用时，系统会自动将日志缓存到本地文件：

- **缓存位置**: `./cache/logs_cache.json`
- **最大缓存**: 10,000 条日志记录
- **最大文件大小**: 50MB
- **自动恢复**: 数据库恢复后自动写入缓存的日志

### 数据库健康检查

- **检查间隔**: 30 秒
- **自动重试**: 最多 5 次
- **状态监控**: 实时监控数据库连接状态
- **故障转移**: 数据库不可用时自动切换到缓存模式

### 智能缓存处理

系统支持多种方式自动处理缓存日志，确保数据不丢失：

- **定期自动处理**: 健康检查每 30 秒检查一次，发现缓存时自动处理
- **状态恢复处理**: 数据库从不健康变为健康时立即处理缓存
- **写入触发处理**: 每次成功写入日志后检查并处理缓存
- **后台异步处理**: 缓存处理在后台进行，不影响当前请求响应
- **错误重试机制**: 处理失败的日志会保留在缓存中，等待下次处理

### 缓存管理

- **状态查询**: 查看缓存数量、文件大小、最新/最旧缓存时间
- **自动处理**: 系统自动检测并处理缓存，无需人工干预
- **手动处理**: 支持手动触发缓存日志写入数据库
- **清空缓存**: 支持手动清空缓存文件
- **备份机制**: 处理缓存前自动备份
- **批量优化**: 每次最多处理 100 条，避免内存占用过大

## 开发说明

项目使用 nodemon 实现热加载，当您修改代码文件时，服务器会自动重启。

默认监听端口：`3000`

服务器地址：`http://localhost:3000`

## 环境变量

### 服务器配置

- `PORT` - 服务器端口号（默认：3000）
- `NODE_ENV` - 运行环境（development/production）
- `API_PREFIX` - API 路径前缀（默认：/api）
- `LOG_LEVEL` - 日志级别（默认：combined）
- `JSON_LIMIT` - JSON 请求体大小限制（默认：10mb）
- `URL_LIMIT` - URL 编码请求体大小限制（默认：10mb）
- `TZ` - 服务器时区（默认：Asia/Shanghai）

### ClickHouse 数据库配置

- `CLICKHOUSE_HOST` - ClickHouse 服务地址（默认：http://localhost:8123）
- `CLICKHOUSE_USERNAME` - 用户名（默认：default）
- `CLICKHOUSE_PASSWORD` - 密码（默认：空）
- `CLICKHOUSE_DATABASE` - 数据库名（默认：logs）

## 数据库表结构

ClickHouse 会自动创建以下日志表：

```sql
CREATE TABLE application_logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3) DEFAULT now64(),
  level String,                    -- 日志级别 (info, warn, error, debug)
  log_type String DEFAULT 'application', -- 日志类型 (任意自定义字符串)
  message String,                  -- 日志消息
  service String DEFAULT '',       -- 服务名称
  service_name String DEFAULT '',  -- 服务实例名称
  service_ip String DEFAULT '',    -- 服务IP地址
  appid String DEFAULT '',         -- 应用ID
  enterprise_id String DEFAULT '', -- 企业ID
  user_id String DEFAULT '',       -- 用户ID
  extra_data String DEFAULT '',    -- 额外数据(JSON)
  created_date Date DEFAULT today()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, level, service)
TTL timestamp + INTERVAL 90 DAY;
```

## 日志类型说明

`log_type` 字段是一个**自定义字符串**，使用者可以根据自己的需求灵活定义，主要用于日志分类和筛选。

### 特点

- 🔧 **完全自定义**：可以使用任意字符串作为日志类型
- 🎯 **便于筛选**：支持按日志类型精确查询和过滤
- 📊 **分类管理**：帮助更好地组织和管理不同类型的日志

### 常见使用场景

| 日志类型示例       | 说明         | 使用场景             |
| ------------------ | ------------ | -------------------- |
| `user_login`       | 用户登录日志 | 记录用户登录行为     |
| `payment_success`  | 支付成功日志 | 记录支付完成事件     |
| `api_error`        | API 错误日志 | 记录接口调用错误     |
| `data_backup`      | 数据备份日志 | 记录数据备份操作     |
| `security_alert`   | 安全警告日志 | 记录安全相关告警     |
| `performance_slow` | 性能问题日志 | 记录慢查询或性能问题 |

默认日志类型为 `application`，但您可以根据业务需求自定义任何有意义的字符串。

### 💡 使用建议

- 使用有意义的命名：如 `user_login`、`payment_error`、`data_sync` 等
- 保持命名一致性：建议使用下划线分隔的小写字母格式
- 考虑分层结构：如 `auth_login_success`、`auth_login_failed` 等
- 避免过于复杂：保持简洁明了，便于查询和理解

## 使用示例

### 提交单条日志

```bash
curl -X POST http://localhost:3000/api/logs/create \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "log_type": "user_login",
    "message": "用户登录成功",
    "service": "auth-service",
    "service_name": "auth-service-01",
    "service_ip": "192.168.1.100",
    "appid": "app_123456",
    "enterprise_id": "ent_789012",
    "user_id": "user123",
    "extra_data": {"action": "login", "duration": 1200}
  }'
```

**响应示例：**

```json
{
  "code": 1,
  "message": "日志已成功存储",
  "data": {
    "timestamp": "2025-12-11 14:30:25"
  }
}
```

### 自定义日志类型示例

#### 支付成功日志

```bash
curl -X POST http://localhost:3000/api/logs/create \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "log_type": "payment_success",
    "message": "用户支付成功",
    "service": "payment-service",
    "user_id": "user123",
    "extra_data": {
      "order_id": "ORD-20251211-001",
      "amount": 99.99,
      "payment_method": "alipay"
    }
  }'
```

#### API 错误日志

```bash
curl -X POST http://localhost:3000/api/logs/create \
  -H "Content-Type: application/json" \
  -d '{
    "level": "error",
    "log_type": "api_timeout_error",
    "message": "第三方API调用超时",
    "service": "external-api-service",
    "extra_data": {
      "api_url": "https://api.example.com/data",
      "timeout_ms": 5000,
      "retry_count": 3
    }
  }'
```

#### 用户行为追踪日志

```bash
curl -X POST http://localhost:3000/api/logs/create \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "log_type": "user_behavior_tracking",
    "message": "用户浏览商品页面",
    "service": "web-frontend",
    "user_id": "user456",
    "extra_data": {
      "product_id": "PROD-001",
      "page_url": "/product/001",
      "stay_duration": 45
    }
  }'
```

### 批量提交日志

```bash
curl -X POST http://localhost:3000/api/logs/batch \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {
        "level": "info",
        "log_type": "user_session_start",
        "message": "用户开始会话",
        "service": "auth-service",
        "service_name": "auth-service-01",
        "appid": "app_123456",
        "enterprise_id": "ent_789012",
        "user_id": "user123"
      },
      {
        "level": "error",
        "log_type": "auth_failed",
        "message": "用户认证失败",
        "service": "auth-service",
        "service_name": "auth-service-01",
        "appid": "app_123456",
        "enterprise_id": "ent_789012",
        "user_id": "user456"
      }
    ]
  }'
```

**响应示例：**

```json
{
  "code": 1,
  "message": "批量日志已成功存储",
  "data": {
    "count": 2,
    "timestamp": "2025-12-11 14:30:25"
  }
}
```

### 查询日志

```bash
# 获取最近100条日志
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# 按级别过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"level": "error", "limit": 50}'

# 按日志类型过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"log_type": "payment_success", "limit": 50}'

# 按级别和类型过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"level": "error", "log_type": "api_timeout_error", "limit": 50}'

# 查询用户行为追踪日志
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"log_type": "user_behavior_tracking", "user_id": "user456", "limit": 100}'

# 按服务过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"service": "auth-service", "limit": 50}'

# 按服务实例名称过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"service_name": "auth-service-01", "limit": 50}'

# 按应用ID和企业ID过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"appid": "app_123456", "enterprise_id": "ent_789012", "limit": 50}'

# 按用户ID过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123", "limit": 50}'

# 关键词搜索
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"keyword": "登录", "limit": 20}'

# 时间范围查询
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2025-12-11 10:00:00",
    "endTime": "2025-12-11 18:00:00",
    "limit": 100
  }'
```

**响应示例：**

```json
{
  "code": 1,
  "message": "查询成功",
  "data": {
    "logs": [
      {
        "id": "uuid-123",
        "timestamp": "2025-12-11 14:30:25",
        "level": "info",
        "log_type": "user_login",
        "message": "用户登录成功",
        "service": "auth-service",
        "service_name": "auth-service-01",
        "service_ip": "192.168.1.100",
        "appid": "app_123456",
        "enterprise_id": "ent_789012",
        "user_id": "user123",
        "extra_data": { "action": "login", "duration": 1200 }
      }
    ],
    "count": 1,
    "timestamp": "2025-12-11 14:30:25"
  }
}
```

### 获取统计信息

```bash
# 1小时统计
curl -X POST http://localhost:3000/api/logs/stats \
  -H "Content-Type: application/json" \
  -d '{"timeRange": "1h"}'

# 24小时统计
curl -X POST http://localhost:3000/api/logs/stats \
  -H "Content-Type: application/json" \
  -d '{"timeRange": "24h"}'

# 7天统计
curl -X POST http://localhost:3000/api/logs/stats \
  -H "Content-Type: application/json" \
  -d '{"timeRange": "7d"}'
```

**响应示例：**

```json
{
  "code": 1,
  "message": "统计信息获取成功",
  "data": {
    "stats": [
      { "level": "info", "count": 150, "service": "auth-service" },
      { "level": "error", "count": 25, "service": "auth-service" },
      { "level": "warn", "count": 45, "service": "api-service" }
    ],
    "timeRange": "24h",
    "timestamp": "2025-12-11 14:30:25"
  }
}
```

### 缓存管理示例

```bash
# 获取缓存状态
curl -X POST http://localhost:3000/api/logs/cache/status \
  -H "Content-Type: application/json"

# 手动处理缓存（强制检查数据库并处理缓存）
curl -X POST http://localhost:3000/api/logs/cache/process \
  -H "Content-Type: application/json"

# 清空缓存
curl -X POST http://localhost:3000/api/logs/cache/clear \
  -H "Content-Type: application/json"
```

**缓存状态响应示例：**

```json
{
  "code": 1,
  "message": "缓存状态查询成功",
  "data": {
    "cache": {
      "count": 156,
      "oldestCacheTime": "2025-12-11 10:15:30",
      "newestCacheTime": "2025-12-11 14:28:45",
      "fileSizeBytes": 2048576,
      "fileSizeMB": "1.95"
    },
    "database": {
      "isHealthy": true,
      "lastCheckTime": "2025-12-11 14:30:20",
      "retryCount": 0,
      "maxRetries": 5
    },
    "timestamp": "2025-12-11 14:30:25"
  }
}
```

**缓存处理响应示例：**

```json
{
  "code": 1,
  "message": "处理完成: 成功 150 条, 失败 0 条",
  "data": {
    "processed": 150,
    "failed": 0,
    "errors": [],
    "timestamp": "2025-12-11 14:30:25"
  }
}
```

> **注意**: 系统会自动处理缓存，通常不需要手动干预。手动处理接口主要用于：
>
> - 立即处理缓存而不等待定期检查
> - 故障排查和运维管理
> - 系统集成和监控

### 系统监控示例

```bash
# 获取系统健康报告
curl -X POST http://localhost:3000/api/logs/system/health \
  -H "Content-Type: application/json"
```

## 架构说明

项目采用 MVC 架构模式，具有清晰的分层结构：

- **Controllers（控制器层）**: 处理 HTTP 请求和响应逻辑
- **Routes（路由层）**: 定义 API 端点和路由规则
- **Middleware（中间件层）**: 请求预处理和验证逻辑
- **Utils（工具层）**: 公共工具类和辅助函数
- **Config（配置层）**: 数据库配置和连接管理
- **Types（类型层）**: TypeScript 类型定义和接口

## 下一步计划

- [x] 集成 ClickHouse 数据库
- [x] 添加日志分类和过滤
- [x] 实现日志搜索功能
- [x] 环境变量配置支持
- [x] MVC 架构重构
- [x] 支持批量日志提交
- [x] Day.js 时间处理集成
- [x] 时间验证中间件
- [x] 本地日志缓存机制
- [x] 数据库健康检查和自动恢复
- [x] 统一 API 规范 (POST 方法 + 标准响应格式)
- [x] Swagger 3.0 API 文档生成
- [x] Apifox/Postman 接口集合
- [ ] 添加用户认证中间件
- [ ] 集成日志可视化面板
- [ ] 添加日志告警功能
- [ ] 添加 API 速率限制
- [ ] 单元测试覆盖
