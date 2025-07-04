import { DataTypes, Model, Optional, Sequelize } from "sequelize";

// 统计类型枚举
export enum StatType {
  HOUR = "hour",
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
}

// 定义统计表属性
export interface LogStatisticsAttributes {
  qc_log_statistics_id: number;
  stat_time: string;
  stat_type: StatType;
  log_type: string;
  service: string;
  level: string;
  appid: string;
  enterprise_id: string;
  count: number;
  create_time: Date;
  update_time: Date;
}

// 定义创建时可选的属性
export interface LogStatisticsCreationAttributes
  extends Optional<
    LogStatisticsAttributes,
    "qc_log_statistics_id" | "create_time" | "update_time"
  > {}

// 定义模型类
export class LogStatistics
  extends Model<LogStatisticsAttributes, LogStatisticsCreationAttributes>
  implements LogStatisticsAttributes
{
  public qc_log_statistics_id!: number;
  public stat_time!: string;
  public stat_type!: StatType;
  public log_type!: string;
  public service!: string;
  public level!: string;
  public appid!: string;
  public enterprise_id!: string;
  public count!: number;
  public create_time!: Date;
  public update_time!: Date;

  /**
   * 初始化模型
   */
  public static initialize(sequelize: Sequelize): typeof LogStatistics {
    LogStatistics.init(
      {
        qc_log_statistics_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          comment: "日志统计记录主键",
        },
        stat_time: {
          type: DataTypes.STRING(20),
          allowNull: false,
          comment:
            "统计时间点：小时=2025070415, 天=20250704, 月=202507, 周=2025W30",
        },
        stat_type: {
          type: DataTypes.ENUM(...Object.values(StatType)),
          allowNull: false,
          comment: "统计类型：hour/day/week/month",
        },
        log_type: {
          type: DataTypes.STRING(30),
          allowNull: false,
          defaultValue: "",
          comment: "日志类型",
        },
        service: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: "",
          comment: "服务名",
        },
        level: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "",
          comment: "日志级别",
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
        count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "统计数量",
        },
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
        modelName: "LogStatistics",
        tableName: "qc_log_statistics",
        timestamps: true,
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "日志统计表",
        indexes: [
          {
            fields: ["stat_time", "stat_type"],
            name: "idx_stat_time_type",
          },
          {
            fields: ["stat_type"],
            name: "idx_stat_type",
          },
          {
            fields: ["enterprise_id"],
            name: "idx_enterprise_id",
          },
          {
            fields: ["appid"],
            name: "idx_appid",
          },
          {
            fields: ["service"],
            name: "idx_service",
          },
          {
            fields: ["level"],
            name: "idx_level",
          },
          {
            fields: ["log_type"],
            name: "idx_log_type",
          },
          {
            unique: true,
            fields: [
              "stat_time",
              "stat_type",
              "log_type",
              "service",
              "level",
              "enterprise_id",
              "appid",
            ],
            name: "unique_stat_base",
          },
          {
            fields: ["stat_time", "stat_type", "log_type", "service", "level"],
            name: "idx_stat_detail",
          },
        ],
        hooks: {
          beforeUpdate: (instance: LogStatistics) => {
            instance.update_time = new Date();
          },
        },
      }
    );

    return LogStatistics;
  }
}

export default LogStatistics;
