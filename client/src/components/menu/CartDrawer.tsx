"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/config/brand";
import { api, friendlyError } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Sheet, VegDot, btnPrimary } from "@/components/ui";
import { Stepper } from "./ItemSheet";
import { useCart, lineTotal, lineUnit, type CartLine } from "@/store/cart";

interface Props {
  open: boolean;
  onClose: () => void;
  token: string;
  lines: CartLine[];
  gstPercent: number;
  orderingDisabled: boolean;
  onStale: () => void; // menu changed under the guest: reload it
}

export function CartDrawer(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} label="Your cart">
      {props.open && <Body {...props} />}
    </Sheet>
  );
}

function Body({ onClose, token, lines, gstPercent, orderingDisabled, onStale }: Props) {
  const router = useRouter();
  const { setQty, remove, clear } = useCart();
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Display-only math; the server recalculates and the confirmation page shows its numbers.
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const tax = Math.round(subtotal * gstPercent) / 100;
  const total = subtotal + tax;

  async function placeOrder() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        token,
        guestName: name.trim() || undefined,
        guestPhone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: "room_charge",
        // Ids, quantities and notes only - never prices.
        items: lines.map((l) => ({ menuItemId: l.itemId, qty: l.qty, addOnIds: l.addOns.map((a) => a.id), note: l.note || undefined })),
      };
      const { data } = await api.post<{ order: Order }>("/api/orders", body);
      clear(token);
      // Remember which room this order belongs to so the tracking page can link back to the menu.
      try { localStorage.setItem(`qr-dining-order-${data.order.id}`, token); } catch {}
      router.push(`/order/${data.order.id}`);
    } catch (e) {
      setError(friendlyError(e, "order"));
      if ((e as { response?: { status?: number } }).response?.status === 400) onStale();
      setBusy(false);
    }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          {step === "checkout" && (
            <button onClick={() => setStep("cart")} aria-label="Back to cart" className="-ml-2 flex h-11 w-11 items-center justify-center text-xl">←</button>
          )}
          <h2 className="font-display text-xl">{step === "cart" ? "Your cart" : "Checkout"}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-2xl">×</button>
      </header>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-display text-xl">Your cart is empty</p>
          <p className="mt-2 text-sm text-muted">Add a few dishes from the menu to get started.</p>
        </div>
      ) : step === "cart" ? (
        <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
          {lines.map((l) => (
            <li key={l.key} className="py-4">
              <div className="flex items-start gap-2">
                <span className="mt-1"><VegDot isVeg={l.isVeg} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{l.name}</p>
                  {l.addOns.length > 0 && <p className="text-sm text-muted">+ {l.addOns.map((a) => a.name).join(", ")}</p>}
                  {l.note && <p className="text-sm italic text-muted">“{l.note}”</p>}
                </div>
                <p className="font-semibold">{formatPrice(lineTotal(l))}</p>
              </div>
              <div className="mt-2 flex items-center justify-between pl-6">
                <Stepper qty={l.qty} onChange={(n) => setQty(token, l.key, n)} />
                <button onClick={() => remove(token, l.key)} className="h-11 px-3 text-sm font-medium text-nonveg">Remove</button>
              </div>
              <p className="sr-only">{formatPrice(lineUnit(l))} each</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Your name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className="h-12 w-full rounded-xl border border-line bg-cream px-3 text-base outline-none focus:border-accent" />
          </Field>
          <Field label="Phone (optional)">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" maxLength={20} autoComplete="tel" className="h-12 w-full rounded-xl border border-line bg-cream px-3 text-base outline-none focus:border-accent" />
          </Field>
          <Field label="Special instructions (optional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={3} placeholder="Allergies, delivery timing, anything we should know" className="w-full rounded-xl border border-line bg-cream p-3 text-base outline-none focus:border-accent" />
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Payment</legend>
            <label className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-accent bg-accent-soft px-3">
              <input type="radio" name="pay" defaultChecked className="h-5 w-5 accent-[var(--brand-accent)]" />
              <span className="font-medium">Pay at room / Charge to room bill</span>
            </label>
            <label className="mt-2 flex min-h-14 items-center gap-3 rounded-xl border border-line px-3 opacity-60">
              <input type="radio" name="pay" disabled className="h-5 w-5" />
              <span className="flex-1">Pay online</span>
              <span className="rounded bg-line px-2 py-0.5 text-xs font-semibold uppercase">Coming soon</span>
            </label>
          </fieldset>
        </div>
      )}

      {lines.length > 0 && (
        <footer className="border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <dl className="space-y-1 text-sm">
            <Row label="Subtotal" value={formatPrice(subtotal)} />
            <Row label={`GST (${gstPercent}%)`} value={formatPrice(tax)} />
            <Row label="Total" value={formatPrice(total)} strong />
          </dl>
          {error && <p role="alert" className="mt-3 rounded-xl bg-nonveg/10 p-3 text-sm text-nonveg">{error}</p>}
          {orderingDisabled && <p className="mt-3 text-sm text-nonveg">The kitchen isn&apos;t taking orders right now.</p>}
          {step === "cart" ? (
            <button className={`${btnPrimary} mt-3 w-full`} disabled={orderingDisabled} onClick={() => setStep("checkout")}>Continue to checkout</button>
          ) : (
            <button className={`${btnPrimary} mt-3 w-full`} disabled={busy || orderingDisabled} onClick={placeOrder}>
              {busy ? "Placing order…" : `Place order · ${formatPrice(total)}`}
            </button>
          )}
        </footer>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "pt-1 text-base font-semibold" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
