import axios from "axios";
import { API_URL } from "./api";
import { useAuth } from "@/store/auth";

// Axios instance for staff endpoints: attaches the JWT and signs the user out if it stops being valid.
export const adminApi = axios.create({ baseURL: API_URL, timeout: 15000 });

adminApi.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (r) => r,
  (err) => {
    const isLogin = String(err?.config?.url ?? "").includes("/auth/login");
    if (axios.isAxiosError(err) && err.response?.status === 401 && !isLogin) useAuth.getState().logout();
    return Promise.reject(err);
  },
);

// Short, human message for a failed staff action.
export function adminError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Can't reach the server. Check the connection and try again.";
    const msg = (err.response.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  return "Something went wrong. Please try again.";
}
