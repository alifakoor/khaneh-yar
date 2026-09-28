import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ObjectId, type Db } from "mongodb";
import * as properties from "@/app/api/properties/route";
import { migrateAdminToPhone } from "../../scripts/migrate-admin-to-phone.mjs";
import { cookieJar, json, login, resetDb, startDb, stopDb } from "./harness";

let db: Db;
beforeAll(async () => {
  db = await startDb();
});
afterAll(stopDb);
beforeEach(resetDb);

const PHONE = "09123456789";

async function insertLegacyAdmin() {
  const _id = new ObjectId();
  const now = new Date();
  await db
    .collection("users")
    .insertOne({ _id, username: "admin", passwordHash: "$2b$12$x", tokenVersion: 3, createdAt: now, updatedAt: now });
  await db
    .collection("properties")
    .insertOne({ ownerId: _id, id: "mine", version: 1, payload: { id: "mine", title: "خانه من" }, createdAt: now });
  await db.collection("settings").insertOne({ ownerId: _id, version: 1, payload: {}, createdAt: now });
  return _id;
}

describe("migrate-admin-to-phone", () => {
  it("moves the legacy admin to phone login and keeps its data", async () => {
    const id = await insertLegacyAdmin();
    expect(await migrateAdminToPhone(db, PHONE)).toBe("migrated");

    const user = await db.collection("users").findOne({ _id: id });
    expect(user).toMatchObject({ phone: PHONE, tokenVersion: 4 });
    expect(user).not.toHaveProperty("username");
    expect(user).not.toHaveProperty("passwordHash");
    expect(user?.seededAt).toBeInstanceOf(Date);

    await login(PHONE);
    expect(cookieJar.value).toBeTruthy();
    const list = await json(await properties.GET());
    expect(list.map((p: { id: string }) => p.id)).toEqual(["mine"]); // no demo data added
    expect(await db.collection("users").countDocuments()).toBe(1);
  });

  it("is idempotent", async () => {
    await insertLegacyAdmin();
    await migrateAdminToPhone(db, PHONE);
    expect(await migrateAdminToPhone(db, PHONE)).toBe("already-migrated");
  });

  it("refuses when the phone already has a separate account", async () => {
    await login(PHONE);
    await insertLegacyAdmin();
    await expect(migrateAdminToPhone(db, PHONE)).rejects.toThrow(/already belongs/);
  });

  it("validates the phone format", async () => {
    await expect(migrateAdminToPhone(db, "9123456789")).rejects.toThrow(/09X/);
  });

  it("reports when there is nothing to migrate", async () => {
    expect(await migrateAdminToPhone(db, PHONE)).toBe("no-legacy-user");
  });
});
