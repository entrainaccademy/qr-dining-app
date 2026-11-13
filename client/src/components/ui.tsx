"use client";
import { useEffect, useRef, useState } from "react";

// Veg / non-veg marker (green or red dot in a square), as used on Indian menus.
export function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? "border-veg" : "border-nonveg";
  return (
    <span role="img" aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"} className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] ${color}`}>
      <span className={`h-2 w-2 rounded-full ${isVeg ? "bg-veg" : "bg-nonveg"}`} />
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-line/70 ${className}`} />;
}

// Bottom sheet modal: locks page scroll, closes on Escape / backdrop tap, focuses itself on open.
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="animate-fade absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl outline-none sm:rounded-3xl"
      >
        {children}
      </div>
    </div>
  );
}

export function ErrorState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl" aria-hidden>🍽️</div>
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-3 text-muted">{message}</p>
      {action && <div className="mt-8 flex flex-col gap-3">{action}</div>}
    </main>
  );
}

export const btnPrimary =
  "inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-white transition active:scale-[0.98] hover:bg-accent-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-muted";
export const btnOutline =
  "inline-flex h-12 items-center justify-center rounded-full border border-accent px-6 font-medium text-accent-dark transition active:scale-[0.98] hover:bg-accent-soft";

// Dish photo; if the URL is missing or fails, show a warm gradient tile with a category emoji.
export function FoodImage({ src, alt, emoji = "🍽️", className = "" }: { src?: string; alt: string; emoji?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-soft via-[#CFE2D6] to-[#9CC4AE] text-4xl ${className}`}>
        <span aria-hidden className="drop-shadow-sm">{emoji}</span>
      </div>
    );
  }
  return (
    // Plain <img>: placeholder photos come from third-party hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`h-full w-full object-cover ${className}`} />
  );
}
