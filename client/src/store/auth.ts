import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StaffUser } from "@/lib/types";

// Staff session, kept in this browser's localStorage. The server checks the JWT on every request.
interface AuthState {
  token: string | null;
  user: StaffUser | null;
  setAuth: (token: string, user: StaffUser) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "qr-dining-staff" },
  ),
);
