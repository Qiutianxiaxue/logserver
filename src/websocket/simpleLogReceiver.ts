import WebSocket from "ws";
import { insertLog, insertApiRequestLog } from "../config/database";
import { LogData, ApiRequestLogData } from "../types";

/**
 * 简化的日志接收器客户端
 * 基于中间服务器的消息格式进行日志接收和存储
 */
export class SimpleLogReceiver {
  private ws: WebSocket | null = null;
  private serviceId: string;
  private serviceName: string;
  private webUrl: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // 统计信息
  private stats = {
    totalReceived: 0,
    totalProcessed: 0,
    totalErrors: 0,
    lastReceivedAt: null as Date | null,
    connectedAt: null as Date | null,
  };

  constructor(
    serviceId: string = "log-receiver-001",
    serviceName: string = "ClickHouse日志服务"
  ) {
    this.serviceId = serviceId;
    this.serviceName = serviceName;
    this.webUrl = `http://localhost:${process.env.PORT || 3000}`;
  }

  /**
   * 连接到中间服务器
   */
  public connect(wsUrl: string): void {
    console.log(`📡 连接到日志中间件服务: ${wsUrl}`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      console.log("✅ WebSocket连接已建立");
      this.stats.connectedAt = new Date();
      this.sendConnectMessage();
      this.startHeartbeat();
    });

    this.ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error("❌ 解析消息失败:", error);
        this.stats.totalErrors++;
      }
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      console.log(`⚠️ WebSocket连接已关闭: ${code} - ${reason.toString()}`);
      this.stopHeartbeat();

      // 5秒后尝试重连
      setTimeout(() => {
        console.log("🔄 尝试重新连接...");
        this.connect(wsUrl);
      }, 5000);
    });

    this.ws.on("error", (error) => {
      console.error("❌ WebSocket错误:", error);
      this.stats.totalErrors++;
    });
  }

  /**
   * 发送连接消息
   */
  private sendConnectMessage(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: "connect",
        data: {
          serviceId: this.serviceId,
          serviceName: this.serviceName,
          webUrl: this.webUrl,
        },
      };
      this.ws.send(JSON.stringify(message));
      console.log(`📤 发送连接消息: ${this.serviceName}`);
    }
  }

  /**
   * 处理接收到的消息
   */
  private async handleMessage(message: any): Promise<void> {
    this.stats.totalReceived++;
    this.stats.lastReceivedAt = new Date();

    console.log(`📥 接收到消息: ${message.type}`);

    try {
      switch (message.type) {
        case "connect":
          this.handleConnectResponse(message);
          break;
        case "log_store":
          await this.handleLogStore(message);
          break;
        case "log_query":
          await this.handleLogQuery(message);
          break;
        case "heartbeat":
          // 心跳响应，不需要特殊处理
          break;
        default:
          console.log(`⚠️ 未知消息类型: ${message.type}`);
      }
    } catch (error) {
      console.error("❌ 处理消息失败:", error);
      this.stats.totalErrors++;

      // 发送错误响应
      if (message.requestId) {
        this.sendErrorResponse(message.requestId, error);
      }
    }
  }

  /**
   * 处理连接响应
   */
  private handleConnectResponse(message: any): void {
    console.log("✅ 连接确认:", message.data);
  }

  /**
   * 处理日志存储请求
   */
  private async handleLogStore(message: any): Promise<void> {
    console.log(
      `📦 处理日志存储请求，日志数量: ${message.data.logs?.length || 0}`
    );

    try {
      const logs = message.data.logs || [];
      let storedCount = 0;

      for (const log of logs) {
        try {
          // 根据日志类型判断存储方式
          if (this.isApiRequestLog(log)) {
            await insertApiRequestLog(log as ApiRequestLogData);
          } else {
            await insertLog(log as LogData);
          }
          storedCount++;
        } catch (error) {
          console.error("❌ 存储单个日志失败:", error);
          this.stats.totalErrors++;
        }
      }

      this.stats.totalProcessed += storedCount;

      // 发送成功响应
      const response = {
        type: "response",
        requestId: message.requestId,
        data: {
          success: true,
          storedCount: storedCount,
          totalLogs: logs.length,
          message: "日志存储成功",
        },
      };

      this.sendResponse(response);
      console.log(`✅ 成功存储 ${storedCount}/${logs.length} 条日志`);
    } catch (error) {
      console.error("❌ 批量存储日志失败:", error);
      this.stats.totalErrors++;

      if (message.requestId) {
        this.sendErrorResponse(message.requestId, error);
      }
    }
  }

  /**
   * 处理日志查询请求
   */
  private async handleLogQuery(message: any): Promise<void> {
    console.log("🔍 处理日志查询请求:", message.data);

    try {
      // 这里可以根据查询参数调用相应的查询函数
      // 为了简化，暂时返回固定响应
      const response = {
        type: "response",
        requestId: message.requestId,
        data: {
          success: true,
          logs: [],
          total: 0,
          message: "查询功能待实现，请使用HTTP API查询",
        },
      };

      this.sendResponse(response);
    } catch (error) {
      console.error("❌ 查询日志失败:", error);
      this.stats.totalErrors++;

      if (message.requestId) {
        this.sendErrorResponse(message.requestId, error);
      }
    }
  }

  /**
   * 判断是否为API请求日志
   */
  private isApiRequestLog(log: any): boolean {
    return !!(log.method !== undefined);
  }

  /**
   * 发送响应消息
   */
  private sendResponse(response: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    }
  }

  /**
   * 发送错误响应
   */
  private sendErrorResponse(requestId: string, error: any): void {
    const response = {
      type: "response",
      requestId: requestId,
      data: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "处理请求时发生错误",
      },
    };
    this.sendResponse(response);
  }

  /**
   * 启动心跳
   */
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

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    return {
      ...this.stats,
      connected: this.ws?.readyState === WebSocket.OPEN,
      serviceId: this.serviceId,
      serviceName: this.serviceName,
    };
  }

  /**
   * 手动发送消息
   */
  public sendMessage(message: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    console.log("🔒 正在断开WebSocket连接...");
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
  }
}
