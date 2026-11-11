import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbLike = Db | Tx;

const g = globalThis as unknown as { __fvDb?: Db; __fvSql?: postgres.Sql };

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

/** One pooled client per runtime instance. `prepare: false` keeps it compatible with transaction poolers (Supabase, Neon). */
export function getDb(): Db {
  if (!g.__fvDb) {
    const serverless = !!process.env.VERCEL;
    g.__fvSql = postgres(databaseUrl(), { prepare: false, max: serverless ? 3 : 10, idle_timeout: 20 });
    g.__fvDb = drizzle(g.__fvSql, { schema });
  }
  return g.__fvDb;
}

export async function closeDb() {
  await g.__fvSql?.end();
  g.__fvDb = undefined;
  g.__fvSql = undefined;
}
