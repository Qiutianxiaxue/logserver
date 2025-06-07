import { Router } from 'express';
import { getHome, getHealth } from '../controllers/healthController';

const router = Router();

// 首页信息
router.post('/', getHome);

// 健康检查
router.post('/health', getHealth);

export default router; 