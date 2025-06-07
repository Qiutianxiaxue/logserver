import { Request, Response, NextFunction } from 'express';

// Controller方法类型定义
export type ControllerMethod = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

// 异步Controller方法类型定义
export type AsyncControllerMethod = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

// Controller错误处理包装器
export const asyncHandler = (fn: AsyncControllerMethod): ControllerMethod => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 