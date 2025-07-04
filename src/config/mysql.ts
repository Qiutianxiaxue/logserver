import { Sequelize, QueryTypes } from "sequelize";
import { LogStatistics } from "../models/LogStatistics";
import { ApiStatistics } from "../models/ApiStatistics";

// MySQL 配置
const mysqlConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  username: process.env.MYSQL_USERNAME || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "logs",
  dialect: "mysql" as const,
  logging: false,
  // 设置时区为上海时区
  timezone: "+08:00",
  dialectOptions: {
    // MySQL驱动选项
    timezone: "+08:00",
    dateStrings: true,
    typeCast: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    freezeTableName: true,
    underscored: true,
    charset: "utf8mb4",
    collate: "utf8mb4_general_ci",
  },
};

// 创建Sequelize实例
let sequelize: Sequelize | null = null;

/**
 * 初始化MySQL连接
 */
export const initMySQL = async (): Promise<Sequelize | null> => {
  try {
    sequelize = new Sequelize(mysqlConfig);

    // 测试连接
    await sequelize.authenticate();
    console.log("✅ MySQL连接成功");

    // 初始化模型
    LogStatistics.initialize(sequelize);
    ApiStatistics.initialize(sequelize);
    console.log("✅ MySQL模型初始化成功");

    // 同步模型到数据库
    await sequelize.sync({ alter: true });
    console.log("✅ MySQL数据库表同步成功");

    return sequelize;
  } catch (error) {
    console.error("❌ MySQL连接失败:", (error as Error).message);
    console.warn("⚠️ 服务将在离线模式下启动，健康检查服务会持续尝试重连");

    sequelize = null;
    return null;
  }
};

/**
 * 尝试重新连接MySQL数据库
 */
export const reconnectMySQL = async (): Promise<boolean> => {
  try {
    if (!sequelize) {
      sequelize = new Sequelize(mysqlConfig);
    }

    await sequelize.authenticate();
    console.log("✅ MySQL重连成功");

    // 初始化模型
    LogStatistics.initialize(sequelize);
    ApiStatistics.initialize(sequelize);
    console.log("✅ MySQL模型重新初始化成功");

    // 同步模型到数据库
    await sequelize.sync({ alter: true });

    return true;
  } catch (error) {
    console.error("❌ MySQL重连失败:", (error as Error).message);
    sequelize = null;
    return false;
  }
};

/**
 * 获取Sequelize实例
 */
export const getSequelize = (): Sequelize | null => {
  return sequelize;
};

/**
 * 获取MySQL Sequelize实例的别名
 */
export const mysqlSequelize = sequelize;

/**
 * 关闭MySQL连接
 */
export const closeMySQL = async (): Promise<void> => {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
    console.log("✅ MySQL连接已关闭");
  }
};

/**
 * MySQL健康检查
 */
export const MySQLHealthCheck = {
  async ping(): Promise<{ success: boolean }> {
    if (!sequelize) {
      return { success: false };
    }

    try {
      await sequelize.authenticate();
      return { success: true };
    } catch {
      return { success: false };
    }
  },

  async healthCheck(): Promise<{
    success: boolean;
    details: {
      serverPing: boolean;
      databaseAccess: boolean;
      tableAccess: boolean;
      error?: string;
    };
  }> {
    const details = {
      serverPing: false,
      databaseAccess: false,
      tableAccess: false,
      error: undefined as string | undefined,
    };

    try {
      if (!sequelize) {
        throw new Error("MySQL连接未初始化");
      }

      // 测试服务器连接
      await sequelize.authenticate();
      details.serverPing = true;
      details.databaseAccess = true;

      // 测试表访问
      await sequelize.query("SELECT 1", { type: QueryTypes.SELECT });
      details.tableAccess = true;

      return {
        success: true,
        details,
      };
    } catch (error) {
      details.error = (error as Error).message;
      return {
        success: false,
        details,
      };
    }
  },

  isInitialized(): boolean {
    return sequelize !== null;
  },
};

export default sequelize;
