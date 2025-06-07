# 日志服务器项目

基于Node.js、Express和TypeScript的日志服务器，支持热加载开发。

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
- ✅ MVC架构模式 (控制器/路由分离)
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
npm install
```

### 2. 配置环境变量

复制环境变量示例文件：
```bash
copy .env.example .env
```

根据需要修改 `.env` 文件中的配置。

### 3. 启动ClickHouse数据库

确保ClickHouse数据库服务正在运行：
- 默认地址：`http://localhost:8123`
- 默认用户：`default`
- 项目会自动创建数据库和表结构

### 4. 构建项目

```bash
npm run build
```

### 5. 开发模式运行（热加载）

```bash
npm run dev
```

### 6. 生产模式运行

```bash
npm start
```

### 其他命令

```bash
# 类型检查
npm run type-check

# 监视模式构建
npm run build:watch

# 清理构建文件
npm run clean
```

## API 接口

### 响应格式说明

所有接口统一返回格式：
```json
{
  "code": 1,           // 0: 失败, 1: 成功
  "message": "操作成功", // 操作结果说明
  "data": {}           // 返回的数据 (可选)
}
```

**注意：** 所有接口都使用 **POST** 方法，查询参数通过请求体（Request Body）传递。

### API 文档

项目提供完整的 API 文档，支持多种格式和工具：

#### 📁 文档文件
- **Swagger 3.0 规范**: `docs/api-swagger.yaml` (完整版)
- **Apifox 优化版**: `docs/api-apifox.yaml` (推荐用于Apifox导入)
- **Postman/Apifox 集合**: `docs/api-collection.json`
- **浏览器查看**: `docs/swagger-ui.html`

#### 🚀 使用方式

**Apifox 导入** (推荐方式)：
1. 打开 Apifox
2. 点击"导入" → "数据导入"
3. 选择"URL导入"或"文件导入"
4. **文件导入**: 选择 `docs/api-apifox.yaml`
5. **URL导入**: 如果你的项目在GitHub上，使用原始文件链接
6. 导入后设置环境变量 `baseUrl = http://localhost:3000`

**备选方案 - 使用 JSON 集合**：
1. 如果 YAML 导入失败，使用 `docs/api-collection.json`
2. 在 Apifox 中选择"Postman导入"
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
    - `limit` - 限制数量（默认100）
    - `offset` - 偏移量（默认0）
    - `level` - 日志级别过滤 (debug/info/warn/error)
    - `service` - 服务名过滤
    - `startTime` - 开始时间（格式: 2025-12-11 10:00:00）
    - `endTime` - 结束时间（格式: 2025-12-11 18:30:00）
    - `keyword` - 关键词搜索
- `POST /api/logs/create` - 提交单条日志数据
- `POST /api/logs/batch` - 批量提交日志数据（最多1000条）
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

- **检查间隔**: 30秒
- **自动重试**: 最多5次
- **状态监控**: 实时监控数据库连接状态
- **故障转移**: 数据库不可用时自动切换到缓存模式

### 缓存管理

- **状态查询**: 查看缓存数量、文件大小、最新/最旧缓存时间
- **手动处理**: 支持手动触发缓存日志写入数据库
- **清空缓存**: 支持手动清空缓存文件
- **备份机制**: 处理缓存前自动备份

## 开发说明

项目使用 nodemon 实现热加载，当您修改代码文件时，服务器会自动重启。

默认监听端口：`3000`

服务器地址：`http://localhost:3000`

## 环境变量

### 服务器配置
- `PORT` - 服务器端口号（默认：3000）
- `NODE_ENV` - 运行环境（development/production）
- `API_PREFIX` - API路径前缀（默认：/api）
- `LOG_LEVEL` - 日志级别（默认：combined）
- `JSON_LIMIT` - JSON请求体大小限制（默认：10mb）
- `URL_LIMIT` - URL编码请求体大小限制（默认：10mb）
- `TZ` - 服务器时区（默认：Asia/Shanghai）

