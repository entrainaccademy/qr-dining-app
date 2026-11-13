import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

// Opens a Socket.io connection to the API server.
// Pass a staff JWT to receive the restaurant's live order events; omit it for guest tracking.
export function connectSocket(token?: string): Socket {
  return io(API_URL, { auth: token ? { token } : undefined, reconnectionDelayMax: 5000 });
}
