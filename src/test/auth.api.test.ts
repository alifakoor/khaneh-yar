import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import * as otpRequest from "@/app/api/auth/otp/request/route";
import * as otpVerify from "@/app/api/auth/otp/verify/route";
import * as logoutAll from "@/app/api/auth/logout-all/route";
import * as account from "@/app/api/account/route";
import * as properties from "@/app/api/properties/route";
import * as health from "@/app/api/health/route";
import * as settings from "@/app/api/settings/route";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS } from "@/lib/otp";
import { AUTH_LIMITS } from "@/lib/rateLimit";
import { setSmsProvider } from "@/lib/sms";
import { cookieJar, json, login, req, resetDb, sentSms, sessionFrom, startDb, stopDb } from "./harness";

const PHONE = "09123456789";
let db: Db;

beforeAll(async () => {
  db = await startDb();
});
afterAll(stopDb);
beforeEach(async () => {
  vi.useRealTimers();
  await resetDb();
});

const requestCode = (phone = PHONE, ip?: string | null) =>
  otpRequest.POST(req("POST", "/api/auth/otp/request", { body: { phone }, ip }));
const verifyCode = (code: string, phone = PHONE, ip?: string) =>
  otpVerify.POST(req("POST", "/api/auth/otp/verify", { body: { phone, code }, ip }));
const wrong = (code: string) => (code === "00000" ? "11111" : "00000");
/** Moves the clock forward without faking timers, so the Mongo driver keeps working. */
const advance = (seconds: number) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + seconds * 1000);
};

