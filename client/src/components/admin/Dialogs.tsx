"use client";
import { useState } from "react";
import type { AdminOrder } from "@/lib/types";
import { Sheet, btnPrimary } from "@/components/ui";

const chip = (on: boolean) =>
  `h-11 rounded-full border px-4 text-sm font-medium transition ${on ? "border-accent bg-accent text-white" : "border-line bg-cream text-ink"}`;

// Accept an order and tell the guest how long it will take.
export function AcceptDialog({ order, onClose, onConfirm }: { order: AdminOrder | null; onClose: () => void; onConfirm: (prepMins: number) => void }) {
  return (
    <Sheet open={!!order} onClose={onClose} label="Accept order">
      {order && <AcceptBody key={order.id} order={order} onClose={onClose} onConfirm={onConfirm} />}
    </Sheet>
  );
}

function AcceptBody({ order, onClose, onConfirm }: { order: AdminOrder; onClose: () => void; onConfirm: (m: number) => void }) {
  const [mins, setMins] = useState(String(order.prepMins || 30));
  const n = Number(mins);
  const valid = Number.isInteger(n) && n >= 5 && n <= 180;
  return (
    <div className="p-6">
      <h2 className="font-display text-2xl font-bold">Accept order #{order.orderNumber}</h2>
      <p className="mt-1 text-sm text-muted">Room {order.roomNumber} · the guest will see this estimate.</p>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Ready in (minutes)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[15, 20, 30, 45, 60].map((m) => (
          <button key={m} type="button" onClick={() => setMins(String(m))} className={chip(Number(mins) === m)}>{m}</button>
        ))}
      </div>
      <input
        type="number" inputMode="numeric" min={5} max={180} value={mins} onChange={(e) => setMins(e.target.value)}
        aria-label="Preparation time in minutes"
        className="mt-3 h-12 w-32 rounded-xl border border-line bg-cream px-4 text-lg outline-none focus:border-accent"
      />
      {!valid && <p className="mt-2 text-sm text-nonveg">Enter a time between 5 and 180 minutes.</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={onClose} className="h-12 flex-1 rounded-full border border-line font-medium">Cancel</button>
        <button disabled={!valid} onClick={() => onConfirm(n)} className={`${btnPrimary} flex-[2]`}>Accept · {valid ? n : "–"} min</button>
      </div>
    </div>
  );
}

const QUICK_REASONS = ["Item out of stock", "Kitchen is too busy", "Kitchen closing soon", "Unable to deliver to this room"];

// Reject an order with a reason the guest will see.
export function RejectDialog({ order, onClose, onConfirm }: { order: AdminOrder | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  return (
    <Sheet open={!!order} onClose={onClose} label="Reject order">
      {order && <RejectBody key={order.id} order={order} onClose={onClose} onConfirm={onConfirm} />}
    </Sheet>
  );
}

function RejectBody({ order, onClose, onConfirm }: { order: AdminOrder; onClose: () => void; onConfirm: (r: string) => void }) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;
  return (
    <div className="p-6">
      <h2 className="font-display text-2xl font-bold">Reject order #{order.orderNumber}</h2>
      <p className="mt-1 text-sm text-muted">Room {order.roomNumber} · the guest will see the reason and won&apos;t be charged.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {QUICK_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className={chip(reason === r)}>{r}</button>
        ))}
      </div>
      <textarea
        value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={3} placeholder="Reason (required)"
        aria-label="Reason for rejecting"
        className="mt-3 w-full rounded-xl border border-line bg-cream p-3 text-base outline-none focus:border-accent"
      />
      <div className="mt-5 flex gap-3">
        <button onClick={onClose} className="h-12 flex-1 rounded-full border border-line font-medium">Keep order</button>
        <button disabled={!valid} onClick={() => onConfirm(reason.trim())} className="h-12 flex-[2] rounded-full bg-nonveg font-semibold text-white disabled:bg-line disabled:text-muted">Reject order</button>
      </div>
    </div>
  );
}
