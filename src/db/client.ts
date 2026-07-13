import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __havkPgClient: ReturnType<typeof postgres> | undefined;
}

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Supabase connection string."
    );
  }
  // Serverless-friendly settings: each function instance should hold at
  // most one connection against the pooler (Supabase's Supavisor pooler
  // handles the real fan-out), and idle connections should be released
  // quickly rather than held open, since instances are ephemeral. `prepare:
  // false` is required because the transaction-mode pooler doesn't support
  // prepared statements.
  return postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

let _db: DrizzleDb | undefined;

/**
 * Lazily creates the connection on first use rather than at import time.
 * This matters because scripts (seed.ts, etc.) load environment variables
 * with dotenv at the top of their own module — but ES module imports are
 * hoisted above other top-level code, so an eager connection here would
 * read `process.env.DATABASE_URL` before dotenv had a chance to set it.
 */
function getDb(): DrizzleDb {
  if (_db) return _db;
  const client = globalThis.__havkPgClient ?? createClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__havkPgClient = client;
  }
  _db = drizzle(client, { schema });
  return _db;
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, _receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
