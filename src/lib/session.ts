import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const SESSION_COOKIE = "khanehyar-session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface SessionPayload {
  userId: string;
  tokenVersion: number;
}

export function sessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ tokenVersion: payload.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(sessionSecret());
}

export async function verifySessionToken(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.tokenVersion !== "number") return null;
    return { userId: payload.sub, tokenVersion: payload.tokenVersion };
  } catch {
    return null;
  }
}
