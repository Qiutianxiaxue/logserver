import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// 注册dayjs插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

// 设置默认时区（可以通过环境变量配置）
const DEFAULT_TIMEZONE = process.env.TZ || 'Asia/Shanghai';
dayjs.tz.setDefault(DEFAULT_TIMEZONE);

/**
 * 时间工具类
 */
export class DateTime {
  /**
   * 获取当前时间的ISO字符串
   */
  static now(): string {
    return dayjs().toISOString();
  }

  /**
   * 获取当前UTC时间的ISO字符串
   */
  static utcNow(): string {
    return dayjs.utc().toISOString();
  }

  /**
   * 获取当前时间戳（毫秒）
   */
  static timestamp(): number {
    return dayjs().valueOf();
  }

  /**
   * 获取当前Unix时间戳（秒）
   */
  static unixTimestamp(): number {
    return dayjs().unix();
  }

  /**
   * 格式化时间
   */
  static format(date?: dayjs.ConfigType, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    return dayjs(date).format(format);
  }

  /**
   * 格式化为ISO字符串
   */
  static toISOString(date?: dayjs.ConfigType): string {
    return dayjs(date).toISOString();
  }

  /**
   * 转换为指定时区
   */
  static toTimezone(date?: dayjs.ConfigType, timezone: string = DEFAULT_TIMEZONE): string {
    return dayjs(date).tz(timezone).format();
  }

  /**
   * 解析时间字符串
   */
  static parse(dateString: string, format?: string): dayjs.Dayjs {
    if (format) {
      return dayjs(dateString, format);
    }
    return dayjs(dateString);
  }

  /**
   * 时间加法
   */
  static add(date: dayjs.ConfigType, amount: number, unit: dayjs.ManipulateType): string {
    return dayjs(date).add(amount, unit).toISOString();
  }

  /**
   * 时间减法
   */
  static subtract(date: dayjs.ConfigType, amount: number, unit: dayjs.ManipulateType): string {
    return dayjs(date).subtract(amount, unit).toISOString();
  }

  /**
   * 获取相对时间描述
   */
  static fromNow(date: dayjs.ConfigType): string {
    return dayjs(date).fromNow();
  }

  /**
   * 计算时间差（毫秒）
   */
  static diff(date1: dayjs.ConfigType, date2: dayjs.ConfigType): number {
    return dayjs(date1).diff(dayjs(date2));
  }

  /**
   * 计算时间差（指定单位）
   */
  static diffIn(date1: dayjs.ConfigType, date2: dayjs.ConfigType, unit: dayjs.QUnitType): number {
    return dayjs(date1).diff(dayjs(date2), unit);
  }

  /**
   * 判断是否是今天
   */
  static isToday(date: dayjs.ConfigType): boolean {
    return dayjs(date).isToday();
  }

  /**
   * 判断时间是否在指定范围内
   */
  static isBetween(date: dayjs.ConfigType, startDate: dayjs.ConfigType, endDate: dayjs.ConfigType): boolean {
    const target = dayjs(date);
    return target.isSameOrAfter(dayjs(startDate)) && target.isSameOrBefore(dayjs(endDate));
  }

  /**
   * 获取时间范围的开始和结束时间
   */
  static getTimeRange(range: '1h' | '24h' | '7d' | '30d' | '90d'): { start: string; end: string } {
    const now = dayjs();
    let start: dayjs.Dayjs;

    switch (range) {
      case '1h':
        start = now.subtract(1, 'hour');
        break;
      case '24h':
        start = now.subtract(1, 'day');
        break;
      case '7d':
        start = now.subtract(7, 'days');
        break;
      case '30d':
        start = now.subtract(30, 'days');
        break;
      case '90d':
        start = now.subtract(90, 'days');
        break;
      default:
        start = now.subtract(1, 'day');
    }

    return {
      start: start.toISOString(),
      end: now.toISOString()
    };
  }

  /**
   * 获取今天的开始和结束时间
   */
  static getToday(): { start: string; end: string } {
    const today = dayjs();
    return {
      start: today.startOf('day').toISOString(),
      end: today.endOf('day').toISOString()
    };
  }

  /**
   * 获取本周的开始和结束时间
   */
  static getThisWeek(): { start: string; end: string } {
    const now = dayjs();
    return {
      start: now.startOf('week').toISOString(),
      end: now.endOf('week').toISOString()
    };
  }

  /**
   * 获取本月的开始和结束时间
   */
  static getThisMonth(): { start: string; end: string } {
    const now = dayjs();
    return {
      start: now.startOf('month').toISOString(),
      end: now.endOf('month').toISOString()
    };
  }

  /**
   * 验证时间字符串格式
   */
  static isValid(dateString: string, format?: string): boolean {
    if (format) {
      return dayjs(dateString, format, true).isValid();
    }
    return dayjs(dateString).isValid();
  }

  /**
   * 获取用于ClickHouse查询的时间条件
   */
  static getClickHouseTimeCondition(timeRange: string): string {
    switch (timeRange) {
      case '1h':
        return "timestamp >= now() - INTERVAL 1 HOUR";
      case '24h':
        return "timestamp >= now() - INTERVAL 24 HOUR";
      case '7d':
        return "timestamp >= now() - INTERVAL 7 DAY";
      case '30d':
        return "timestamp >= now() - INTERVAL 30 DAY";
      case '90d':
        return "timestamp >= now() - INTERVAL 90 DAY";
      default:
        return "timestamp >= now() - INTERVAL 24 HOUR";
    }
  }
}

// 导出dayjs实例以供直接使用
export { dayjs };
export default DateTime; 