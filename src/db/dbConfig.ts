import type mysql from 'mysql2/promise';

export function getDbConnectionOptions(): mysql.ConnectionOptions {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    multipleStatements: true,
    connectTimeout: 10_000,
  };
}
