import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

import authRoutes from './routes/authRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import collectionRoutes from './routes/collectionRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getDbConnectionOptions } from './db/dbConfig.js';
import { applyCurrentCatalogSnapshotOnce } from './db/applyCurrentCatalogSnapshot.js';
import { ensureBoosterPresets, writeBoosterArtFiles } from './db/boosterPresets.js';
import { migrateAdminEmail } from './db/seed.js';
import pool from './db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

let serverReady = false;
let lastStartingHealthLogAt = 0;

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));
app.use(express.json({ limit: '2mb' }));

const uploadsDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(path.join(uploadsDir, 'cards'), { recursive: true });
app.use('/uploads', express.static(uploadsDir));
const boostersDir = path.resolve(__dirname, '../public/boosters');
writeBoosterArtFiles();
app.use('/boosters', express.static(boostersDir));

app.get('/api/health/live', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'alive', service: 'anacra-pack', timestamp: new Date().toISOString() },
  });
});

app.get('/api/health', (req, res) => {
  if (!serverReady) {
    const now = Date.now();
    if (now - lastStartingHealthLogAt > 30_000) {
      lastStartingHealthLogAt = now;
      console.warn('[health] still starting', { ip: req.ip });
    }
    res.status(503).json({
      success: false,
      error: 'starting',
      data: { status: 'starting', service: 'anacra-pack', timestamp: new Date().toISOString() },
    });
    return;
  }
  res.json({
    success: true,
    data: { status: 'ok', service: 'anacra-pack', timestamp: new Date().toISOString() },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/collection', collectionRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Anacra Pack Backend listening on http://localhost:${PORT}`);
  void (async () => {
    const connection = await mysql.createConnection(getDbConnectionOptions());
    try {
      await connection.query('SELECT 1');
      await migrateAdminEmail(pool);
      await applyCurrentCatalogSnapshotOnce();
      await ensureBoosterPresets();
    } finally {
      await connection.end();
    }
    serverReady = true;
    console.log(`📡 API ready at http://localhost:${PORT}/api`);
  })().catch((err) => {
    console.error('❌ Database connectivity check failed:', err);
    process.exit(1);
  });
});

export default app;
