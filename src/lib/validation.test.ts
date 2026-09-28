import { describe, expect, it } from "vitest";
import { defaultSettings, demoProperties } from "./defaults";
import { isHttpUrl } from "./format";
import {
  deleteAccountSchema,
  MAX_NEIGHBORHOODS,
  otpRequestSchema,
  otpVerifySchema,
  propertySchema,
  settingsSchema,
} from "./validation";

const property = demoProperties[0];

describe("propertySchema", () => {
  it("accepts the seeded demo properties", () => {
    for (const p of demoProperties) expect(propertySchema.safeParse(p).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(propertySchema.safeParse({ ...property, ownerId: "someone-else" }).success).toBe(false);
  });

  it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<script>", "ftp://x.ir", "not a url"])(
    "rejects listingUrl %j",
    (listingUrl) => expect(propertySchema.safeParse({ ...property, listingUrl }).success).toBe(false),
  );

  it.each(["", "https://divar.ir/v/abc", "http://example.com/a?b=c"])("accepts listingUrl %j", (listingUrl) =>
    expect(propertySchema.safeParse({ ...property, listingUrl }).success).toBe(true),
  );

  it("rejects negative or non-finite numbers", () => {
    expect(propertySchema.safeParse({ ...property, area: -1 }).success).toBe(false);
    expect(propertySchema.safeParse({ ...property, costs: { ...property.costs, price: Infinity } }).success).toBe(
      false,
    );
  });

  it("rejects blank titles and oversized notes", () => {
    expect(propertySchema.safeParse({ ...property, title: "   " }).success).toBe(false);
    expect(propertySchema.safeParse({ ...property, notes: "x".repeat(10_001) }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  it("accepts the default settings", () => {
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true);
  });

  it("requires fit and value weights to add up to 100", () => {
    expect(settingsSchema.safeParse({ ...defaultSettings, fitWeight: 70, valueWeight: 40 }).success).toBe(false);
  });

  it("limits the number of neighborhoods", () => {
    const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`محله ${i}`, "good"]));
    expect(settingsSchema.safeParse({ ...defaultSettings, neighborhoods: many(MAX_NEIGHBORHOODS) }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...defaultSettings, neighborhoods: many(MAX_NEIGHBORHOODS + 1) }).success).toBe(
      false,
    );
  });

  it("rejects unknown criteria", () => {
    const criteria = [...defaultSettings.criteria, { key: "pool", label: "استخر", weight: 1, active: true }];
    expect(settingsSchema.safeParse({ ...defaultSettings, criteria }).success).toBe(false);
  });
});

describe("OTP schemas", () => {
  it("normalizes the phone number", () => {
    expect(otpRequestSchema.parse({ phone: "۰۹۱۲ ۳۴۵ ۶۷۸۹" })).toEqual({ phone: "09123456789" });
    expect(deleteAccountSchema.parse({ phone: "+989123456789" })).toEqual({ phone: "09123456789" });
  });

  it("rejects invalid phones and extra fields", () => {
    expect(otpRequestSchema.safeParse({ phone: "12345" }).success).toBe(false);
    expect(otpRequestSchema.safeParse({ phone: 9123456789 }).success).toBe(false);
    expect(otpRequestSchema.safeParse({ phone: "09123456789", admin: true }).success).toBe(false);
  });

  it("accepts five-digit codes, including Persian digits", () => {
    expect(otpVerifySchema.parse({ phone: "09123456789", code: "۱۲۳۴۵" }).code).toBe("12345");
    expect(otpVerifySchema.parse({ phone: "09123456789", code: " 01234 " }).code).toBe("01234");
  });

  it.each(["1234", "123456", "12a45", ""])("rejects code %j", (code) =>
    expect(otpVerifySchema.safeParse({ phone: "09123456789", code }).success).toBe(false),
  );
});

describe("isHttpUrl", () => {
  it("allows only http and https", () => {
    expect(isHttpUrl("https://a.ir")).toBe(true);
    expect(isHttpUrl("http://a.ir")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("//a.ir")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
