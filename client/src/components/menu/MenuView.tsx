"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { brand, formatPrice, phoneHref } from "@/config/brand";
import { api, friendlyError } from "@/lib/api";
import type { MenuItem, MenuResponse } from "@/lib/types";
import { ErrorState, Skeleton, btnOutline } from "@/components/ui";
import { useCart, EMPTY_CART, lineTotal } from "@/store/cart";
import { ItemCard } from "./ItemCard";
import { ItemSheet } from "./ItemSheet";
import { CartDrawer } from "./CartDrawer";

const EMOJI: Record<string, string> = { starters: "🍢", mains: "🍛", breads: "🫓", desserts: "🍮", beverages: "🥤" };
const emojiFor = (cat: string) => EMOJI[cat.toLowerCase()] ?? "🍽️";

export function MenuView() {
  const token = useSearchParams().get("t")?.trim() ?? "";

  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!token);
  const [query, setQuery] = useState("");
  const [diet, setDiet] = useState<"all" | "veg" | "nonveg">("all");
  const [active, setActive] = useState("");
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const lines = useCart((s) => s.carts[token] ?? EMPTY_CART);
  const { add, replace } = useCart();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get<MenuResponse>("/api/menu", { params: { t: token } });
      setMenu({
        ...data,
        categories: data.categories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, emoji: emojiFor(c.name) })) })),
      });
      setError("");
    } catch (e) {
      setError(friendlyError(e, "menu"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Keep a saved cart in step with the live menu: drop sold-out/removed items, refresh names and prices.
  useEffect(() => {
    if (!menu) return;
    const byId = new Map(menu.categories.flatMap((c) => c.items).map((i) => [i.id, i]));
    const fixed = lines.flatMap((l) => {
      const item = byId.get(l.itemId);
      if (!item || !item.available) return [];
      const addOns = l.addOns.flatMap((a) => item.addOns.find((x) => x.id === a.id) ?? []);
      return [{ ...l, name: item.name, price: item.price, addOns }];
    });
    if (JSON.stringify(fixed) !== JSON.stringify(lines)) replace(token, fixed);
  }, [menu, lines, token, replace]);

  // Scroll-spy: highlight the category whose section is nearest the top.
  useEffect(() => {
    if (!menu) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let current = "";
        for (const c of menu.categories) {
          const el = document.getElementById(`cat-${c.id}`);
          if (el && el.getBoundingClientRect().top <= 130) current = c.id;
        }
        setActive(current || menu.categories[0]?.id || "");
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [menu, query]);

  // Keep the active tab visible inside the horizontally scrolling tab bar.
  useEffect(() => {
    const bar = tabsRef.current;
    const tab = bar?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (bar && tab) bar.scrollTo({ left: tab.offsetLeft - 16, behavior: "smooth" });
  }, [active]);

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => (diet === "all" || (diet === "veg") === i.isVeg) && (!q || `${i.name} ${i.description ?? ""}`.toLowerCase().includes(q))),
      }))
      .filter((c) => c.items.length);
  }, [menu, q, diet]);

  if (!token) {
    return <ErrorState title="Scan your room's QR code" message="This page needs the private link from the QR card in your room. Please scan it again, or call the front desk and we'll help." action={<a href={phoneHref} className={btnOutline}>Call {brand.restaurantName}</a>} />;
  }
  if (loading) return <MenuSkeleton />;
  if (error && !menu) {
    return <ErrorState title="We couldn't open the menu" message={error} action={<><button onClick={() => { setLoading(true); load(); }} className={btnOutline}>Try again</button><a href={phoneHref} className="text-sm text-muted underline">Call the front desk</a></>} />;
  }
  if (!menu) return null;

  const closed = !menu.restaurant.isOpen;
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const pill = (on: boolean) =>
    `h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition ${on ? "border-ink bg-ink text-white" : "border-ink/30 text-ink"}`;

  return (
    <div className={count ? "pb-28" : "pb-10"}>
      <header className="relative overflow-hidden bg-gradient-to-b from-accent-soft via-[#EAF1E6] to-cream px-4 pb-8 pt-8 text-center">
        <div className="relative mx-auto w-full max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-dark">
            Ordering for Room {menu.room.number} • {menu.hotel.name}
          </p>
          <h1 className="mt-5 font-display text-[44px] font-bold leading-[1.05]">{menu.restaurant.name}</h1>
          <p className="mx-auto mt-3 max-w-xs font-display text-[17px] italic leading-snug text-muted">
            {menu.restaurant.tagline || brand.cuisine}
          </p>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium">
            <span className={`h-2 w-2 rounded-full ${closed ? "bg-nonveg" : "bg-veg"}`} />
            {closed ? { closed: "Closed today", hours: "Kitchen closed", paused: "Kitchen paused" }[menu.restaurant.closedReason ?? "paused"] : "Open now"}
            <span className="font-normal text-muted">· {menu.restaurant.hoursText ?? brand.hours.replace("Daily ", "")}</span>
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <a href={phoneHref} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]">
              📞 Call
            </a>
            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/30 px-5 text-sm font-medium">
              🛵 {brand.deliveryEstimate}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4">
        {closed && (
          <div role="status" className="mb-4 rounded-2xl border border-nonveg/30 bg-[#FBEAE8] p-4 text-sm text-nonveg">
            <strong>{menu.restaurant.closedMessage ?? "The kitchen isn't taking orders right now."}</strong> You can still browse the menu, but ordering is unavailable. Please try again later or call us.
          </div>
        )}
      </div>

      <div className="sticky top-0 z-30 border-y border-ink/15 bg-surface/95 backdrop-blur">
        <div ref={tabsRef} className="no-scrollbar mx-auto flex max-w-lg gap-1 overflow-x-auto px-3" role="tablist" aria-label="Menu categories">
          {categories.map((c) => (
            <button
              key={c.id}
              data-cat={c.id}
              role="tab"
              aria-selected={active === c.id}
              onClick={() => document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth" })}
              className={`h-12 shrink-0 border-b-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] transition ${active === c.id ? "border-accent text-ink" : "border-transparent text-muted"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        <div className="flex h-12 items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-ink/15 focus-within:ring-accent">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes"
            aria-label="Search dishes"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="Dietary filter">
          <button aria-pressed={diet === "all"} onClick={() => setDiet("all")} className={pill(diet === "all")}>All</button>
          <button aria-pressed={diet === "veg"} onClick={() => setDiet(diet === "veg" ? "all" : "veg")} className={pill(diet === "veg")}>Vegetarian</button>
          <button aria-pressed={diet === "nonveg"} onClick={() => setDiet(diet === "nonveg" ? "all" : "nonveg")} className={pill(diet === "nonveg")}>Non-veg</button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-lg px-4 pt-8">
        {categories.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-display text-xl font-bold">No dishes found</p>
            <p className="mt-1 text-sm text-muted">Try a different search or filter.</p>
          </div>
        )}
        {categories.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16 pb-8">
            <h2 className="flex items-center gap-4 font-display text-2xl font-bold">
              <span aria-hidden className="h-px flex-1 bg-ink/25" />
              {c.name}
              <span aria-hidden className="h-px flex-1 bg-ink/25" />
            </h2>
            {c.description && <p className="mx-auto mt-2 max-w-xs text-center font-display text-[15px] italic leading-snug text-muted">{c.description}</p>}
            <div className="mt-2">
              {c.items.map((i) => (
                <ItemCard key={i.id} item={i} disabled={closed} onOpen={() => setSheetItem(i)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {count > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setCartOpen(true)}
            className="mx-auto flex h-14 w-full max-w-lg items-center justify-between rounded-full bg-gradient-to-r from-accent-dark to-accent px-6 text-white shadow-[0_12px_30px_-8px_rgba(22,74,58,.55)] active:scale-[0.99]"
          >
            <span className="font-medium">{count} {count === 1 ? "item" : "items"}</span>
            <span className="font-semibold">View cart · {formatPrice(subtotal)}</span>
          </button>
        </div>
      )}

      <ItemSheet item={sheetItem} onClose={() => setSheetItem(null)} onAdd={(line) => add(token, line)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} token={token} lines={lines} gstPercent={menu.restaurant.gstPercent} orderingDisabled={closed} onStale={load} />
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-5" aria-busy="true" aria-label="Loading menu">
      <Skeleton className="h-7 w-64 rounded-full" />
      <Skeleton className="mt-4 h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-40" />
      <Skeleton className="mt-6 h-12 w-full rounded-full" />
      <div className="mt-6 flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-24 rounded-full" />)}</div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-4" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-5 w-16" /></div>
            <Skeleton className="h-24 w-24 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
