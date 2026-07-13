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
  // Serverless-friendly settings. `max` needs to be low enough that a burst
  // of concurrent serverless instances can't exhaust the pooler's
  // connection budget (that's what caused login to hang under load), but
  // high enough that a single request's own internal Promise.all() query
  // batches (several pages fire 3-6 queries concurrently) don't get
  // serialized onto one connection, which just trades one slowdown for
  // another. 5 is a middle ground for this app's traffic size. Idle
  // connections are released quickly since instances are ephemeral.
  // `prepare: false` is required because the transaction-mode pooler
  // doesn't support prepared statements.
  return postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    // Deliberately shorter than Vercel's default 10s function timeout, so
    // a bad/unreachable connection string throws a catchable error with
    // time to spare to send a real response — instead of racing the
    // platform's own timeout and coming back as an opaque 504.
    connect_timeout: 5,
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
