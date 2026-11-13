"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, adminError } from "@/lib/adminApi";
import { connectSocket } from "@/lib/socket";
import { beep, enableAlerts, notificationsSupported, notify, soundReady } from "@/lib/alerts";
import type { AdminOrder, AdminSettings, OrderStatus } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { Skeleton } from "@/components/ui";
import { formatPrice } from "@/config/brand";
import { AcceptDialog, RejectDialog } from "./Dialogs";
import { OrderCard } from "./OrderCard";

const COLUMNS: { status: OrderStatus; title: string; bar: string }[] = [
  { status: "received", title: "New", bar: "bg-accent" },
  { status: "preparing", title: "Preparing", bar: "bg-brass" },
  { status: "out_for_delivery", title: "Out for delivery", bar: "bg-[#3B6EA5]" },
  { status: "delivered", title: "Delivered", bar: "bg-muted/50" },
];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { preparing: "out_for_delivery", out_for_delivery: "delivered" };

export function Board() {
  const token = useAuth((s) => s.token);
  const logout = useAuth((s) => s.logout);

  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [live, setLive] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [fresh, setFresh] = useState<string[]>([]); // ids of just-arrived orders (pulsing)
  const [now, setNow] = useState(() => Date.now());
  const [accepting, setAccepting] = useState<AdminOrder | null>(null);
  const [rejecting, setRejecting] = useState<AdminOrder | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  const [notifState, setNotifState] = useState<string>("");

  const upsert = useCallback((o: AdminOrder) => {
    setOrders((prev) => {
      const list = prev ?? [];
      const i = list.findIndex((x) => x.id === o.id);
      if (i === -1) return [o, ...list];
      const next = [...list];
      next[i] = o;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [o, s] = await Promise.all([
        adminApi.get<{ orders: AdminOrder[] }>("/api/admin/orders"),
        adminApi.get<{ settings: AdminSettings }>("/api/admin/settings"),
      ]);
      setOrders(o.data.orders);
      setSettings(s.data.settings);
      setLoadError("");
    } catch (e) {
      setLoadError(adminError(e));
    }
  }, []);

  // Live connection: authenticated socket joins the restaurant room and receives every order event.
  useEffect(() => {
    if (!token) return;
    const s = connectSocket(token);
    s.on("connect", () => { setLive(true); load(); }); // (re)load on every connect so nothing is missed while offline
    s.on("disconnect", () => setLive(false));
    s.on("connect_error", (err) => { setLive(false); if (err.message === "unauthorized") logout(); });
    s.on("order:new", (o: AdminOrder) => {
      upsert(o);
      setFresh((f) => [...f, o.id]);
      setTimeout(() => setFresh((f) => f.filter((id) => id !== o.id)), 9000);
      beep();
      notify(`New order · Room ${o.roomNumber}`, `${o.items.reduce((n, i) => n + i.qty, 0)} items · ${formatPrice(o.total)}`);
    });
    s.on("order:updated", (o: AdminOrder) => upsert(o));
    s.on("settings:updated", (st: AdminSettings) => setSettings(st));
    return () => { s.disconnect(); };
  }, [token, load, upsert, logout]);

  // Safety net: refresh every 30s in case a socket event is ever missed. Also ticks the "x min ago" labels.
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); load(); }, 30000);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, [load]);

  async function changeStatus(order: AdminOrder, body: { status: OrderStatus; reason?: string; prepMins?: number }) {
    setBusyId(order.id);
    setActionError("");
    try {
      const { data } = await adminApi.patch<{ order: AdminOrder }>(`/api/admin/orders/${order.id}/status`, body);
      upsert(data.order);
      setAccepting(null);
      setRejecting(null);
    } catch (e) {
      setActionError(adminError(e));
      load(); // someone else may have changed it: show the real state
      setAccepting(null);
      setRejecting(null);
    } finally {
      setBusyId("");
    }
  }

  async function togglePause() {
    if (!settings) return;
    setActionError("");
    try {
      const { data } = await adminApi.patch<{ settings: AdminSettings }>("/api/admin/settings", { ordersPaused: !settings.ordersPaused });
      setSettings(data.settings);
    } catch (e) {
      setActionError(adminError(e));
    }
  }

  async function turnOnAlerts() {
    const r = await enableAlerts();
    setAlertsOn(r.sound);
    setNotifState(r.notifications);
  }

  const byStatus = useMemo(() => {
    const m: Record<string, AdminOrder[]> = {};
    for (const c of COLUMNS) m[c.status] = [];
    for (const o of orders ?? []) m[o.status]?.push(o);
    for (const k of Object.keys(m)) m[k].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); // newest first
    return m;
  }, [orders]);

  const paused = !!settings && (settings.ordersPaused || !settings.isOpen);
  const soundOn = alertsOn || soundReady();

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-4 sm:px-6">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Today&apos;s orders</h1>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${live ? "bg-accent-soft text-accent-dark" : "bg-[#FBEAE8] text-nonveg"}`}>
          <span className={`h-2 w-2 rounded-full ${live ? "bg-veg" : "bg-nonveg"}`} />
          {live ? "Live" : "Reconnecting…"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {!soundOn ? (
            <button onClick={turnOnAlerts} className="h-11 rounded-full border border-accent px-4 text-sm font-semibold text-accent-dark hover:bg-accent-soft">
              🔔 Turn on sound alerts
            </button>
          ) : (
            <span className="text-sm text-muted">
              🔔 Sound on{notificationsSupported() ? (notifState === "granted" || (typeof Notification !== "undefined" && Notification.permission === "granted") ? " · notifications on" : "") : ""}
            </span>
          )}
          <button
            role="switch"
            aria-checked={!paused}
            disabled={!settings || !settings.isOpen}
            onClick={togglePause}
            className={`flex h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition disabled:opacity-60 ${paused ? "bg-[#FBEAE8] text-nonveg" : "bg-accent text-white"}`}
          >
            <span className={`relative h-6 w-11 rounded-full ${paused ? "bg-nonveg/30" : "bg-white/30"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${paused ? "left-0.5" : "left-[22px]"}`} />
            </span>
            {settings && !settings.isOpen ? "Restaurant closed" : paused ? "Ordering paused" : "Accepting orders"}
          </button>
        </div>
      </div>

      {(loadError || actionError) && (
        <p role="alert" className="mt-3 rounded-xl bg-[#FBEAE8] p-3 text-sm text-nonveg">
          {actionError || loadError}
          {loadError && !actionError && <button onClick={load} className="ml-3 font-semibold underline">Retry</button>}
        </p>
      )}
      {paused && (
        <p role="status" className="mt-3 rounded-xl border border-nonveg/30 bg-[#FBEAE8] p-3 text-sm text-nonveg">
          Guests can see the menu but can&apos;t place orders until you turn ordering back on.
        </p>
      )}

      {/* board */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = byStatus[col.status] ?? [];
          return (
            <section key={col.status} aria-label={col.title} className="min-w-0 rounded-3xl bg-white/60 p-3 ring-1 ring-line">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-3 w-3 rounded-full ${col.bar}`} />
                <h2 className="font-display text-lg font-bold">{col.title}</h2>
                <span className="ml-auto rounded-full bg-cream px-2.5 py-0.5 text-sm font-semibold ring-1 ring-line">{orders ? list.length : "–"}</span>
              </div>
              <div className="space-y-3">
                {orders === null && !loadError && (<><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></>)}
                {orders !== null && list.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">No orders</p>
                )}
                {list.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    now={now}
                    isNew={fresh.includes(o.id)}
                    busy={busyId === o.id}
                    onAccept={() => setAccepting(o)}
                    onReject={() => setRejecting(o)}
                    onAdvance={() => { const next = NEXT[o.status]; if (next) changeStatus(o, { status: next }); }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <AcceptDialog order={accepting} onClose={() => setAccepting(null)} onConfirm={(prepMins) => accepting && changeStatus(accepting, { status: "preparing", prepMins })} />
      <RejectDialog order={rejecting} onClose={() => setRejecting(null)} onConfirm={(reason) => rejecting && changeStatus(rejecting, { status: "rejected", reason })} />
    </main>
  );
}
