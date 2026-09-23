import mysql, { type Connection } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDbConnectionOptions } from './dbConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MIGRATION_FILES = [
  'migrate-v2.sql',
  'migrate-v3.sql',
  'migrate-v4.sql',
  'migrate-v5.sql',
  'migrate-v6.sql',
  'migrate-v7.sql',
  'migrate-v8.sql',
  'migrate-v9.sql',
  'migrate-v10.sql',
  'migrate-v11.sql',
] as const;

export async function applyPendingMigrations(connection: Connection): Promise<void> {
  for (const file of MIGRATION_FILES) {
    const migratePath = path.resolve(__dirname, file);
    if (!fs.existsSync(migratePath)) continue;
    const statements = fs.readFileSync(migratePath, 'utf8')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (
          err.code !== 'ER_DUP_FIELDNAME'
          && err.code !== 'ER_CANT_DROP_FIELD_OR_KEY'
          && err.code !== 'ER_BAD_FIELD_ERROR'
          && err.code !== 'ER_DUP_KEYNAME'
        ) {
          throw e;
        }
      }
    }
  }
}

export async function runPendingMigrations(): Promise<void> {
  const connection = await mysql.createConnection(getDbConnectionOptions());

  try {
    const dbName = process.env.DB_NAME || 'arcana_pack';
    await connection.query(`USE \`${dbName}\`;`);
    console.log(`📦 Applying migrations to \`${dbName}\`...`);
    await applyPendingMigrations(connection);
    console.log('✅ Migrations finished');
  } finally {
    await connection.end();
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  runPendingMigrations().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
