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

### 基本接口

- `GET /` - 首页信息
- `GET /health` - 健康检查

### 日志接口

- `GET /api/logs` - 获取日志列表（支持分页和过滤）
  - 查询参数：
    - `limit` - 限制数量（默认100）
    - `offset` - 偏移量（默认0）
    - `level` - 日志级别过滤
    - `service` - 服务名过滤
    - `startTime` - 开始时间
    - `endTime` - 结束时间
    - `keyword` - 关键词搜索
- `POST /api/logs` - 提交单条日志数据
- `POST /api/logs/batch` - 批量提交日志数据
- `GET /api/logs/stats` - 获取日志统计信息
  - 查询参数：
    - `timeRange` - 时间范围（24h/7d/30d）

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
├── config/
│   └── database.js             # 原JS配置文件（已弃用）
├── index.js                    # 原JS入口文件（已弃用）
├── package.json                # 项目配置
├── tsconfig.json               # TypeScript配置
├── nodemon.json                # 热加载配置
├── .env.example                # 环境变量示例
├── .env                        # 环境变量配置（需手动创建）
├── .gitignore                  # Git忽略文件
└── README.md                   # 项目说明
```

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
curl -X POST http://localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "message": "用户登录成功",
    "service": "auth-service",
    "user_id": "user123",
    "extra_data": {"action": "login"}
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

### 查询日志
```bash
# 获取最近100条日志
curl "http://localhost:3000/api/logs?limit=100"

# 按级别过滤
curl "http://localhost:3000/api/logs?level=error"

# 按服务过滤
curl "http://localhost:3000/api/logs?service=auth-service"

# 关键词搜索
curl "http://localhost:3000/api/logs?keyword=登录"
```

### 获取统计信息
```bash
# 24小时统计
curl "http://localhost:3000/api/logs/stats?timeRange=24h"

# 7天统计
curl "http://localhost:3000/api/logs/stats?timeRange=7d"
```

## 架构说明

项目采用MVC架构模式，具有清晰的分层结构：

- **Controllers（控制器层）**: 处理HTTP请求和响应逻辑
- **Routes（路由层）**: 定义API端点和路由规则
- **Config（配置层）**: 数据库配置和连接管理
- **Types（类型层）**: TypeScript类型定义和接口

## 下一步计划

- [x] 集成ClickHouse数据库
- [x] 添加日志分类和过滤
- [x] 实现日志搜索功能
- [x] 环境变量配置支持
- [x] MVC架构重构
- [x] 支持批量日志提交
- [ ] 添加用户认证中间件
- [ ] 集成日志可视化面板
- [ ] 添加日志告警功能
- [ ] 添加API速率限制
- [ ] 单元测试覆盖
