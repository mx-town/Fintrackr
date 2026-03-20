import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { mkdirSync } from "fs";

// Persist SQLite database in .data directory (survives restarts)
const dataDir = path.join(process.cwd(), ".data");
mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "fintrackr.db");

const globalForDb = globalThis as unknown as {
  sqlite: ReturnType<typeof Database> | undefined;
};

const client = globalForDb.sqlite ?? new Database(dbPath);

// Enable WAL mode for better concurrent read performance
client.pragma("journal_mode = WAL");
// Enable foreign key enforcement
client.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") globalForDb.sqlite = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
