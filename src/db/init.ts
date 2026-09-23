import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { applyPendingMigrations } from './migrate.js';
import { getDbConnectionOptions } from './dbConfig.js';
import { ensureUsers } from './seed.js';
import { ensureFarFarAwayCatalog } from './farFarAwaySeed.js';
import { applyCurrentCatalogSnapshotOnce } from './applyCurrentCatalogSnapshot.js';
import { ensureBoosterPresets } from './boosterPresets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function initDatabase() {
  const connection = await mysql.createConnection(getDbConnectionOptions());

  try {
    const dbName = process.env.DB_NAME || 'arcana_pack';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schema);

    await applyPendingMigrations(connection);
    await ensureUsers(connection);
    await applyCurrentCatalogSnapshotOnce();
    await ensureFarFarAwayCatalog(connection);
    await ensureBoosterPresets();

    console.log('✅ Database initialized successfully!');
    console.log('👤 Admin: admin@arcana.local / password');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  initDatabase().catch(() => process.exit(1));
}
