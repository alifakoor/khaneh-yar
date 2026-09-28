import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import * as properties from "@/app/api/properties/route";
import * as property from "@/app/api/properties/[id]/route";
import * as settings from "@/app/api/settings/route";
import { defaultSettings, demoProperties } from "@/lib/defaults";
import type { Property, Settings } from "@/lib/types";
import { MAX_PROPERTIES_PER_USER } from "@/lib/validation";
import { cookieJar, json, login, req, resetDb, startDb, stopDb } from "./harness";

let db: Db;
beforeAll(async () => {
  db = await startDb();
});
afterAll(stopDb);
beforeEach(resetDb);

const newProperty = (id: string, title = "آپارتمان تست"): Property => ({
  ...demoProperties[0],
  id,
  title,
  createdAt: new Date().toISOString(),
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const create = (p: Property) => properties.POST(req("POST", "/api/properties", { body: p }));
const update = (p: Property & { version: number }) =>
  property.PUT(req("PUT", `/api/properties/${p.id}`, { body: p }), ctx(p.id));
const remove = (id: string, version: number) =>
  property.DELETE(req("DELETE", `/api/properties/${id}?version=${version}`), ctx(id));

describe("properties CRUD", () => {
  beforeEach(async () => {
    await login("09123456789");
  });

  it("creates, lists, updates and deletes a property", async () => {
    const created = await create(newProperty("p1"));
    expect(created.status).toBe(201);
    expect(await json(created)).toMatchObject({ id: "p1", version: 1 });

    const list: Property[] = await json(await properties.GET());
    expect(list.map((p) => p.id)).toContain("p1");

    const updated = await update({ ...newProperty("p1", "عنوان جدید"), version: 1 });
    expect(updated.status).toBe(200);
    expect(await json(updated)).toMatchObject({ title: "عنوان جدید", version: 2 });

    expect((await remove("p1", 2)).status).toBe(200);
    expect((await remove("p1", 2)).status).toBe(404);
  });

  it("rejects duplicate ids", async () => {
    await create(newProperty("p1"));
    expect((await create(newProperty("p1"))).status).toBe(409);
  });

  it("detects concurrent edits with the version number", async () => {
    await create(newProperty("p1"));
    expect((await update({ ...newProperty("p1", "A"), version: 1 })).status).toBe(200);
    const stale = await update({ ...newProperty("p1", "B"), version: 1 });
    expect(stale.status).toBe(409);
    expect((await json(stale)).error.code).toBe("VERSION_CONFLICT");
    expect((await remove("p1", 1)).status).toBe(409);
  });

  it("rejects a body whose id differs from the URL", async () => {
    await create(newProperty("p1"));
    const res = await property.PUT(
      req("PUT", "/api/properties/p1", { body: { ...newProperty("p2"), version: 1 } }),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
  });

  it.each([
    ["missing version", { ...newProperty("p1") }],
    ["string version", { ...newProperty("p1"), version: "1" }],
    ["zero version", { ...newProperty("p1"), version: 0 }],
  ])("rejects updates with %s", async (_, body) => {
    await create(newProperty("p1"));
    expect((await property.PUT(req("PUT", "/api/properties/p1", { body }), ctx("p1"))).status).toBe(400);
  });

  it("rejects javascript: listing links", async () => {
    expect((await create({ ...newProperty("p1"), listingUrl: "javascript:alert(document.cookie)" })).status).toBe(400);
  });

  it("rejects invalid JSON and oversized bodies", async () => {
    expect((await properties.POST(req("POST", "/api/properties", { body: "{oops" }))).status).toBe(400);
    const big = { ...newProperty("p1"), notes: "x".repeat(120_000) };
    expect((await create(big)).status).toBe(413);
  });

  it("rejects writes from another origin", async () => {
    const res = await properties.POST(
      req("POST", "/api/properties", { body: newProperty("p1"), origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it(`caps each account at ${MAX_PROPERTIES_PER_USER} properties`, async () => {
    const owner = (await db.collection("users").findOne({}))!._id;
    const now = new Date();
    await db.collection("properties").insertMany(
      Array.from({ length: MAX_PROPERTIES_PER_USER - 2 }, (_, i) => ({
        ownerId: owner,
        id: `bulk-${i}`,
        version: 1,
        payload: newProperty(`bulk-${i}`),
        createdAt: now,
      })),
    );
    const res = await create(newProperty("one-too-many"));
    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("LIMIT_REACHED");
  });
});

describe("isolation between users", () => {
  it("never exposes or changes another user's properties or settings", async () => {
    await login("09120000001");
    const alice = cookieJar.value;
    await create(newProperty("secret", "خانه آلیس"));

    await login("09120000002");
    const bob = cookieJar.value;
    const bobList: Property[] = await json(await properties.GET());
    expect(bobList.map((p) => p.id)).not.toContain("secret");

    // Bob guesses Alice's id: every write must behave as if it does not exist.
    expect((await update({ ...newProperty("secret", "hacked"), version: 1 })).status).toBe(404);
    expect((await remove("secret", 1)).status).toBe(404);
    // Same demo ids exist for both users, but edits only touch Bob's copy.
    expect((await update({ ...demoProperties[0], title: "Bob's edit", version: 1 })).status).toBe(200);

    const bobSettings: Settings & { version: number } = await json(await settings.GET());
    const saved = await settings.PUT(req("PUT", "/api/settings", { body: { ...bobSettings, maxBudget: 1 } }));
    expect(saved.status).toBe(200);

    cookieJar.value = alice;
    const aliceList: Property[] = await json(await properties.GET());
    expect(aliceList.find((p) => p.id === "secret")?.title).toBe("خانه آلیس");
    expect(aliceList.find((p) => p.id === demoProperties[0].id)?.title).toBe(demoProperties[0].title);
    expect((await json(await settings.GET())).maxBudget).toBe(defaultSettings.maxBudget);
    expect(bob).not.toBe(alice);
  });

  it("does not let a client pick the owner", async () => {
    await login("09120000001");
    const res = await create({ ...newProperty("p1"), ownerId: "someone" } as Property);
    expect(res.status).toBe(400);
  });
});

describe("settings", () => {
  beforeEach(async () => {
    await login("09123456789");
  });

  it("updates settings with optimistic versioning", async () => {
    const current: Settings & { version: number } = await json(await settings.GET());
    const res = await settings.PUT(req("PUT", "/api/settings", { body: { ...current, targetBudget: 1 } }));
    expect(await json(res)).toMatchObject({ targetBudget: 1, version: current.version + 1 });
    const stale = await settings.PUT(req("PUT", "/api/settings", { body: { ...current, targetBudget: 2 } }));
    expect(stale.status).toBe(409);
  });

  it("recreates missing settings instead of failing forever", async () => {
    await db.collection("settings").deleteMany({});
    const res = await settings.GET();
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ maxBudget: defaultSettings.maxBudget, version: 1 });
  });

  it("rejects invalid settings", async () => {
    const current: Settings & { version: number } = await json(await settings.GET());
    const res = await settings.PUT(req("PUT", "/api/settings", { body: { ...current, fitWeight: 90 } }));
    expect(res.status).toBe(400);
  });
});
