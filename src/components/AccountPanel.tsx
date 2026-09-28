"use client";
import { useEffect, useState } from "react";

export function AccountPanel() {
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body?.phone && setPhone(body.phone))
      .catch(() => undefined);
  }, []);

  const run = async (url: string, init: RequestInit, fallback: string) => {
    setBusy(true);
    setMsg("");
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMsg(body?.error?.message || fallback);
        return;
      }
      location.href = "/login";
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => run("/api/auth/logout", { method: "POST" }, "خروج انجام نشد.");
  const logoutAll = () => run("/api/auth/logout-all", { method: "POST" }, "خروج انجام نشد.");
  const deleteAccount = () =>
    run(
      "/api/account",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: confirmPhone }),
      },
      "حذف حساب انجام نشد.",
    );

  return (
    <section className="card mt-5 p-5">
      <h2 className="mb-4 text-lg font-black">حساب کاربری</h2>
      {phone && (
        <p className="mb-4 text-sm text-ink/60">
          شماره موبایل: <span dir="ltr">{phone}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="btn-ghost" onClick={() => void logout()}>
          خروج از حساب
        </button>
        <button type="button" disabled={busy} className="btn-ghost" onClick={() => void logoutAll()}>
          خروج از همه دستگاه‌ها
        </button>
        {!confirming && (
          <button type="button" disabled={busy} className="btn-ghost text-coral" onClick={() => setConfirming(true)}>
            حذف حساب
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-4 rounded-2xl border border-coral/40 p-4">
          <p className="mb-3 text-sm">
            با حذف حساب، همه خانه‌ها و تنظیمات شما برای همیشه پاک می‌شوند. برای تأیید، شماره موبایل خود را وارد کنید.
          </p>
          <input
            dir="ltr"
            inputMode="tel"
            className="field mb-3"
            value={confirmPhone}
            onChange={(e) => setConfirmPhone(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy || !confirmPhone}
              className="btn-primary bg-coral disabled:opacity-50"
              onClick={() => void deleteAccount()}
            >
              حذف همیشگی حساب
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              انصراف
            </button>
          </div>
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
    </section>
  );
}
