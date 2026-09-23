import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error & { type?: string; status?: number; statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('Error:', err.message);

  if (err.type === 'entity.too.large') {
    res.status(413).json({ success: false, error: 'Request body too large' });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ success: false, error: 'Image trop lourde (max 12 Mo)' });
    return;
  }

  if (err.message?.includes('Duplicate entry')) {
    res.status(409).json({ success: false, error: 'Cette ressource existe déjà' });
    return;
  }

  if (err.code === 'ER_NO_SUCH_TABLE') {
    res.status(503).json({ success: false, error: 'Base de données incomplète. Lance npm run db:init.' });
    return;
  }

  if (err.message && err.message !== 'Internal server error' && err.message.length < 200) {
    const status = typeof err.statusCode === 'number' ? err.statusCode : 400;
    res.status(status >= 400 && status < 600 ? status : 400).json({ success: false, error: err.message });
    return;
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
}
