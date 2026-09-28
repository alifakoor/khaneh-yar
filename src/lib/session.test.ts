import { describe, expect, it } from "vitest";
import { decodeJwt } from "jose/jwt/decode";
import { SignJWT } from "jose/jwt/sign";
import { createSessionToken, SESSION_MAX_AGE, verifySessionToken } from "./session";

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);

describe("session tokens", () => {
  it("creates a 30-day signed session and reads it back", async () => {
    const token = await createSessionToken({ userId: "abc", tokenVersion: 2 });
    const payload = decodeJwt(token);
    expect(payload.exp! - payload.iat!).toBe(SESSION_MAX_AGE);
    expect(await verifySessionToken(token)).toEqual({ userId: "abc", tokenVersion: 2 });
  });

  it("rejects missing, malformed and tampered tokens", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
    const token = await createSessionToken({ userId: "abc", tokenVersion: 0 });
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "other", tokenVersion: 0, exp: 9e9 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forged}.${s}`)).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const expired = await new SignJWT({ tokenVersion: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("abc")
      .setExpirationTime("1 second ago")
      .sign(secret());
    expect(await verifySessionToken(expired)).toBeNull();
  });

  it("rejects tokens signed with another secret", async () => {
    const other = await new SignJWT({ tokenVersion: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("abc")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("another-secret-with-at-least-32-characters!!"));
    expect(await verifySessionToken(other)).toBeNull();
  });

  it("rejects tokens without a numeric tokenVersion", async () => {
    const token = await new SignJWT({ tokenVersion: "0" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("abc")
      .setExpirationTime("1h")
      .sign(secret());
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("refuses to work with a short secret", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "short";
    try {
      await expect(createSessionToken({ userId: "abc", tokenVersion: 0 })).rejects.toThrow(/32 characters/);
    } finally {
      process.env.SESSION_SECRET = previous;
    }
  });
});
