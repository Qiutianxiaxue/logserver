# 测试缓存自动处理功能
# 
# 使用方法:
#   .\test-cache.ps1
# 
# 功能说明:
#   1. 创建测试日志
#   2. 检查缓存状态
#   3. 手动触发缓存处理
#   4. 验证处理结果
#
# 前提条件:
#   - 确保服务器正在运行 (npm run dev)
#   - 确保端口3000可访问

Write-Host "🧪 开始测试缓存自动处理功能..." -ForegroundColor Green

# 1. 创建测试日志
Write-Host "1. 创建测试日志..." -ForegroundColor Yellow
$testLog = @{
    level = "info"
    message = "缓存测试日志 - $(Get-Date)"
    service = "cache-test"
    host = "test-host"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/logs/create" -Method POST -Body $testLog -ContentType "application/json"
    Write-Host "✅ 日志创建响应: $($response.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ 日志创建失败: $_" -ForegroundColor Red
    exit 1
}

# 2. 检查缓存状态
Write-Host "`n2. 检查缓存状态..." -ForegroundColor Yellow
try {
    $cacheStatus = Invoke-RestMethod -Uri "http://localhost:3000/api/logs/cache/status" -Method POST
    Write-Host "📦 缓存状态: $($cacheStatus.data.cache.count) 条" -ForegroundColor Cyan
    Write-Host "🔍 数据库状态: $($cacheStatus.data.database.isHealthy ? '健康' : '不健康')" -ForegroundColor Cyan
} catch {
    Write-Host "❌ 获取缓存状态失败: $_" -ForegroundColor Red
}

# 3. 手动触发缓存处理
Write-Host "`n3. 手动触发缓存处理..." -ForegroundColor Yellow
try {
    $processResult = Invoke-RestMethod -Uri "http://localhost:3000/api/logs/cache/process" -Method POST
    Write-Host "✅ 缓存处理结果: $($processResult.message)" -ForegroundColor Green
    Write-Host "📊 处理统计: 成功 $($processResult.data.processed) 条, 失败 $($processResult.data.failed) 条" -ForegroundColor Cyan
} catch {
    Write-Host "❌ 缓存处理失败: $_" -ForegroundColor Red
}

# 4. 再次检查缓存状态
Write-Host "`n4. 再次检查缓存状态..." -ForegroundColor Yellow
try {
    $finalCacheStatus = Invoke-RestMethod -Uri "http://localhost:3000/api/logs/cache/status" -Method POST
    Write-Host "📦 最终缓存状态: $($finalCacheStatus.data.cache.count) 条" -ForegroundColor Cyan
} catch {
    Write-Host "❌ 获取最终缓存状态失败: $_" -ForegroundColor Red
}

Write-Host "`n🎉 测试完成！" -ForegroundColor Green 