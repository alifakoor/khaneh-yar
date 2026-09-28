export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

export const SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify";

/** sms.ir "fast send" (verify) API; the template must contain a `#CODE#` parameter. */
export class SmsIrProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly templateId: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendOtp(phone: string, code: string) {
    const response = await this.fetchImpl(SMSIR_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({ mobile: phone, templateId: this.templateId, parameters: [{ name: "CODE", value: code }] }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { status?: number; message?: string } | null;
    if (!response.ok || body?.status !== 1)
      throw new Error(`sms.ir send failed: HTTP ${response.status} ${body?.message ?? ""}`.trim());
  }
}

export const consoleProvider: SmsProvider = {
  async sendOtp(phone, code) {
    console.info(`[sms:console] OTP for ${phone}: ${code}`);
  },
};

let override: SmsProvider | null = null;

/** Replaces the provider (tests only). Pass null to restore env-based selection. */
export function setSmsProvider(provider: SmsProvider | null) {
  override = provider;
}

export function getSmsProvider(): SmsProvider {
  if (override) return override;
  const kind = process.env.SMS_PROVIDER || "console";
  if (kind === "smsir") {
    const apiKey = process.env.SMSIR_API_KEY;
    const templateId = Number(process.env.SMSIR_TEMPLATE_ID);
    if (!apiKey || !Number.isInteger(templateId) || templateId <= 0)
      throw new Error("SMSIR_API_KEY and SMSIR_TEMPLATE_ID are required when SMS_PROVIDER=smsir");
    return new SmsIrProvider(apiKey, templateId);
  }
  if (kind === "console") {
    if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER=console is not allowed in production");
    return consoleProvider;
  }
  throw new Error(`Unknown SMS_PROVIDER: ${kind}`);
}
