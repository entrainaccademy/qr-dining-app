"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { brand } from "@/config/brand";
import { useAuth } from "@/store/auth";

// Protects every /admin page: signed-out visitors go to /admin/login, signed-in ones get the header + logout.
export function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  // The session lives in localStorage, so wait for the browser before deciding (avoids a hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isLogin = pathname === "/admin/login";
  useEffect(() => {
    if (!mounted) return;
    if (!token && !isLogin) router.replace("/admin/login");
    if (token && isLogin) router.replace("/admin");
  }, [mounted, token, isLogin, router]);

  if (!mounted || (!token && !isLogin) || (token && isLogin)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted" aria-busy="true">
        Loading…
      </div>
    );
  }
  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight">{brand.restaurantName}</p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Kitchen board · {brand.hotelName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{user?.name}</p>
            <p className="text-[11px] uppercase tracking-widest text-white/60">{user?.role}</p>
          </div>
          <button
            onClick={() => { logout(); router.replace("/admin/login"); }}
            className="h-11 rounded-full border border-white/30 px-5 text-sm font-medium transition hover:bg-white/10 active:scale-[0.98]"
          >
            Log out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
