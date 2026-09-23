import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { AppError } from './errorHandler.js';

const uploadDir = path.resolve(process.cwd(), 'uploads/cards');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export const artUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || mimeExt(file.mimetype);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new AppError('Fichier accepté : jpg, png, webp, gif', 400));
      return;
    }
    cb(null, true);
  },
});

function mimeExt(mime: string): string {
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/avif') return '.avif';
  return '.jpg';
}
