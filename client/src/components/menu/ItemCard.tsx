"use client";
import { formatPrice } from "@/config/brand";
import type { MenuItem } from "@/lib/types";
import { VegDot, FoodImage } from "@/components/ui";

// Editorial menu row: name ..... price, description, and a round dish photo on the right.
export function ItemCard({ item, disabled, onOpen }: { item: MenuItem; disabled: boolean; onOpen: () => void }) {
  const soldOut = !item.available;
  const blocked = soldOut || disabled;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={blocked}
      className="flex w-full items-start gap-4 border-b border-ink/10 py-5 text-left transition active:bg-accent-soft/40 last:border-b-0 disabled:active:bg-transparent"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-end gap-2">
          <span className="mb-1.5"><VegDot isVeg={item.isVeg} /></span>
          <h3 className={`font-display text-[19px] font-bold leading-tight ${soldOut ? "text-muted line-through decoration-1" : ""}`}>{item.name}</h3>
          <span aria-hidden className="mb-1.5 min-w-3 flex-1 border-b border-dotted border-ink/30" />
          <span className={`font-display text-lg font-bold leading-tight ${soldOut ? "text-muted" : "text-accent-dark"}`}>{formatPrice(item.price)}</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.description}</p>
        {soldOut && (
          <span className="mt-2 inline-block rounded border border-nonveg/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-nonveg">Sold out</span>
        )}
        {!soldOut && item.addOns.length > 0 && <p className="mt-1.5 text-xs text-muted/80">Customisable · add-ons available</p>}
      </div>
      <div className="relative h-[88px] w-[88px] shrink-0">
        <div className="h-full w-full overflow-hidden rounded-full bg-surface p-1 ring-1 ring-brass/60 shadow-sm">
          <div className="h-full w-full overflow-hidden rounded-full">
            <FoodImage src={item.image} alt={item.name} emoji={item.emoji} className={soldOut ? "grayscale opacity-60" : ""} />
          </div>
        </div>
        {!blocked && (
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-2xl leading-none text-white shadow-md" aria-label="Add">+</span>
        )}
      </div>
    </button>
  );
}
