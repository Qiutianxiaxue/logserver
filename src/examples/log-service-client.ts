import WebSocket from "ws";

// 示例日志服务客户端
class LogServiceClient {
  private ws: WebSocket | null = null;
  private serviceId: string;
  private serviceName: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(serviceId: string, serviceName: string) {
    this.serviceId = serviceId;
    this.serviceName = serviceName;
  }

  public connect(wsUrl: string): void {
    console.log(`连接到日志中间件服务: ${wsUrl}`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      console.log("WebSocket连接已建立");
      this.sendConnectMessage();
      this.startHeartbeat();
    });

    this.ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error("解析消息失败:", error);
      }
    });

    this.ws.on("close", () => {
      console.log("WebSocket连接已关闭");
      this.stopHeartbeat();
    });

    this.ws.on("error", (error) => {
      console.error("WebSocket错误:", error);
    });
  }

  private sendConnectMessage(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: "connect",
        data: {
          serviceId: this.serviceId,
          serviceName: this.serviceName,
          webUrl: "http://localhost:13000",
        },
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: any): void {
    console.log("接收到消息:", message.type);

    switch (message.type) {
      case "connect":
        console.log("连接确认:", message.data);
        break;
      case "log_store":
        this.handleLogStore(message);
        break;
      case "log_query":
        this.handleLogQuery(message);
        break;
      case "heartbeat":
        // 心跳响应，不需要特殊处理
        break;
      default:
        console.log("未知消息类型:", message.type);
    }
  }

  private handleLogStore(message: any): void {
    console.log("处理日志存储请求:", message.data);

    // 模拟日志存储处理
    setTimeout(() => {
      const response = {
        type: "response",
        requestId: message.requestId,
        data: {
          success: true,
          storedCount: message.data.logs?.length || 0,
          message: "日志存储成功",
        },
      };

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(response));
      }
    }, 100); // 模拟处理延迟
  }

  private handleLogQuery(message: any): void {
    console.log("处理日志查询请求:", message.data);

    // 模拟日志查询处理
    setTimeout(() => {
      const mockLogs = [
        {
          id: "1",
          timestamp: Date.now() - 3600000,
          level: "info",
          message: "用户登录成功",
          source: "auth-service",
          metadata: { userId: "12345" },
        },
        {
          id: "2",
          timestamp: Date.now() - 1800000,
          level: "error",
          message: "数据库连接失败",
          source: "db-service",
          metadata: { error: "Connection timeout" },
        },
      ];

      const response = {
        type: "response",
        requestId: message.requestId,
        data: {
          success: true,
          logs: mockLogs,
          total: mockLogs.length,
          message: "日志查询成功",
        },
      };

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(response));
      }
    }, 200); // 模拟查询延迟
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          type: "heartbeat",
          data: { timestamp: Date.now() },
        };
        this.ws.send(JSON.stringify(heartbeat));
      }
    }, 15000); // 每15秒发送心跳
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用示例
if (require.main === module) {
  const serviceId = process.env.SERVICE_ID || "log-service-001";
  const serviceName = process.env.SERVICE_NAME || "示例日志服务";
  const wsUrl = process.env.WS_URL || "ws://localhost:13001";

  const client = new LogServiceClient(serviceId, serviceName);
  client.connect(wsUrl);

  // 优雅退出
  process.on("SIGINT", () => {
    console.log("\n正在断开连接...");
    client.disconnect();
    process.exit(0);
  });
}

export default LogServiceClient;
