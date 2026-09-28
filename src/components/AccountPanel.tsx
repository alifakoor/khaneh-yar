"use client";
import { useState } from "react";
export function AccountPanel() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [repeat, setRepeat] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const change = async () => {
    if (newPassword !== repeat) {
      setMsg("تکرار رمز با رمز جدید یکسان نیست.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMsg(body.error?.message || "تغییر رمز انجام نشد.");
        return;
      }
      location.href = "/login";
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  };
  return (
    <section className="card mt-5 p-5">
      <h2 className="mb-4 text-lg font-black">حساب کاربری</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className="label">رمز فعلی</span>
          <input
            dir="ltr"
            className="field"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          <span className="label">رمز جدید (حداقل ۱۲ نویسه)</span>
          <input
            dir="ltr"
            className="field"
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </label>
        <label>
          <span className="label">تکرار رمز جدید</span>
          <input
            dir="ltr"
            className="field"
            type="password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
      </div>
      {msg && <p className="mt-3 text-sm text-coral">{msg}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !currentPassword || !newPassword}
          className="btn-primary disabled:opacity-50"
          onClick={() => void change()}
        >
          {busy ? "در حال تغییر…" : "تغییر رمز و خروج از همه دستگاه‌ها"}
        </button>
        <button type="button" className="btn-ghost text-coral" onClick={() => void logout()}>
          خروج از حساب
        </button>
      </div>
    </section>
  );
}
