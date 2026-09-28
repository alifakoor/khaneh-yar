import { describe, expect, it } from "vitest";
import { normalizePhone, toLatinDigits } from "./phone";

describe("toLatinDigits", () => {
  it("converts Persian and Arabic-Indic digits", () => {
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("abc 12")).toBe("abc 12");
  });
});

describe("normalizePhone", () => {
  it.each([
    ["09123456789", "09123456789"],
    ["9123456789", "09123456789"],
    ["+989123456789", "09123456789"],
    ["00989123456789", "09123456789"],
    ["989123456789", "09123456789"],
    ["۰۹۱۲۳۴۵۶۷۸۹", "09123456789"],
    ["0912 345 6789", "09123456789"],
    ["0912-345-6789", "09123456789"],
    ["(0912) 3456789", "09123456789"],
  ])("accepts %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each([
    "",
    "0912345678", // too short
    "091234567890", // too long
    "08123456789", // not a mobile prefix
    "02188776655", // landline
    "+19123456789", // other country
    "0912345678a",
    "٠٩١٢٣٤٥٦٧٨",
  ])("rejects %j", (input) => expect(normalizePhone(input)).toBeNull());
});
