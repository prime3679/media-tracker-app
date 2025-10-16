import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isLocalDatabase = process.env.DATABASE_URL.includes('localhost') || 
                       process.env.DATABASE_URL.includes('127.0.0.1');

type DrizzleDB = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

export let pool: NeonPool | PgPool;
export let db: DrizzleDB;

if (isLocalDatabase) {
  const pgPool = new PgPool({ connectionString: process.env.DATABASE_URL });
  pool = pgPool;
  db = drizzlePg(pgPool, { schema }) as DrizzleDB;
} else {
  neonConfig.webSocketConstructor = ws;
  const neonPool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  pool = neonPool;
  db = drizzleNeon(neonPool, { schema }) as DrizzleDB;
}
