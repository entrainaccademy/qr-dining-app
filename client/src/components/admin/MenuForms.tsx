"use client";
import { useState } from "react";
import { adminApi, adminError } from "@/lib/adminApi";
import type { AdminCategory, AdminItem } from "@/lib/types";
import { btnPrimary } from "@/components/ui";

const field = "mt-1 h-12 w-full rounded-xl border border-line bg-cream px-3 text-base outline-none focus:border-accent";
const label = "block text-sm font-semibold uppercase tracking-wide text-muted";

// Add or edit a dish (owner/manager). Stock left empty means "not tracked".
export function ItemForm({ item, categories, defaultCategoryId, onClose, onSaved, onDeleted }: {
  item: AdminItem | null; categories: AdminCategory[]; defaultCategoryId: string;
  onClose: () => void; onSaved: (i: AdminItem) => void; onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? (defaultCategoryId || categories[0]?.id || ""));
  const [isVeg, setIsVeg] = useState(item?.isVeg ?? true);
  const [image, setImage] = useState(item?.image ?? "");
  const [stock, setStock] = useState(item?.stock == null ? "" : String(item.stock));
  const [addOns, setAddOns] = useState(item?.addOns.map((a) => ({ name: a.name, price: String(a.price) })) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(price);
    if (!name.trim()) return setError("Please enter a name.");
    if (price.trim() === "" || !Number.isFinite(p) || p < 0) return setError("Please enter a valid price.");
    if (stock.trim() !== "" && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) return setError("Stock must be a whole number, or empty.");
    const ao = addOns.filter((a) => a.name.trim());
    if (ao.some((a) => !Number.isFinite(Number(a.price)) || Number(a.price) < 0)) return setError("Check the add-on prices.");

    const body = {
      categoryId, name: name.trim(), description: description.trim(), price: p, isVeg, image: image.trim(),
      stock: stock.trim() === "" ? null : Number(stock),
      addOns: ao.map((a) => ({ name: a.name.trim(), price: Number(a.price) })),
    };
    setBusy(true);
    setError("");
    try {
      const { data } = item
        ? await adminApi.patch<{ item: AdminItem }>(`/api/admin/items/${item.id}`, body)
        : await adminApi.post<{ item: AdminItem }>("/api/admin/items", body);
      onSaved(data.item);
    } catch (err) {
      setError(adminError(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || !window.confirm(`Delete "${item.name}"? Past orders keep their record.`)) return;
    setBusy(true);
    try {
      await adminApi.delete(`/api/admin/items/${item.id}`);
      onDeleted(item.id);
    } catch (err) {
      setError(adminError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <h2 className="font-display text-2xl font-bold">{item ? "Edit dish" : "New dish"}</h2>
        <label className={label}>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={field} /></label>
        <label className={label}>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className={`${field} h-auto py-2`} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Price (₹, before GST)<input type="number" inputMode="decimal" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className={field} /></label>
          <label className={label}>Stock (optional)<input type="number" inputMode="numeric" min={0} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Not tracked" className={field} /></label>
        </div>
        <label className={label}>Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className={label}>Type</legend>
          <div className="mt-1 flex gap-2">
            {[[true, "Veg"], [false, "Non-veg"]].map(([v, t]) => (
              <button key={String(t)} type="button" aria-pressed={isVeg === v} onClick={() => setIsVeg(v as boolean)}
                className={`h-11 rounded-full border px-5 text-sm font-medium ${isVeg === v ? "border-accent bg-accent text-white" : "border-line bg-cream"}`}>{t as string}</button>
            ))}
          </div>
        </fieldset>
        <label className={label}>Photo link (optional)<input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" className={field} /></label>

        <fieldset>
          <legend className={label}>Add-ons</legend>
          <div className="mt-1 space-y-2">
            {addOns.map((a, idx) => (
              <div key={idx} className="flex gap-2">
                <input aria-label="Add-on name" value={a.name} placeholder="e.g. Extra cheese" onChange={(e) => setAddOns(addOns.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 outline-none focus:border-accent" />
                <input aria-label="Add-on price" type="number" inputMode="decimal" min={0} value={a.price} placeholder="₹" onChange={(e) => setAddOns(addOns.map((x, j) => (j === idx ? { ...x, price: e.target.value } : x)))} className="h-11 w-24 rounded-xl border border-line bg-cream px-3 outline-none focus:border-accent" />
                <button type="button" aria-label="Remove add-on" onClick={() => setAddOns(addOns.filter((_, j) => j !== idx))} className="h-11 w-11 rounded-full text-xl text-muted hover:bg-accent-soft">×</button>
              </div>
            ))}
            {addOns.length < 15 && <button type="button" onClick={() => setAddOns([...addOns, { name: "", price: "" }])} className="h-10 rounded-full px-3 text-sm font-semibold text-accent-dark hover:bg-accent-soft">+ Add-on</button>}
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-xl bg-[#FBEAE8] p-3 text-sm text-nonveg">{error}</p>}
      </div>
      <div className="flex gap-3 border-t border-line bg-surface p-4">
        {item && <button type="button" onClick={remove} disabled={busy} className="h-12 rounded-full px-4 text-sm font-semibold text-nonveg hover:bg-[#FBEAE8]">Delete</button>}
        <button type="button" onClick={onClose} className="ml-auto h-12 rounded-full border border-line px-5 font-medium">Cancel</button>
        <button type="submit" disabled={busy} className={`${btnPrimary} px-8`}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

// Add, rename or delete a category (delete only works once it has no dishes).
export function CategoryForm({ category, onClose, onSaved }: { category: AdminCategory | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [sortOrder, setSortOrder] = useState(category ? String(category.sortOrder) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter a name.");
    const body = { name: name.trim(), description: description.trim(), ...(sortOrder.trim() !== "" ? { sortOrder: Number(sortOrder) } : {}) };
    setBusy(true);
    setError("");
    try {
      if (category) await adminApi.patch(`/api/admin/categories/${category.id}`, body);
      else await adminApi.post("/api/admin/categories", body);
      onSaved();
    } catch (err) {
      setError(adminError(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!category || !window.confirm(`Delete the category "${category.name}"?`)) return;
    setBusy(true);
    try {
      await adminApi.delete(`/api/admin/categories/${category.id}`);
      onSaved();
    } catch (err) {
      setError(adminError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 p-6">
      <h2 className="font-display text-2xl font-bold">{category ? "Edit category" : "New category"}</h2>
      <label className={label}>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={field} /></label>
      <label className={label}>Short subtitle (optional)<input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} className={field} /></label>
      <label className={label}>Order on menu (small number = first)<input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={field} /></label>
      {error && <p role="alert" className="rounded-xl bg-[#FBEAE8] p-3 text-sm text-nonveg">{error}</p>}
      <div className="flex gap-3 pt-2">
        {category && <button type="button" onClick={remove} disabled={busy} className="h-12 rounded-full px-4 text-sm font-semibold text-nonveg hover:bg-[#FBEAE8]">Delete</button>}
        <button type="button" onClick={onClose} className="ml-auto h-12 rounded-full border border-line px-5 font-medium">Cancel</button>
        <button type="submit" disabled={busy} className={`${btnPrimary} px-8`}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
