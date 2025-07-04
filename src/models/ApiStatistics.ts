import { DataTypes, Model, Sequelize } from "sequelize";

/**
 * API请求统计数据类型枚举
 */
export enum ApiStatType {
  HOUR = "hour",
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
}

/**
 * API请求统计模型接口
 */
export interface ApiStatisticsAttributes {
  qc_api_statistics_id: string; // 主键
  stat_time: string; // 统计时间：小时=2025070415, 天=20250704, 月=202507, 周=2025W30
  stat_type: ApiStatType; // 统计类型
  stat_date: string; // 统计日期 (YYYY-MM-DD)

  // 统计维度字段
  method: string; // HTTP方法
  host: string; // 主机名
  path: string; // URL路径
  appid: string; // 应用ID
  enterprise_id: string; // 企业ID
  status_code: number; // HTTP状态码

  // 统计指标
  request_count: number; // 请求总数
  unique_users: number; // 独立用户数
  unique_ips: number; // 独立IP数
  avg_response_time: number; // 平均响应时间(ms)
  p95_response_time: number; // 95%响应时间(ms)
  total_bytes_sent: number; // 发送字节数
  total_bytes_received: number; // 接收字节数
  error_count: number; // 错误数量 (4xx + 5xx)
  error_rate: number; // 错误率 (%)

  // 时间戳
  create_time: Date;
  update_time: Date;
}

export interface ApiStatisticsCreationAttributes
  extends Omit<
    ApiStatisticsAttributes,
    "qc_api_statistics_id" | "create_time" | "update_time"
  > {}

/**
 * API请求统计模型类
 */
export class ApiStatistics
  extends Model<ApiStatisticsAttributes, ApiStatisticsCreationAttributes>
  implements ApiStatisticsAttributes
{
  public qc_api_statistics_id!: string;
  public stat_time!: string; // 改为字符串类型
  public stat_type!: ApiStatType;
  public stat_date!: string;

  // 统计维度
  public method!: string;
  public host!: string;
  public path!: string;
  public appid!: string;
  public enterprise_id!: string;
  public status_code!: number;

  // 统计指标
  public request_count!: number;
  public unique_users!: number;
  public unique_ips!: number;
  public avg_response_time!: number;
  public p95_response_time!: number;
  public total_bytes_sent!: number;
  public total_bytes_received!: number;
  public error_count!: number;
  public error_rate!: number;

  // 时间戳
  public create_time!: Date;
  public update_time!: Date;

  /**
   * 初始化模型
   */
  public static initialize(sequelize: Sequelize): typeof ApiStatistics {
    ApiStatistics.init(
      {
        qc_api_statistics_id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          comment: "API统计记录主键",
        },
        stat_time: {
          type: DataTypes.STRING(20), // 改为字符串类型，长度20足够存储各种格式
          allowNull: false,
          comment:
            "统计时间：小时=2025070415, 天=20250704, 月=202507, 周=2025W30",
        },
        stat_type: {
          type: DataTypes.ENUM(...Object.values(ApiStatType)),
          allowNull: false,
          comment: "统计类型 (hour, day, week, month)",
        },
        stat_date: {
          type: DataTypes.STRING(10),
          allowNull: false,
          comment: "统计日期 (YYYY-MM-DD)",
        },

        // 统计维度字段
        method: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "",
          comment: "HTTP方法",
        },
        host: {
          type: DataTypes.STRING(100),
          allowNull: false,
          defaultValue: "",
          comment: "主机名",
        },
        path: {
          type: DataTypes.STRING(200),
          allowNull: false,
          defaultValue: "",
          comment: "URL路径",
        },
        appid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: "",
          comment: "应用ID",
        },
        enterprise_id: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: "",
          comment: "企业ID",
        },
        status_code: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "HTTP状态码",
        },

        // 统计指标
        request_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "请求总数",
        },
        unique_users: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "独立用户数",
        },
        unique_ips: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "独立IP数",
        },
        avg_response_time: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
          comment: "平均响应时间(ms)",
        },
        p95_response_time: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
          comment: "95%响应时间(ms)",
        },
        total_bytes_sent: {
          type: DataTypes.BIGINT,
          allowNull: false,
          defaultValue: 0,
          comment: "发送字节数",
        },
        total_bytes_received: {
          type: DataTypes.BIGINT,
          allowNull: false,
          defaultValue: 0,
          comment: "接收字节数",
        },
        error_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "错误数量",
        },
        error_rate: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 0,
          comment: "错误率(%)",
        },

        // 时间戳
        create_time: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          comment: "创建时间",
        },
        update_time: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          comment: "更新时间",
        },
      },
      {
        sequelize,
        modelName: "ApiStatistics",
        tableName: "qc_api_statistics",
        timestamps: true, // 启用时间戳功能以支持时区设置
        createdAt: "create_time", // 映射到自定义字段名
        updatedAt: "update_time", // 映射到自定义字段名
        comment: "API请求统计表",
        indexes: [
          {
            name: "idx_api_stat_time_type",
            fields: ["stat_time", "stat_type"],
          },
          {
            name: "idx_api_stat_date_type",
            fields: ["stat_date", "stat_type"],
          },
          {
            name: "idx_api_method_host",
            fields: ["method", "host"],
          },
          {
            name: "idx_api_path",
            fields: ["path"],
          },
          {
            name: "idx_api_appid_enterprise",
            fields: ["appid", "enterprise_id"],
          },
          {
            name: "idx_api_status_code",
            fields: ["status_code"],
          },
          {
            // 基础唯一约束：时间 + 类型 + 业务维度
            name: "uk_api_stat_base",
            fields: [
              "stat_time",
              "stat_type",
              "appid",
              "enterprise_id",
              "method",
              "status_code",
            ],
            unique: true,
          },
          {
            // 路径相关的复合索引
            name: "idx_api_path_detail",
            fields: ["stat_time", "stat_type", "host", "path"],
          },
        ],
      }
    );

    return ApiStatistics;
  }
}

export default ApiStatistics;
