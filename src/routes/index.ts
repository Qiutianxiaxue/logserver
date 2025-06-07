import { Router } from 'express';
import healthRoutes from './healthRoutes';
import logRoutes from './logRoutes';

const router = Router();

// API前缀
const API_PREFIX = process.env.API_PREFIX || '/api';

// 健康检查路由（不需要API前缀）
router.use('/', healthRoutes);

// 日志相关路由
router.use(`${API_PREFIX}/logs`, logRoutes);

export default router; 