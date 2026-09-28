import { afterEach, describe, expect, it, vi } from "vitest";
import { consoleProvider, getSmsProvider, SmsIrProvider, SMSIR_VERIFY_URL } from "./sms";

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("SmsIrProvider", () => {
  it("sends the code through the verify API", async () => {
    const fetchMock = reply(200, { status: 1, message: "موفق" });
    await new SmsIrProvider("key-1", 123456, fetchMock).sendOtp("09123456789", "54321");
    const [url, init] = vi.mocked(fetchMock).mock.calls[0];
    expect(url).toBe(SMSIR_VERIFY_URL);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("key-1");
    expect(JSON.parse(init?.body as string)).toEqual({
      mobile: "09123456789",
      templateId: 123456,
      parameters: [{ name: "CODE", value: "54321" }],
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails when sms.ir reports an error status", async () => {
    await expect(
      new SmsIrProvider("k", 1, reply(200, { status: 0, message: "اعتبار کافی نیست" })).sendOtp("0912", "1"),
    ).rejects.toThrow(/اعتبار کافی نیست/);
  });

  it("fails on HTTP errors and non-JSON bodies", async () => {
    await expect(new SmsIrProvider("k", 1, reply(401, { status: 1 })).sendOtp("0912", "1")).rejects.toThrow(/401/);
    const html = vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })) as unknown as typeof fetch;
    await expect(new SmsIrProvider("k", 1, html).sendOtp("0912", "1")).rejects.toThrow(/502/);
  });

  it("propagates network errors and timeouts", async () => {
    const down = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")) as unknown as typeof fetch;
    await expect(new SmsIrProvider("k", 1, down).sendOtp("0912", "1")).rejects.toThrow(/timed out/);
  });
});

describe("getSmsProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the console provider in development", () => {
    vi.stubEnv("SMS_PROVIDER", "console");
    expect(getSmsProvider()).toBe(consoleProvider);
  });

  it("refuses the console provider in production", () => {
    vi.stubEnv("SMS_PROVIDER", "console");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSmsProvider()).toThrow(/not allowed in production/);
  });

  it("requires sms.ir credentials", () => {
    vi.stubEnv("SMS_PROVIDER", "smsir");
    vi.stubEnv("SMSIR_API_KEY", "");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "");
    expect(() => getSmsProvider()).toThrow(/SMSIR_API_KEY/);
    vi.stubEnv("SMSIR_API_KEY", "key");
    vi.stubEnv("SMSIR_TEMPLATE_ID", "abc");
    expect(() => getSmsProvider()).toThrow(/SMSIR_TEMPLATE_ID/);
    vi.stubEnv("SMSIR_TEMPLATE_ID", "100");
    expect(getSmsProvider()).toBeInstanceOf(SmsIrProvider);
  });

  it("rejects unknown providers", () => {
    vi.stubEnv("SMS_PROVIDER", "carrier-pigeon");
    expect(() => getSmsProvider()).toThrow(/Unknown SMS_PROVIDER/);
  });
});
