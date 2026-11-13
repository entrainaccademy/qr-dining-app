import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AddOn } from "@/lib/types";

// Prices here are for display only. The server recalculates everything.
export interface CartLine {
  key: string; itemId: string; name: string; price: number; isVeg: boolean; image?: string;
  qty: number; addOns: AddOn[]; note: string;
}

interface CartState {
  carts: Record<string, CartLine[]>; // keyed by room token, so rooms never share a cart
  add: (token: string, line: Omit<CartLine, "key">) => void;
  setQty: (token: string, key: string, qty: number) => void;
  remove: (token: string, key: string) => void;
  replace: (token: string, lines: CartLine[]) => void;
  clear: (token: string) => void;
}

const lineKey = (l: Omit<CartLine, "key">) =>
  [l.itemId, l.addOns.map((a) => a.id).sort().join(","), l.note.trim().toLowerCase()].join("|");

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      add: (token, line) =>
        set((s) => {
          const lines = s.carts[token] ?? [];
          const key = lineKey(line);
          const existing = lines.find((l) => l.key === key);
          const next = existing
            ? lines.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l))
            : [...lines, { ...line, key }];
          return { carts: { ...s.carts, [token]: next } };
        }),
      setQty: (token, key, qty) =>
        set((s) => ({
          carts: {
            ...s.carts,
            [token]: (s.carts[token] ?? []).map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(20, qty)) } : l)),
          },
        })),
      remove: (token, key) =>
        set((s) => ({ carts: { ...s.carts, [token]: (s.carts[token] ?? []).filter((l) => l.key !== key) } })),
      replace: (token, lines) => set((s) => ({ carts: { ...s.carts, [token]: lines } })),
      clear: (token) =>
        set((s) => {
          const rest = { ...s.carts };
          delete rest[token];
          return { carts: rest };
        }),
    }),
    { name: "qr-dining-cart" },
  ),
);

export const EMPTY_CART: CartLine[] = [];
export const lineUnit = (l: CartLine) => l.price + l.addOns.reduce((s, a) => s + a.price, 0);
export const lineTotal = (l: CartLine) => lineUnit(l) * l.qty;
