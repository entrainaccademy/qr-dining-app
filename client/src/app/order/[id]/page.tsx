"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brand, formatPrice, phoneHref } from "@/config/brand";
import { api, friendlyError } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import type { Order, OrderStatus } from "@/lib/types";
import { ErrorState, Skeleton, VegDot, btnOutline } from "@/components/ui";

const STEPS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: "received", label: "Order received", hint: "The kitchen has your order." },
  { status: "preparing", label: "Preparing", hint: "Your food is being freshly prepared." },
  { status: "out_for_delivery", label: "Out for delivery", hint: "On its way to your room." },
  { status: "delivered", label: "Delivered", hint: "Enjoy your meal!" },
];
const FINAL: OrderStatus[] = ["delivered", "rejected", "cancelled"];
const POLL_MS = 5000; // fallback polling while the live connection is down
const SAFETY_POLL_MS = 30000; // slow refresh while the live connection is up

const timeFmt = (d: Date | string) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [token] = useState(() => {
    try { return localStorage.getItem(`qr-dining-order-${id}`); } catch { return null; }
  });

  const [live, setLive] = useState(false); // socket connected?
  const hasOrder = useRef(false); // lets fetchOrder know whether it already has something to show

  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get<{ order: Order }>(`/api/orders/${id}`);
      hasOrder.current = true;
      setOrder(data.order);
      setOffline(false);
      setError("");
    } catch (e) {
      const notFound = (e as { response?: { status?: number } }).response?.status === 404;
      if (notFound || !hasOrder.current) setError(friendlyError(e, "track"));
      else setOffline(true); // keep showing the last known status
    } finally {
      setNow(Date.now());
    }
  }, [id]);

  const finished = !!order && FINAL.includes(order.status);

  // Live updates: the kitchen's status changes are pushed over Socket.io and appear instantly.
  useEffect(() => {
    if (finished) return;
    const socket = connectSocket();
    socket.on("connect", () => {
      setLive(true);
      socket.emit("join:order", id); // also runs again after any reconnect
      fetchOrder(); // catch up on anything missed while disconnected
    });
    socket.on("disconnect", () => setLive(false));
    socket.on("order:updated", (o: Order) => {
      if (o.id !== id) return;
      hasOrder.current = true;
      setOrder(o);
      setOffline(false);
      setNow(Date.now());
    });
    return () => { socket.disconnect(); };
  }, [finished, id, fetchOrder]);

  // Fallback: poll every 5s while the socket is down; only a slow safety refresh while it's up.
  useEffect(() => {
    if (finished) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrder();
    const t = setInterval(fetchOrder, live ? SAFETY_POLL_MS : POLL_MS);
    return () => clearInterval(t);
  }, [finished, id, live, fetchOrder]);

  if (error && !order) {
    return <ErrorState title="Order not found" message={error} action={<a href={phoneHref} className={btnOutline}>Call {brand.restaurantName}</a>} />;
  }
  if (!order) return <OrderSkeleton />;

  const failed = order.status === "rejected" || order.status === "cancelled";
  const reached = new Map(order.statusHistory.map((h) => [h.status, h.at]));
  const currentIdx = STEPS.findIndex((s) => s.status === order.status);
  const eta = new Date(new Date(order.createdAt).getTime() + order.prepMins * 60000);
  const minsLeft = Math.max(0, Math.round((eta.getTime() - now) / 60000));

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-12 pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-dark">{brand.hotelName} · Room {order.roomNumber}</p>
      <h1 className="mt-2 font-display text-3xl leading-tight">
        {order.status === "delivered" ? "Enjoy your meal" : failed ? (order.status === "rejected" ? "Order not accepted" : "Order cancelled") : "Thank you! We're on it"}
      </h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        Order #{order.orderNumber} · placed {timeFmt(order.createdAt)}
        {live && !finished && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dark">
            <span className="h-2 w-2 animate-pulse rounded-full bg-veg" /> Live
          </span>
        )}
      </p>

      {offline && !live &&<p role="status" className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-accent-dark">Reconnecting… showing the last known status.</p>}

      {failed && (
        <div role="alert" className="mt-4 rounded-2xl border border-nonveg/30 bg-nonveg/10 p-4 text-sm text-nonveg">
          <p className="font-semibold">{order.status === "rejected" ? "Sorry, the kitchen couldn't accept this order." : "This order was cancelled."}</p>
          {order.rejectReason && <p className="mt-1">Reason: {order.rejectReason}</p>}
          <p className="mt-1">Nothing will be charged to your room. Please call us if you need help.</p>
        </div>
      )}

      {!failed && order.status !== "delivered" && (
        <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-white/60">Estimated arrival</p>
          <p className="mt-1 font-display text-2xl">{timeFmt(eta)}</p>
          <p className="text-sm text-white/70">{minsLeft > 0 ? `about ${minsLeft} min` : "any moment now"}</p>
        </div>
      )}

      <section aria-label="Order status" className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <ol>
          {(failed ? failedSteps(order) : STEPS).map((s, i, arr) => {
            const done = failed ? true : i <= currentIdx;
            const isCurrent = !failed && i === currentIdx && order.status !== "delivered";
            const bad = failed && i === arr.length - 1;
            const at = reached.get(s.status);
            return (
              <li key={s.status} className="relative flex gap-4 pb-6 last:pb-0" aria-current={isCurrent ? "step" : undefined}>
                {i < arr.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${done && (failed || i < currentIdx) ? "bg-accent" : "bg-line"}`} />}
                <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${bad ? "bg-nonveg text-white" : done ? "bg-accent text-white" : "bg-line text-muted"} ${isCurrent ? "ring-4 ring-accent/30" : ""}`}>
                  {bad ? "!" : done ? "✓" : ""}
                </span>
                <div>
                  <p className={`font-medium ${done ? "" : "text-muted"}`}>{s.label}</p>
                  <p className="text-sm text-muted">{at ? timeFmt(at) : done ? "" : s.hint}{isCurrent ? ` · ${s.hint}` : ""}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Order summary" className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl">Your order</h2>
        <ul className="mt-3 divide-y divide-line">
          {order.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 py-3">
              <span className="mt-1"><VegDot isVeg={it.isVeg} /></span>
              <div className="min-w-0 flex-1">
                <p>{it.qty} × {it.name}</p>
                {it.addOns.length > 0 && <p className="text-sm text-muted">+ {it.addOns.map((a) => a.name).join(", ")}</p>}
                {it.note && <p className="text-sm italic text-muted">“{it.note}”</p>}
              </div>
              <p className="font-medium">{formatPrice(it.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          <div className="flex justify-between text-muted"><dt>GST ({brand.gstPercent}%)</dt><dd>{formatPrice(order.tax)}</dd></div>
          <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted">Payment: charged to your room bill.</p>
        {order.notes && <p className="mt-2 text-sm text-muted">Instructions: {order.notes}</p>}
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <a href={phoneHref} className={btnOutline}>📞 Call restaurant</a>
        {token && <Link href={`/menu?t=${encodeURIComponent(token)}`} className="text-center text-sm text-muted underline">Back to menu</Link>}
      </div>
    </div>
  );
}

// Timeline for rejected/cancelled orders: the steps it reached, then the failure.
function failedSteps(order: Order) {
  const reachedStatuses = new Set(order.statusHistory.map((h) => h.status));
  const steps = STEPS.filter((s) => s.status !== "delivered" && reachedStatuses.has(s.status));
  const label = order.status === "rejected" ? "Rejected" : "Cancelled";
  return [...steps, { status: order.status, label, hint: order.rejectReason ?? "" }];
}

function OrderSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-5" aria-busy="true" aria-label="Loading order">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-3 h-9 w-72" />
      <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
    </div>
  );
}