describe("OTP sign-up and login", () => {
  it("creates a new account with default settings and demo properties", async () => {
    const res = await requestCode("۰۹۱۲۳۴۵۶۷۸۹");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true, resendIn: OTP_RESEND_SECONDS });
    expect(sentSms).toEqual([{ phone: PHONE, code: expect.stringMatching(/^\d{5}$/) }]);

    const verified = await verifyCode(sentSms[0].code);
    expect(verified.status).toBe(200);
    expect(await json(verified)).toEqual({ phone: PHONE });
    const cookie = verified.cookies.get("khanehyar-session");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);

    cookieJar.value = cookie!.value;
    expect(await json(await properties.GET())).toHaveLength(2);
    expect((await settings.GET()).status).toBe(200);
    expect(await db.collection("users").countDocuments()).toBe(1);
  });

  it("logs an existing user back in without re-seeding deleted demo data", async () => {
    await login(PHONE);
    await db.collection("properties").deleteMany({});
    await login(PHONE);
    expect(await db.collection("users").countDocuments()).toBe(1);
    expect(await db.collection("properties").countDocuments()).toBe(0);
  });

  it("stores only a hash of the code", async () => {
    await requestCode();
    const doc = await db.collection("otp_codes").findOne({ phone: PHONE });
    expect(JSON.stringify(doc)).not.toContain(sentSms[0].code);
  });

  it("rejects a wrong code and accepts the right one afterwards", async () => {
    await requestCode();
    expect((await verifyCode(wrong(sentSms[0].code))).status).toBe(401);
    expect((await verifyCode(sentSms[0].code)).status).toBe(200);
  });

  it("does not accept the same code twice", async () => {
    await requestCode();
    const code = sentSms[0].code;
    expect((await verifyCode(code)).status).toBe(200);
    expect((await verifyCode(code)).status).toBe(401);
  });

  it("accepts a code only once under concurrent use", async () => {
    await requestCode();
    const code = sentSms[0].code;
    const results = await Promise.all([verifyCode(code), verifyCode(code), verifyCode(code)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401, 401]);
  });

  it(`locks the code after ${OTP_MAX_ATTEMPTS} wrong attempts`, async () => {
    await requestCode();
    const code = sentSms[0].code;
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) expect((await verifyCode(wrong(code))).status).toBe(401);
    expect((await verifyCode(code)).status).toBe(401);
  });

  it("rejects an expired code", async () => {
    await requestCode();
    advance(OTP_TTL_SECONDS + 1);
    expect((await verifyCode(sentSms[0].code)).status).toBe(401);
  });

  it("does not let a code for one phone log in another", async () => {
    await requestCode(PHONE);
    expect((await verifyCode(sentSms[0].code, "09350000000")).status).toBe(401);
    expect(await db.collection("users").countDocuments()).toBe(0);
  });

  it("enforces the resend cooldown and replaces the code afterwards", async () => {
    await requestCode();
    const again = await requestCode();
    expect(again.status).toBe(429);
    expect((await json(again)).error.code).toBe("TOO_SOON");
    expect(sentSms).toHaveLength(1);

    advance(OTP_RESEND_SECONDS + 1);
    expect((await requestCode()).status).toBe(200);
    expect(sentSms).toHaveLength(2);
    if (sentSms[0].code !== sentSms[1].code) expect((await verifyCode(sentSms[0].code)).status).toBe(401);
    expect((await verifyCode(sentSms[1].code)).status).toBe(200);
  });

  it("sends only one SMS for concurrent requests", async () => {
    const results = await Promise.all([requestCode(), requestCode(), requestCode()]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(sentSms).toHaveLength(1);
  });

  it("limits SMS per phone per hour", async () => {
    for (let i = 0; i < AUTH_LIMITS.sendPerPhone; i++) {
      expect((await requestCode(PHONE, `10.0.1.${i}`)).status).toBe(200);
      advance(OTP_RESEND_SECONDS + 1);
    }
    const blocked = await requestCode(PHONE, "10.0.2.1");
    expect(blocked.status).toBe(429);
    expect((await json(blocked)).error.code).toBe("RATE_LIMITED");
    advance(AUTH_LIMITS.windowSeconds);
    expect((await requestCode(PHONE, "10.0.2.1")).status).toBe(200);
  });

  it("limits SMS per IP per hour", async () => {
    for (let i = 0; i < AUTH_LIMITS.sendPerIp; i++)
      expect((await requestCode(`0912000${String(i).padStart(4, "0")}`, "10.9.9.9")).status).toBe(200);
    expect((await requestCode("09359999999", "10.9.9.9")).status).toBe(429);
    expect((await requestCode("09359999999", "10.9.9.10")).status).toBe(200);
  });

  it("skips the per-IP limit instead of sharing one bucket when the IP header is missing", async () => {
    for (let i = 0; i < AUTH_LIMITS.sendPerIp + 5; i++)
      expect((await requestCode(`0912100${String(i).padStart(4, "0")}`, null)).status).toBe(200);
  });

  it("reads the client IP from CLIENT_IP_HEADER (first x-forwarded-for entry)", async () => {
    vi.stubEnv("CLIENT_IP_HEADER", "x-forwarded-for");
    try {
      const send = (phone: string, xff: string) =>
        otpRequest.POST(
          req("POST", "/api/auth/otp/request", { body: { phone }, ip: null, headers: { "x-forwarded-for": xff } }),
        );
      for (let i = 0; i < AUTH_LIMITS.sendPerIp; i++)
        expect((await send(`0912200${String(i).padStart(4, "0")}`, "5.5.5.5, 10.0.0.1")).status).toBe(200);
      expect((await send("09359999999", "5.5.5.5, 10.0.0.2")).status).toBe(429);
      expect((await send("09359999999", "6.6.6.6, 10.0.0.1")).status).toBe(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("limits verification attempts per phone even across new codes", async () => {
    let failures = 0;
    while (failures < AUTH_LIMITS.verifyPerPhone) {
      advance(OTP_RESEND_SECONDS + 1);
      await requestCode(PHONE, `10.1.0.${failures}`);
      expect((await verifyCode(wrong(sentSms.at(-1)!.code), PHONE, `10.1.0.${failures}`)).status).toBe(401);
      failures++;
    }
    advance(OTP_RESEND_SECONDS + 1);
    await requestCode(PHONE, "10.1.1.1");
    expect((await verifyCode(sentSms.at(-1)!.code, PHONE, "10.1.1.1")).status).toBe(429);
  });

  it("drops the code when the SMS provider fails, so the user can retry immediately", async () => {
    setSmsProvider({
      async sendOtp() {
        throw new Error("provider down");
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect((await requestCode()).status).toBe(502);
    } finally {
      spy.mockRestore();
      await startSmsCapture();
    }
    expect(await db.collection("otp_codes").countDocuments()).toBe(0);
    expect((await requestCode()).status).toBe(200);
  });

  it.each([
    [{ phone: "12345" }, 400],
    [{ phone: PHONE, extra: 1 }, 400],
    ["not json", 400],
  ])("rejects bad request body %j", async (body, status) => {
    expect((await otpRequest.POST(req("POST", "/api/auth/otp/request", { body }))).status).toBe(status);
  });

  it("rejects requests from another origin or without one", async () => {
    const evil = await otpRequest.POST(req("POST", "/", { body: { phone: PHONE }, origin: "https://evil.example" }));
    expect(evil.status).toBe(403);
    expect((await otpRequest.POST(req("POST", "/", { body: { phone: PHONE }, origin: null }))).status).toBe(403);
    expect(sentSms).toHaveLength(0);
  });

  it("rejects oversized bodies", async () => {
    const res = await otpRequest.POST(req("POST", "/", { body: { phone: PHONE, pad: "x".repeat(200_000) } }));
    expect(res.status).toBe(413);
  });
});

describe("health", () => {
  it("reports OK when the database is reachable", async () => {
    const res = await health.GET();
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
  });
});

describe("sessions and account", () => {
  it("rejects requests without a session", async () => {
    expect((await properties.GET()).status).toBe(401);
    expect((await account.GET()).status).toBe(401);
  });

  it("returns the account phone", async () => {
    await login(PHONE);
    expect(await json(await account.GET())).toMatchObject({ phone: PHONE });
  });

  it("logout-all invalidates every existing session", async () => {
    const first = await login(PHONE);
    const second = await login(PHONE);
    const res = await logoutAll.POST(req("POST", "/api/auth/logout-all"));
    expect(res.status).toBe(200);
    expect(sessionFrom(res)).toBe("");
    for (const token of [first, second]) {
      cookieJar.value = token;
      expect((await properties.GET()).status).toBe(401);
    }
    await login(PHONE);
    expect((await properties.GET()).status).toBe(200);
  });

  it("deletes the account and all of its data only with the matching phone", async () => {
    await login("09350000000");
    const other = cookieJar.value;
    await login(PHONE);

    const mismatch = await account.DELETE(req("DELETE", "/api/account", { body: { phone: "09350000000" } }));
    expect(mismatch.status).toBe(400);

    const res = await account.DELETE(req("DELETE", "/api/account", { body: { phone: "+98 912 345 6789" } }));
    expect(res.status).toBe(200);
    expect(sessionFrom(res)).toBe("");
    const user = await db.collection("users").findOne({ phone: PHONE });
    expect(user).toBeNull();
    expect((await properties.GET()).status).toBe(401);

    cookieJar.value = other;
    expect(await json(await properties.GET())).toHaveLength(2);
    expect(await db.collection("users").countDocuments()).toBe(1);
    expect(await db.collection("settings").countDocuments()).toBe(1);
  });

  it("starts fresh when a deleted phone signs up again", async () => {
    await login(PHONE);
    await account.DELETE(req("DELETE", "/api/account", { body: { phone: PHONE } }));
    await login(PHONE);
    expect(await json(await properties.GET())).toHaveLength(2);
  });
});

async function startSmsCapture() {
  setSmsProvider({
    async sendOtp(phone, code) {
      sentSms.push({ phone, code });
    },
  });
}
