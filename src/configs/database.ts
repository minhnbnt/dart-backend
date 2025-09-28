import { createPool, type PoolOptions } from "mysql2/promise";

const { DB_HOST, DB_USER, DB_NAME, DB_PASSWORD, DB_PORT } = process.env;

const config: PoolOptions = {
  host: DB_HOST!,
  user: DB_USER!,
  password: DB_PASSWORD!,
  database: DB_NAME!,
  port: DB_PORT ? Number(DB_PORT) : 3306,
};

export const pool = createPool(config);
