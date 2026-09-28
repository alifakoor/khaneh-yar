"use client";
import { useState } from "react";
export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMsg(body.error?.message || "ورود انجام نشد.");
        return;
      }
      location.href = "/";
    } catch {
      setMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <form onSubmit={submit} className="card w-full max-w-md p-7">
        <div className="mb-7 text-center">
          <h1 className="text-3xl font-black">ورود به خانه‌یار</h1>
          <p className="text-sm text-ink/45">فضای شخصی تصمیم‌گیری شما</p>
        </div>
        <label className="label">نام کاربری</label>
        <input
          dir="ltr"
          autoComplete="username"
          className="field mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label className="label">رمز عبور</label>
        <input
          dir="ltr"
          autoComplete="current-password"
          className="field mb-5"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {msg && <p className="mb-4 text-sm text-coral">{msg}</p>}
        <button disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "در حال ورود…" : "ورود امن"}
        </button>
      </form>
    </main>
  );
}
