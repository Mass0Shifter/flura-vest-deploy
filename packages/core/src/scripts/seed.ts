import { closeDb, getDb } from "../db/client";
import { seedDemo } from "../seed-demo";

const result = await seedDemo(getDb());
console.log(result);
await closeDb();
