// Moves the legacy username/password admin account onto phone-number (OTP) login.
// Keeps the same user _id, so every property and settings document stays attached to it.
//
// Usage (inside the app container):
//   docker compose exec -e ADMIN_PHONE=09123456789 app node scripts/migrate-admin-to-phone.mjs
import { MongoClient } from "mongodb";
import { pathToFileURL } from "node:url";

/**
 * @param {import("mongodb").Db} db
 * @param {string} phone normalized `09XXXXXXXXX`
 * @returns {Promise<"migrated" | "already-migrated" | "no-legacy-user">}
 */
export async function migrateAdminToPhone(db, phone) {
  if (!/^09\d{9}$/.test(phone)) throw new Error("ADMIN_PHONE must look like 09XXXXXXXXX");
  const users = db.collection("users");
  const owner = await users.findOne({ phone });
  const legacy = await users.find({ username: { $exists: true } }).toArray();
  if (!legacy.length) return owner ? "already-migrated" : "no-legacy-user";
  if (legacy.length > 1) throw new Error(`Expected one legacy user, found ${legacy.length}`);
  if (owner && !owner._id.equals(legacy[0]._id))
    throw new Error(`${phone} already belongs to another account; delete that account first`);
  await users.updateOne(
    { _id: legacy[0]._id },
    {
      $set: { phone, seededAt: legacy[0].createdAt ?? new Date(), updatedAt: new Date() },
      $unset: { username: "", passwordHash: "" },
      $inc: { tokenVersion: 1 },
    },
  );
  await users.dropIndex("username_1").catch(() => undefined);
  return "migrated";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const uri = process.env.MONGODB_URI;
  const phone = process.env.ADMIN_PHONE?.trim();
  if (!uri || !phone) {
    console.error("MONGODB_URI and ADMIN_PHONE are required");
    process.exit(1);
  }
  const client = await new MongoClient(uri).connect();
  try {
    const result = await migrateAdminToPhone(client.db(process.env.MONGODB_DB || "khanehyar"), phone);
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
