import { describe, expect, it } from "vitest";
import { generateOtp, hashOtp, OTP_LENGTH, otpMatches } from "./otp";

describe("otp codes", () => {
  it("generates fixed-length numeric codes", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
  });

  it("does not store the code in plain text", () => {
    const hash = hashOtp("09123456789", "12345");
    expect(hash).not.toContain("12345");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches only the same phone and code", () => {
    const hash = hashOtp("09123456789", "12345");
    expect(otpMatches("09123456789", "12345", hash)).toBe(true);
    expect(otpMatches("09123456789", "12346", hash)).toBe(false);
    expect(otpMatches("09120000000", "12345", hash)).toBe(false);
    expect(otpMatches("09123456789", "12345", "abcd")).toBe(false);
  });
});
