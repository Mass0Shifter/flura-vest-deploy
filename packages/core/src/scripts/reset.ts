import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../db/client";

if (process.env.NODE_ENV === "production" && process.env.FV_ALLOW_RESET !== "true") {
  throw new Error("Refusing to reset a production database (set FV_ALLOW_RESET=true to override)");
}
const db = getDb();
await db.execute(sql`drop schema if exists public cascade`);
await db.execute(sql`drop schema if exists drizzle cascade`);
await db.execute(sql`create schema public`);
console.log("Database reset");
await closeDb();
