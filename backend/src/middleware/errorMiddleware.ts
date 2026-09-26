import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Strip any accidental secrets from error message
  const sanitizedMessage = (err.message || 'Internal Server Error')
    .replace(/(password|secret|key|token)=[^&\s]+/gi, '$1=***');

  console.error('[Error Handler]', err);

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: sanitizedMessage,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
