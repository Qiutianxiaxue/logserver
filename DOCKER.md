# Docker 部署说明

## 快速开始

### 1. 构建并运行

```bash
# 创建配置文件
cp env.example .env

# 构建并启动容器（包含ClickHouse数据库）
docker-compose up -d

# 查看所有服务状态
docker-compose ps

# 查看日志
docker-compose logs -f logserver
docker-compose logs -f clickhouse

# 停止容器
docker-compose down
```

### 2. 访问服务

- API 服务: http://localhost:13000
- API 文档: http://localhost:13000/docs/swagger-ui.html
- 健康检查: http://localhost:13000/health
- ClickHouse HTTP 接口: http://localhost:8123
- ClickHouse 查询: http://localhost:8123/play

### 3. 包含的服务

- **logserver**: 日志服务 API (端口 13000)
- **clickhouse**: ClickHouse 数据库 (端口 8123, 9000)

### 4. 自动配置

启动时会自动：

- 创建 ClickHouse 数据库 `logs`
- 创建日志表 `application_logs`
- 创建 API 请求日志表 `api_request_logs`
- 配置数据保留策略（90 天 TTL）

### 5. 数据持久化

数据会自动持久化到 Docker 卷：

- `clickhouse_data`: 存储 ClickHouse 数据
- `clickhouse_logs`: 存储 ClickHouse 日志

### 6. 配置说明

#### 使用.env 文件配置

1. 复制环境变量示例文件：

```bash
cp env.example .env
```

2. 根据需要修改.env 文件：

```bash
# 基础配置
NODE_ENV=production
PORT=13000

# API配置
API_PREFIX=/api

# WebSocket配置
WS_PORT=13001

# 服务标识
SERVICE_NAME=logserver
SERVICE_VERSION=1.0.0

# 其他配置
TZ=Asia/Shanghai
```

#### ClickHouse 配置

ClickHouse 相关配置已在 docker-compose.yml 中硬编码，自动连接到内置的 ClickHouse 容器：

- CLICKHOUSE_HOST=clickhouse
- CLICKHOUSE_PORT=8123
- CLICKHOUSE_DATABASE=logs
- CLICKHOUSE_USERNAME=default
- CLICKHOUSE_PASSWORD=clickhouse_2024_secure

**安全提醒**: 生产环境中建议修改默认密码！编辑 `docker-compose.yml` 文件，将 `CLICKHOUSE_PASSWORD` 改为你自己的强密码，并确保在 `logserver` 服务中使用相同的密码。

### 7. 故障排除

如果容器启动失败，可以查看日志：

```bash
# 查看logserver日志
docker-compose logs logserver

# 查看clickhouse日志
docker-compose logs clickhouse

# 查看所有服务状态
docker-compose ps
```

如果需要重新构建镜像：

```bash
docker-compose build --no-cache
```

如果需要重置数据库：

```bash
# 停止服务并删除数据卷
docker-compose down -v
# 重新启动
docker-compose up -d
```

#### 修改 ClickHouse 密码

如果需要修改 ClickHouse 密码，请同时修改两处：

1. ClickHouse 服务的密码：

```yaml
clickhouse:
  environment:
    - CLICKHOUSE_PASSWORD=your_new_password
```

2. LogServer 服务的连接密码：

```yaml
logserver:
  environment:
    - CLICKHOUSE_PASSWORD=your_new_password
```
