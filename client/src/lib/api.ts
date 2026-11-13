import axios from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

export type ErrorContext = "menu" | "order" | "track";

// Turns any API/network failure into a message that is safe to show a guest.
export function friendlyError(err: unknown, context: ErrorContext = "order"): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const serverMsg = (err.response?.data as { error?: string } | undefined)?.error;
    if (!err.response) return "We can't reach the restaurant right now. Please check your connection and try again.";
    if (status === 404) {
      return context === "track" ? "We couldn't find that order." : "This QR code is no longer valid. Please ask the front desk for help.";
    }
    if (status === 429) return serverMsg || "You have too many orders in progress. Please wait for one to arrive before ordering again.";
    if (status === 400) {
      return serverMsg && !serverMsg.startsWith("Invalid order")
        ? serverMsg
        : "Something in your order doesn't look right. Please review your cart and try again.";
    }
    if (status === 409) return serverMsg || "The kitchen isn't taking orders right now.";
  }
  return "Something went wrong. Please try again.";
}
