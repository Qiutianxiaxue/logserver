import { Router } from 'express';
import { getHome, getHealth } from '../controllers/healthController';

const router: Router = Router();

// 根路径 - GET请求重定向到文档页面
router.get('/', (req, res) => {
  res.redirect('/docs/swagger-ui.html');
});

// 首页信息 - POST请求保持原有功能
router.post('/', getHome);

// 健康检查
router.post('/health', getHealth);

export default router; 