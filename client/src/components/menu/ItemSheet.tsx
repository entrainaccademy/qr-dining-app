"use client";
import { useState } from "react";
import { formatPrice } from "@/config/brand";
import type { MenuItem } from "@/lib/types";
import { VegDot, Sheet, FoodImage, btnPrimary } from "@/components/ui";
import type { CartLine } from "@/store/cart";

// Opened per item (keyed by the parent) so its local state resets each time.
export function ItemSheet({ item, onClose, onAdd }: { item: MenuItem | null; onClose: () => void; onAdd: (line: Omit<CartLine, "key">) => void }) {
  return (
    <Sheet open={!!item} onClose={onClose} label={item ? `Add ${item.name}` : "Add item"}>
      {item && <Body key={item.id} item={item} onClose={onClose} onAdd={onAdd} />}
    </Sheet>
  );
}

function Body({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (line: Omit<CartLine, "key">) => void }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const addOns = item.addOns.filter((a) => picked.includes(a.id));
  const unit = item.price + addOns.reduce((s, a) => s + a.price, 0);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <div className="relative h-44 shrink-0 bg-accent-soft">
        <FoodImage src={item.image} alt="" emoji={item.emoji} />
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface/95 text-xl shadow">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
        <div className="flex items-center gap-2"><VegDot isVeg={item.isVeg} /></div>
        <h2 className="mt-1 font-display text-2xl leading-tight">{item.name}</h2>
        <p className="mt-1 text-sm text-muted">{item.description}</p>
        <p className="mt-2 font-semibold text-accent-dark">{formatPrice(item.price)}</p>

        {item.addOns.length > 0 && (
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold uppercase tracking-wide text-muted">Add-ons</legend>
            <div className="mt-2 divide-y divide-line rounded-xl border border-line">
              {item.addOns.map((a) => (
                <label key={a.id} className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} className="h-5 w-5 accent-[var(--brand-accent)]" />
                  <span className="flex-1">{a.name}</span>
                  <span className="text-sm text-muted">+{formatPrice(a.price)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="mt-5 block">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted">Note for the kitchen</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="e.g. less spicy, no onions"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-cream px-3 text-base outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-surface p-4">
        <Stepper qty={qty} onChange={setQty} />
        <button
          className={`${btnPrimary} flex-1 justify-between px-5`}
          onClick={() => {
            onAdd({ itemId: item.id, name: item.name, price: item.price, isVeg: item.isVeg, image: item.image, qty, addOns, note: note.trim() });
            onClose();
          }}
        >
          <span>Add to cart</span>
          <span>{formatPrice(unit * qty)}</span>
        </button>
      </div>
    </>
  );
}

export function Stepper({ qty, onChange, min = 1 }: { qty: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex h-12 items-center rounded-full border border-line bg-cream">
      <button aria-label="Decrease quantity" disabled={qty <= min} onClick={() => onChange(qty - 1)} className="flex h-12 w-11 items-center justify-center text-xl disabled:text-line">−</button>
      <span className="w-6 text-center font-semibold" aria-live="polite">{qty}</span>
      <button aria-label="Increase quantity" disabled={qty >= 20} onClick={() => onChange(qty + 1)} className="flex h-12 w-11 items-center justify-center text-xl disabled:text-line">+</button>
    </div>
  );
}
