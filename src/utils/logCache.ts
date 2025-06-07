import fs from 'fs/promises';
import path from 'path';
import { LogData } from '../types';
import DateTime from './datetime';

/**
 * 日志缓存管理器
 * 当数据库不可用时，将日志缓存到本地文件
 * 数据库恢复后自动写入缓存的日志
 */
export class LogCache {
  private static instance: LogCache;
  private cacheDir: string;
  private cacheFile: string;
  private maxCacheSize: number = 10000; // 最大缓存条数
  private maxFileSize: number = 50 * 1024 * 1024; // 最大文件大小 50MB
  private isProcessing: boolean = false;

  private constructor() {
    // 缓存目录设置
    this.cacheDir = path.join(process.cwd(), 'cache');
    this.cacheFile = path.join(this.cacheDir, 'logs_cache.json');
    this.initCacheDir();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): LogCache {
    if (!LogCache.instance) {
      LogCache.instance = new LogCache();
    }
    return LogCache.instance;
  }

  /**
   * 初始化缓存目录
   */
  private async initCacheDir(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log(`📁 创建缓存目录: ${this.cacheDir}`);
    }
  }

  /**
   * 添加日志到缓存
   */
  public async addToCache(logData: LogData | LogData[]): Promise<void> {
    try {
      const logs = Array.isArray(logData) ? logData : [logData];
      const existingCache = await this.readCache();
      
      // 添加缓存时间戳
      const logsWithCacheInfo = logs.map(log => ({
        ...log,
        _cached_at: DateTime.toClickHouseFormat(), // 使用ClickHouse兼容格式
        _cache_id: this.generateCacheId()
      }));

      existingCache.push(...logsWithCacheInfo);

      // 检查缓存大小限制
      if (existingCache.length > this.maxCacheSize) {
        // 保留最新的日志，删除最旧的
        existingCache.splice(0, existingCache.length - this.maxCacheSize);
        console.warn(`⚠️ 缓存超出限制，删除了 ${existingCache.length - this.maxCacheSize} 条旧日志`);
      }

      await this.writeCache(existingCache);
      console.log(`💾 已缓存 ${logs.length} 条日志到本地，当前缓存总数: ${existingCache.length}`);
    } catch (error) {
      console.error('❌ 缓存日志失败:', error);
      throw new Error('日志缓存失败');
    }
  }

  /**
   * 获取缓存的日志数量
   */
  public async getCacheCount(): Promise<number> {
    try {
      const cache = await this.readCache();
      return cache.length;
    } catch {
      return 0;
    }
  }

  /**
   * 获取缓存状态信息
   */
  public async getCacheInfo(): Promise<{
    count: number;
    oldestCacheTime?: string;
    newestCacheTime?: string;
    fileSizeBytes: number;
    fileSizeMB: string;
  }> {
    try {
      const cache = await this.readCache();
      const stats = await fs.stat(this.cacheFile);
      
      return {
        count: cache.length,
        oldestCacheTime: cache.length > 0 ? DateTime.format(cache[0]._cached_at) : undefined,
        newestCacheTime: cache.length > 0 ? DateTime.format(cache[cache.length - 1]._cached_at) : undefined,
        fileSizeBytes: stats.size,
        fileSizeMB: (stats.size / 1024 / 1024).toFixed(2)
      };
    } catch {
      return {
        count: 0,
        fileSizeBytes: 0,
        fileSizeMB: '0.00'
      };
    }
  }

  /**
   * 处理缓存的日志（写入数据库）
   */
  public async processCachedLogs(insertFunction: (log: LogData) => Promise<void>): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    if (this.isProcessing) {
      console.log('⏳ 缓存处理已在进行中，跳过...');
      return { processed: 0, failed: 0, errors: [] };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      const cachedLogs = await this.readCache();
      
      if (cachedLogs.length === 0) {
        console.log('✅ 没有缓存的日志需要处理');
        return { processed: 0, failed: 0, errors: [] };
      }

      console.log(`🔄 开始处理 ${cachedLogs.length} 条缓存日志...`);

      // 分批处理，避免内存占用过大
      const batchSize = 100;
      const processedLogs: any[] = [];

      for (let i = 0; i < cachedLogs.length; i += batchSize) {
        const batch = cachedLogs.slice(i, i + batchSize);
        
        for (const logData of batch) {
          try {
            // 移除缓存专用字段并确保数据格式正确
            const { _cached_at, _cache_id, ...originalLog } = logData;
            
            // 确保 extra_data 字段格式正确
            if (originalLog.extra_data && typeof originalLog.extra_data === 'string') {
              try {
                originalLog.extra_data = JSON.parse(originalLog.extra_data);
              } catch {
                // 如果解析失败，保持原样
              }
            }
            
            await insertFunction(originalLog as LogData);
            processed++;
            processedLogs.push(logData);
          } catch (error) {
            failed++;
            const errorMsg = `处理缓存日志失败 (ID: ${logData._cache_id}): ${error}`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        }

        // 实时更新缓存文件，移除已处理的日志
        const remainingLogs = cachedLogs.filter(log => 
          !processedLogs.some(processed => processed._cache_id === log._cache_id)
        );
        await this.writeCache(remainingLogs);
      }

      console.log(`✅ 缓存处理完成: 成功 ${processed} 条, 失败 ${failed} 条`);
      
      // 如果全部处理成功，清空缓存文件
      if (failed === 0) {
        await this.clearCache();
      }

      return { processed, failed, errors };
    } catch (error) {
      console.error('❌ 处理缓存日志时发生错误:', error);
      return { processed, failed, errors: [`缓存处理错误: ${error}`] };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 清空缓存
   */
  public async clearCache(): Promise<void> {
    try {
      await this.writeCache([]);
      console.log('🗑️ 缓存已清空');
    } catch (error) {
      console.error('❌ 清空缓存失败:', error);
    }
  }

  /**
   * 读取缓存文件
   */
  private async readCache(): Promise<any[]> {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      // 文件不存在或格式错误，返回空数组
      return [];
    }
  }

  /**
   * 写入缓存文件
   */
  private async writeCache(logs: any[]): Promise<void> {
    const data = JSON.stringify(logs, null, 2);
    
    // 检查文件大小
    if (Buffer.byteLength(data, 'utf-8') > this.maxFileSize) {
      // 如果超出大小限制，只保留最新的一半日志
      const halfLogs = logs.slice(Math.floor(logs.length / 2));
      const halfData = JSON.stringify(halfLogs, null, 2);
      await fs.writeFile(this.cacheFile, halfData, 'utf-8');
      console.warn(`⚠️ 缓存文件过大，已压缩至 ${halfLogs.length} 条记录`);
    } else {
      await fs.writeFile(this.cacheFile, data, 'utf-8');
    }
  }

  /**
   * 生成缓存ID
   */
  private generateCacheId(): string {
    return `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 备份当前缓存文件
   */
  public async backupCache(): Promise<string> {
    try {
      const backupFile = path.join(
        this.cacheDir, 
        `logs_cache_backup_${DateTime.format(DateTime.now(), 'YYYY-MM-DD_HH-mm-ss')}.json`
      );
      
      await fs.copyFile(this.cacheFile, backupFile);
      console.log(`📦 缓存已备份到: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('❌ 备份缓存失败:', error);
      throw error;
    }
  }
} 