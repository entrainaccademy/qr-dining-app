"use client";
import { formatPrice } from "@/config/brand";
import type { AdminOrder } from "@/lib/types";
import { VegDot } from "@/components/ui";

export function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}
const fmtElapsed = (m: number) => (m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`);
const timeFmt = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

interface Props {
  order: AdminOrder;
  now: number;
  isNew: boolean; // just arrived: pulse the card
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: () => void; // preparing -> out_for_delivery -> delivered
}

export function OrderCard({ order, now, isNew, busy, onAccept, onReject, onAdvance }: Props) {
  const mins = minutesSince(order.createdAt, now);
  const waiting = (order.status === "received" || order.status === "preparing") && mins >= 15; // getting late
  const deliveredAt = order.statusHistory.find((h) => h.status === "delivered")?.at;
  const btn = "h-12 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50";

  return (
    <article
      aria-label={`Order ${order.orderNumber}, room ${order.roomNumber}`}
      className={`rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(20,35,30,.06),0_10px_24px_-14px_rgba(20,35,30,.3)] ring-1 ${isNew ? "animate-flash ring-accent" : "ring-line"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-bold leading-none">Room {order.roomNumber}</p>
          <p className="mt-1 text-xs text-muted">#{order.orderNumber} · {timeFmt(order.createdAt)}</p>
        </div>
        <div className="text-right">
          {order.status === "delivered" ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-dark">
              Delivered {deliveredAt ? timeFmt(deliveredAt) : ""}
            </span>
          ) : (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${waiting ? "bg-[#FBEAE8] text-nonveg" : "bg-cream text-muted ring-1 ring-line"}`}>
              {fmtElapsed(mins)}
            </span>
          )}
          {isNew && <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-accent">New</p>}
        </div>
      </div>

      <ul className="mt-3 divide-y divide-line border-y border-line">
        {order.items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 py-2">
            <span className="mt-1"><VegDot isVeg={it.isVeg} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{it.qty} × {it.name}</p>
              {it.addOns.length > 0 && <p className="text-sm text-muted">+ {it.addOns.map((a) => a.name).join(", ")}</p>}
              {it.note && <p className="text-sm font-medium text-accent-dark">“{it.note}”</p>}
            </div>
          </li>
        ))}
      </ul>

      {(order.guestName || order.guestPhone || order.notes) && (
        <div className="mt-3 space-y-0.5 text-sm">
          {(order.guestName || order.guestPhone) && (
            <p>
              <span className="text-muted">Guest: </span>
              {order.guestName}
              {order.guestPhone && (
                <a href={`tel:${order.guestPhone.replace(/[^\d+]/g, "")}`} className="ml-2 font-medium text-accent-dark underline">{order.guestPhone}</a>
              )}
            </p>
          )}
          {order.notes && <p className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-accent-dark"><span className="font-semibold">Note:</span> {order.notes}</p>}
        </div>
      )}

      <div className="mt-3 flex items-end justify-between">
        <p className="text-xs text-muted">Charge to room bill</p>
        <p className="font-display text-xl font-bold">{formatPrice(order.total)}</p>
      </div>

      {order.status === "received" && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button disabled={busy} onClick={onAccept} className={`${btn} bg-accent text-white hover:bg-accent-dark`}>Accept</button>
          <button disabled={busy} onClick={onReject} className={`${btn} border border-nonveg/40 text-nonveg hover:bg-[#FBEAE8]`}>Reject</button>
        </div>
      )}
      {order.status === "preparing" && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button disabled={busy} onClick={onAdvance} className={`${btn} bg-accent text-white hover:bg-accent-dark`}>Send out for delivery</button>
          <button disabled={busy} onClick={onReject} className={`${btn} border border-line text-muted hover:bg-cream`}>Reject</button>
        </div>
      )}
      {order.status === "out_for_delivery" && (
        <button disabled={busy} onClick={onAdvance} className={`${btn} mt-3 w-full bg-ink text-white hover:bg-black`}>Mark delivered</button>
      )}
    </article>
  );
}
