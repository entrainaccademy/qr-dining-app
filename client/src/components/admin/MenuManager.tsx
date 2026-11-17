"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/config/brand";
import { adminApi, adminError } from "@/lib/adminApi";
import type { AdminCategory, AdminItem, AdminSettings } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { Sheet, Skeleton, VegDot, btnPrimary } from "@/components/ui";
import { CategoryForm, ItemForm } from "./MenuForms";

// "Menu & stock" page. Everyone on staff can mark dishes sold out or set stock counts;
// owners and managers can also add/edit/delete dishes and categories and change opening hours.
export function MenuManager() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === "owner" || role === "manager";

  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState("");
  const [editItem, setEditItem] = useState<AdminItem | "new" | null>(null);
  const [editCat, setEditCat] = useState<AdminCategory | "new" | null>(null);
  const [newItemCat, setNewItemCat] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([
        adminApi.get<{ categories: AdminCategory[]; items: AdminItem[] }>("/api/admin/menu"),
        adminApi.get<{ settings: AdminSettings }>("/api/admin/settings"),
      ]);
      setCategories(m.data.categories);
      setItems(m.data.items);
      setSettings(s.data.settings);
      setError("");
    } catch (e) {
      setError(adminError(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const byCat = useMemo(() => {
    const m = new Map<string, AdminItem[]>();
    for (const i of items) m.set(i.categoryId, [...(m.get(i.categoryId) ?? []), i]);
    return m;
  }, [items]);

  const replaceItem = (it: AdminItem) => setItems((p) => (p.some((x) => x.id === it.id) ? p.map((x) => (x.id === it.id ? it : x)) : [...p, it]));

  // Quick stock/availability change from the row controls.
  async function quickUpdate(item: AdminItem, body: { available?: boolean; stock?: number | null }) {
    setError("");
    try {
      const { data } = await adminApi.patch<{ item: AdminItem }>(`/api/admin/items/${item.id}/stock`, body);
      replaceItem(data.item);
    } catch (e) {
      setError(adminError(e));
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Menu &amp; stock</h1>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setEditCat("new")} className="h-11 rounded-full border border-accent px-4 text-sm font-semibold text-accent-dark hover:bg-accent-soft">+ Category</button>
            <button onClick={() => { setNewItemCat(categories?.[0]?.id ?? ""); setEditItem("new"); }} disabled={!categories?.length} className={`${btnPrimary} h-11 px-5 text-sm`}>+ Dish</button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-[#FBEAE8] p-3 text-sm text-nonveg">
          {error}
          {!categories && <button onClick={load} className="ml-3 font-semibold underline">Retry</button>}
        </p>
      )}

      {settings && <HoursCard settings={settings} canEdit={canEdit} onSaved={setSettings} />}

      <p className="mt-5 text-sm text-muted">
        <strong>Stock:</strong> type the portions left. Each order lowers it, a rejected order puts it back, and at 0 the dish shows as sold out to guests (they never see the number). Leave it empty to not track a dish.
      </p>

      {!categories && !error && <div className="mt-4 space-y-3"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>}

      {categories?.map((c) => (
        <section key={c.id} className="mt-6" aria-label={c.name}>
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <h2 className="font-display text-xl font-bold">{c.name}</h2>
            <span className="text-sm text-muted">{byCat.get(c.id)?.length ?? 0} dishes</span>
            {canEdit && (
              <div className="ml-auto flex gap-1">
                <button onClick={() => { setNewItemCat(c.id); setEditItem("new"); }} className="h-9 rounded-full px-3 text-sm font-semibold text-accent-dark hover:bg-accent-soft">+ Dish</button>
                <button onClick={() => setEditCat(c)} className="h-9 rounded-full px-3 text-sm font-medium text-muted hover:bg-accent-soft">Edit</button>
              </div>
            )}
          </div>
          <ul className="divide-y divide-line">
            {(byCat.get(c.id) ?? []).map((i) => (
              <ItemRow key={i.id} item={i} canEdit={canEdit} onQuick={(b) => quickUpdate(i, b)} onEdit={() => setEditItem(i)} />
            ))}
            {!byCat.get(c.id)?.length && <li className="py-4 text-sm text-muted">No dishes yet.</li>}
          </ul>
        </section>
      ))}

      <Sheet open={!!editItem} onClose={() => setEditItem(null)} label="Dish details">
        {editItem && categories && (
          <ItemForm
            key={editItem === "new" ? "new" : editItem.id}
            item={editItem === "new" ? null : editItem}
            categories={categories}
            defaultCategoryId={newItemCat}
            onClose={() => setEditItem(null)}
            onSaved={(it) => { replaceItem(it); setEditItem(null); }}
            onDeleted={(id) => { setItems((p) => p.filter((x) => x.id !== id)); setEditItem(null); }}
          />
        )}
      </Sheet>
      <Sheet open={!!editCat} onClose={() => setEditCat(null)} label="Category details">
        {editCat && (
          <CategoryForm
            key={editCat === "new" ? "new" : editCat.id}
            category={editCat === "new" ? null : editCat}
            onClose={() => setEditCat(null)}
            onSaved={() => { setEditCat(null); load(); }}
          />
        )}
      </Sheet>
    </main>
  );
}

// One dish: sold-out switch + stock count (quick controls), and Edit for managers.
function ItemRow({ item, canEdit, onQuick, onEdit }: { item: AdminItem; canEdit: boolean; onQuick: (b: { available?: boolean; stock?: number | null }) => void; onEdit: () => void }) {
  const [draft, setDraft] = useState<string | null>(null); // text being typed; null = show the saved value
  const shown = draft ?? (item.stock === null ? "" : String(item.stock));
  const soldOut = !item.available || item.stock === 0;

  // Save the typed count when the field loses focus or Enter is pressed.
  function commit() {
    if (draft === null) return;
    const n = draft.trim() === "" ? null : Number(draft);
    setDraft(null);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return; // ignore junk; the old value is shown again
    if (n !== item.stock) onQuick({ stock: n });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
        <VegDot isVeg={item.isVeg} />
        <div className="min-w-0">
          <p className={`truncate font-medium ${soldOut ? "text-muted line-through" : ""}`}>{item.name}</p>
          <p className="text-sm text-muted">{formatPrice(item.price)}{item.addOns.length ? ` · ${item.addOns.length} add-on${item.addOns.length > 1 ? "s" : ""}` : ""}</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        Stock
        <input
          type="number" inputMode="numeric" min={0} value={shown} placeholder="Not tracked"
          onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label={`Stock for ${item.name}`}
          className={`h-11 w-28 rounded-xl border bg-cream px-3 text-base text-ink outline-none focus:border-accent ${item.stock === 0 ? "border-nonveg" : "border-line"}`}
        />
      </label>

      <button
        role="switch" aria-checked={item.available} aria-label={`${item.name} available`}
        onClick={() => onQuick({ available: !item.available })}
        className={`flex h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${item.available ? "bg-accent-soft text-accent-dark" : "bg-[#FBEAE8] text-nonveg"}`}
      >
        <span className={`relative h-5 w-9 rounded-full ${item.available ? "bg-accent/40" : "bg-nonveg/30"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${item.available ? "left-[18px]" : "left-0.5"}`} />
        </span>
        {item.available ? "Available" : "Sold out"}
      </button>

      {canEdit && <button onClick={onEdit} className="h-11 rounded-full border border-line px-4 text-sm font-medium hover:bg-accent-soft">Edit</button>}
    </li>
  );
}

// Opening hours. Outside them guests see "closed" and the server refuses orders.
function HoursCard({ settings, canEdit, onSaved }: { settings: AdminSettings; canEdit: boolean; onSaved: (s: AdminSettings) => void }) {
  const [h, setH] = useState(settings.hours);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = JSON.stringify(h) !== JSON.stringify(settings.hours);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await adminApi.patch<{ settings: AdminSettings }>("/api/admin/settings", { hours: h });
      onSaved(data.settings);
      setMsg("Saved.");
    } catch (e) {
      setMsg(adminError(e));
    } finally {
      setBusy(false);
    }
  }

  const input = "h-11 rounded-xl border border-line bg-cream px-3 text-base outline-none focus:border-accent disabled:opacity-60";
  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4" aria-label="Opening hours">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-bold">Opening hours</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${settings.kitchen.open ? "bg-accent-soft text-accent-dark" : "bg-[#FBEAE8] text-nonveg"}`}>
          {settings.kitchen.open ? "Taking orders now" : settings.kitchen.message}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={!canEdit} checked={h.enabled} onChange={(e) => setH({ ...h, enabled: e.target.checked })} className="h-5 w-5 accent-[var(--brand-accent)]" />
          Only take orders between
        </label>
        <input type="time" aria-label="Opens at" disabled={!canEdit || !h.enabled} value={h.open} onChange={(e) => setH({ ...h, open: e.target.value })} className={input} />
        <span className="text-sm text-muted">and</span>
        <input type="time" aria-label="Closes at" disabled={!canEdit || !h.enabled} value={h.close} onChange={(e) => setH({ ...h, close: e.target.value })} className={input} />
        {canEdit && <button onClick={save} disabled={!dirty || busy || !h.open || !h.close} className={`${btnPrimary} h-11 px-5 text-sm`}>{busy ? "Saving…" : "Save"}</button>}
        {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
      </div>
      <p className="mt-2 text-xs text-muted">Times are in India time. A closing time earlier than the opening time runs past midnight. Switch off to control ordering only with the pause button.</p>
    </section>
  );
}
