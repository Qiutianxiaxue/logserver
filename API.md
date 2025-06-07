# 统一的响应格式

```code
interface ApiResponse<T = any> {
  code: 0 | 1;  // 0: 失败, 1: 成功
  data?: T;     // 返回的数据
  message: string; // 查询结果说明
}
```

