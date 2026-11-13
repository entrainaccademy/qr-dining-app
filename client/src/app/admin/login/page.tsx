"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { brand } from "@/config/brand";
import { adminApi } from "@/lib/adminApi";
import type { StaffUser } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { btnPrimary } from "@/components/ui";

export default function AdminLogin() {
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await adminApi.post<{ token: string; user: StaffUser }>("/api/auth/login", { email, password });
      setAuth(data.token, data.user);
      router.replace("/admin");
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) setError("Can't reach the server. Check the connection and try again.");
      else if (axios.isAxiosError(err) && err.response?.status === 429) setError("Too many attempts. Please wait a few minutes.");
      else setError("Incorrect email or password.");
      setBusy(false);
    }
  }

  const field = "mt-1.5 h-12 w-full rounded-xl border border-line bg-cream px-4 text-base outline-none focus:border-accent";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent-soft via-[#EAF1E6] to-cream px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-[0_20px_50px_-20px_rgba(20,35,30,.35)] ring-1 ring-line">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-dark">{brand.hotelName}</p>
        <h1 className="mt-3 text-center font-display text-3xl font-bold">Staff sign in</h1>
        <p className="mt-1 text-center text-sm text-muted">{brand.restaurantName} · kitchen board</p>

        <label className="mt-7 block text-sm font-semibold text-muted">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required className={field} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-muted">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className={field} />
        </label>

        {error && <p role="alert" className="mt-4 rounded-xl bg-[#FBEAE8] p-3 text-sm text-nonveg">{error}</p>}
        <button type="submit" disabled={busy} className={`${btnPrimary} mt-6 w-full`}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
