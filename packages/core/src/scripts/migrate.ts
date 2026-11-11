import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { closeDb, getDb } from "../db/client";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
await migrate(getDb(), { migrationsFolder: dir });
console.log("Migrations applied");
await closeDb();
