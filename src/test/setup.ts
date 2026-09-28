import { vi } from "vitest";

process.env.SESSION_SECRET = "test-secret-with-at-least-thirty-two-characters";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.SMS_PROVIDER = "console";

/** Cookie value that the mocked `next/headers` cookies() returns, i.e. the "browser" of the current test. */
export const cookieJar: { value?: string } = ((globalThis as { __cookieJar?: { value?: string } }).__cookieJar ??= {});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const jar = (globalThis as { __cookieJar?: { value?: string } }).__cookieJar;
      return name === "khanehyar-session" && jar?.value ? { name, value: jar.value } : undefined;
    },
  }),
}));
