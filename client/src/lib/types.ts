export interface AddOn { id: string; name: string; price: number }
export interface MenuItem {
  id: string; name: string; description?: string; price: number;
  isVeg: boolean; image?: string; available: boolean; addOns: AddOn[]; emoji?: string;
}
export interface Category { id: string; name: string; description?: string; items: MenuItem[] }
export interface MenuResponse {
  hotel: { name: string };
  restaurant: {
    id: string; name: string; tagline?: string; isOpen: boolean; gstPercent: number;
    // Why ordering is off ("closed" = shut today, "paused" = kitchen break, "hours" = outside opening hours) and the text to show.
    closedReason: "closed" | "paused" | "hours" | null; closedMessage: string | null; hoursText: string | null;
  };
  room: { number: string };
  categories: Category[];
}

export interface StaffUser { id: string; name: string; email: string; role: "owner" | "manager" | "kitchen"; restaurantId: string }
export interface OpeningHours { enabled: boolean; open: string; close: string } // 24h "HH:MM", India time
export interface AdminSettings {
  name: string; isOpen: boolean; ordersPaused: boolean; hours: OpeningHours;
  kitchen: { open: boolean; reason: "closed" | "paused" | "hours" | null; message: string | null; opensAt: string | null };
}

// Menu management (staff only). `stock` is portions left; null means not tracked. Guests never see it.
export interface AdminItem {
  id: string; categoryId: string; name: string; description: string; price: number; isVeg: boolean;
  image: string; available: boolean; stock: number | null; sortOrder: number; addOns: AddOn[];
}
export interface AdminCategory { id: string; name: string; description: string; sortOrder: number }

export type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered" | "rejected" | "cancelled";
export interface Order {
  id: string; orderNumber: number; roomNumber: string; status: OrderStatus;
  items: { name: string; isVeg: boolean; qty: number; addOns: { name: string; price: number }[]; note?: string; lineTotal: number }[];
  subtotal: number; tax: number; total: number; notes?: string; guestName?: string;
  paymentMethod: string; prepMins: number; rejectReason?: string;
  statusHistory: { status: OrderStatus; at: string }[];
  createdAt: string; updatedAt: string;
}

// What staff see: a guest order plus the guest's phone number.
export type AdminOrder = Order & { guestPhone?: string };
