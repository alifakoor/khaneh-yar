import { MongoClient, ObjectId, type Db } from "mongodb";
import { defaultSettings, demoProperties } from "./defaults";

export interface UserDocument {
  _id: ObjectId;
  phone: string;
  tokenVersion: number;
  seededAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const globalMongo = globalThis as typeof globalThis & {
  mongoClient?: Promise<MongoClient>;
  mongoInitialized?: Promise<void>;
};

function clientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  return (globalMongo.mongoClient ??= new MongoClient(uri).connect());
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  const db = client.db(process.env.MONGODB_DB || "khanehyar");
  globalMongo.mongoInitialized ??= initialize(db).catch((error) => {
    globalMongo.mongoInitialized = undefined;
    throw error;
  });
  await globalMongo.mongoInitialized;
  return db;
}

/** Closes the shared client (used by tests and scripts). */
export async function closeDb() {
  const client = globalMongo.mongoClient;
  globalMongo.mongoClient = undefined;
  globalMongo.mongoInitialized = undefined;
  if (client) await (await client).close();
}

async function initialize(db: Db) {
  // Legacy username/password login index; phone OTP replaced it.
  await db
    .collection("users")
    .dropIndex("username_1")
    .catch(() => undefined);
  await Promise.all([
    db
      .collection("users")
      .createIndex({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } }),
    db.collection("properties").createIndex({ ownerId: 1, id: 1 }, { unique: true }),
    db.collection("settings").createIndex({ ownerId: 1 }, { unique: true }),
    db.collection("otp_codes").createIndex({ phone: 1 }, { unique: true }),
    db.collection("otp_codes").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

/** Creates the settings document for a user if it is missing. Safe to call repeatedly. */
export async function ensureSettings(db: Db, ownerId: ObjectId) {
  const now = new Date();
  await db.collection("settings").updateOne(
    { ownerId },
    {
      $setOnInsert: {
        ownerId,
        schemaVersion: 1,
        version: 1,
        payload: defaultSettings,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

/** Gives a new user default settings and the demo properties. Idempotent. */
export async function seedUserData(db: Db, ownerId: ObjectId) {
  await ensureSettings(db, ownerId);
  const now = new Date();
  if (demoProperties.length)
    await db.collection("properties").bulkWrite(
      demoProperties.map((demo) => {
        const payload = { ...demo, createdAt: now.toISOString() };
        return {
          updateOne: {
            filter: { ownerId, id: payload.id },
            update: {
              $setOnInsert: {
                ownerId,
                id: payload.id,
                schemaVersion: 1,
                version: 1,
                payload,
                createdAt: now,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        };
      }),
    );
}
