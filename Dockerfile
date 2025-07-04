FROM node:22-alpine

# 安装系统依赖
RUN apk add --no-cache wget

# 设置工作目录
WORKDIR /app

# 设置 npm 镜像
RUN npm config set registry https://registry.npmmirror.com/

# 安装 pnpm
RUN corepack enable pnpm

# 复制 package.json 和 pnpm-lock.yaml
COPY .env package.json pnpm-lock.yaml* docs/ ./

# 安装依赖
RUN pnpm install

# 复制源代码
COPY . .

# 编译TypeScript
RUN pnpm run build

# 暴露端口
EXPOSE 13000

# 启动命令
CMD ["node", "dist/index.js"] 