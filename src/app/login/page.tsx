"use client";
import { useEffect, useState } from "react";

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json().catch(() => null) };
}

export default function Login() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestCode = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { response, body } = await post("/api/auth/otp/request", { phone });
      if (typeof body?.resendIn === "number") setResendIn(body.resendIn);
      if (response.ok || body?.error?.code === "TOO_SOON") {
        setStep("code");
        if (!response.ok) setMsg(body.error.message);
        return;
      }
      setMsg(body?.error?.message || "ارسال کد انجام نشد.");
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { response, body } = await post("/api/auth/otp/verify", { phone, code });
      if (!response.ok) {
        setMsg(body?.error?.message || "ورود انجام نشد.");
        return;
      }
      location.href = "/";
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void (step === "phone" ? requestCode() : verifyCode());
  };

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <form onSubmit={submit} className="card w-full max-w-md p-7">
        <div className="mb-7 text-center">
          <h1 className="text-3xl font-black">ورود به خانه‌یار</h1>
          <p className="text-sm text-ink/45">ثبت، امتیازدهی و مقایسه خانه‌هایی که می‌خواهید بخرید</p>
        </div>
        {step === "phone" ? (
          <>
            <label className="label" htmlFor="phone">
              شماره موبایل
            </label>
            <input
              id="phone"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09xxxxxxxxx"
              className="field mb-5"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <label className="label" htmlFor="code">
              کد ارسال‌شده به {phone}
            </label>
            <input
              id="code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={5}
              className="field mb-3 text-center tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
            <div className="mb-5 flex justify-between text-sm">
              <button
                type="button"
                className="text-ink/60 underline"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setMsg("");
                }}
              >
                تغییر شماره
              </button>
              <button
                type="button"
                disabled={busy || resendIn > 0}
                className="text-ink/60 underline disabled:no-underline disabled:opacity-50"
                onClick={() => void requestCode()}
              >
                {resendIn > 0 ? `ارسال مجدد تا ${resendIn} ثانیه` : "ارسال مجدد کد"}
              </button>
            </div>
          </>
        )}
        {msg && <p className="mb-4 text-sm text-coral">{msg}</p>}
        <button disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "لطفاً صبر کنید…" : step === "phone" ? "دریافت کد ورود" : "ورود"}
        </button>
        <p className="mt-5 text-center text-xs text-ink/45">
          اگر حساب ندارید، با همین کد ساخته می‌شود. شماره شما فقط برای ورود استفاده می‌شود و داده‌های هر حساب خصوصی است.
        </p>
      </form>
    </main>
  );
}