### ClickHouse数据库配置
- `CLICKHOUSE_HOST` - ClickHouse服务地址（默认：http://localhost:8123）
- `CLICKHOUSE_USERNAME` - 用户名（默认：default）
- `CLICKHOUSE_PASSWORD` - 密码（默认：空）
- `CLICKHOUSE_DATABASE` - 数据库名（默认：logs）

## 数据库表结构

ClickHouse会自动创建以下日志表：

```sql
CREATE TABLE application_logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3) DEFAULT now64(),
  level String,                    -- 日志级别 (info, warn, error, debug)
  message String,                  -- 日志消息
  service String DEFAULT '',       -- 服务名称
  host String DEFAULT '',          -- 主机名
  user_id String DEFAULT '',       -- 用户ID
  session_id String DEFAULT '',    -- 会话ID
  request_id String DEFAULT '',    -- 请求ID
  ip String DEFAULT '',            -- IP地址
  user_agent String DEFAULT '',    -- 用户代理
  url String DEFAULT '',           -- 请求URL
  method String DEFAULT '',        -- HTTP方法
  status_code UInt16 DEFAULT 0,    -- HTTP状态码
  response_time UInt32 DEFAULT 0,  -- 响应时间(ms)
  error_stack String DEFAULT '',   -- 错误堆栈
  extra_data String DEFAULT '',    -- 额外数据(JSON)
  created_date Date DEFAULT today()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, level, service)
TTL timestamp + INTERVAL 90 DAY;
```

## 使用示例

### 提交单条日志
```bash
curl -X POST http://localhost:3000/api/logs/create \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "message": "用户登录成功",
    "service": "auth-service",
    "user_id": "user123",
    "extra_data": {"action": "login"}
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

### 批量提交日志
```bash
curl -X POST http://localhost:3000/api/logs/batch \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {
        "level": "info",
        "message": "用户登录",
        "service": "auth-service"
      },
      {
        "level": "error",
        "message": "登录失败",
        "service": "auth-service"
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

# 按服务过滤
curl -X POST http://localhost:3000/api/logs/query \
  -H "Content-Type: application/json" \
  -d '{"service": "auth-service", "limit": 50}'

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
        "message": "用户登录成功",
        "service": "auth-service",
        "user_id": "user123"
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
      {"level": "info", "count": 150, "service": "auth-service"},
      {"level": "error", "count": 25, "service": "auth-service"},
      {"level": "warn", "count": 45, "service": "api-service"}
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

# 手动处理缓存
curl -X POST http://localhost:3000/api/logs/cache/process \
  -H "Content-Type: application/json"

# 清空缓存
curl -X POST http://localhost:3000/api/logs/cache/clear \
  -H "Content-Type: application/json"
```

### 系统监控示例
```bash
# 获取系统健康报告
curl -X POST http://localhost:3000/api/logs/system/health \
  -H "Content-Type: application/json"
```

## 架构说明

项目采用MVC架构模式，具有清晰的分层结构：

- **Controllers（控制器层）**: 处理HTTP请求和响应逻辑
- **Routes（路由层）**: 定义API端点和路由规则
- **Middleware（中间件层）**: 请求预处理和验证逻辑
- **Utils（工具层）**: 公共工具类和辅助函数
- **Config（配置层）**: 数据库配置和连接管理
- **Types（类型层）**: TypeScript类型定义和接口

## 下一步计划

- [x] 集成ClickHouse数据库
- [x] 添加日志分类和过滤
- [x] 实现日志搜索功能
- [x] 环境变量配置支持
- [x] MVC架构重构
- [x] 支持批量日志提交
- [x] Day.js时间处理集成
- [x] 时间验证中间件
- [x] 本地日志缓存机制
- [x] 数据库健康检查和自动恢复
- [x] 统一API规范 (POST方法 + 标准响应格式)
- [x] Swagger 3.0 API文档生成
- [x] Apifox/Postman 接口集合
- [ ] 添加用户认证中间件
- [ ] 集成日志可视化面板
- [ ] 添加日志告警功能
- [ ] 添加API速率限制
- [ ] 单元测试覆盖
