import { MongoClient, ObjectId, type Db } from "mongodb";
import { defaultSettings, demoProperties } from "./defaults";
import { hashPassword } from "./password";

export interface UserDocument {
  _id: ObjectId;
  username: string;
  passwordHash: string;
  tokenVersion: number;
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

async function initialize(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ username: 1 }, { unique: true }),
    db.collection("properties").createIndex({ ownerId: 1, id: 1 }, { unique: true }),
    db.collection("settings").createIndex({ ownerId: 1 }, { unique: true }),
  ]);
  if (await db.collection("users").countDocuments({}, { limit: 1 })) return;
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required for first startup");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  const now = new Date();
  const userId = new ObjectId();
  await db
    .collection<UserDocument>("users")
    .insertOne({
      _id: userId,
      username,
      passwordHash: await hashPassword(password),
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
  await Promise.all([
    db
      .collection("settings")
      .insertOne({
        ownerId: userId,
        schemaVersion: 1,
        version: 1,
        payload: defaultSettings,
        createdAt: now,
        updatedAt: now,
      }),
    demoProperties.length
      ? db
          .collection("properties")
          .insertMany(
            demoProperties.map((payload) => ({
              ownerId: userId,
              id: payload.id,
              schemaVersion: 1,
              version: 1,
              payload,
              createdAt: new Date(payload.createdAt),
              updatedAt: now,
            })),
          )
      : Promise.resolve(),
  ]);
}
