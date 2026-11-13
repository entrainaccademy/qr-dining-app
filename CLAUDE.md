# QR In-Room Dining (client demo)

## What this is
A hotel guest scans a printed QR code in their room, opens a mobile web menu (no install, no login), places a food order, and the restaurant's staff receive it live on an admin dashboard and update its status. The guest sees live status updates.

## Structure
- /client: Next.js 16 (App Router) + Tailwind. Guest pages (/menu?t=token, /order/[id]), admin pages (/admin), hotel view (/hotel). Uses axios, socket.io-client, zustand. Read /client/AGENTS.md before writing Next.js code.
- /server: Node + Express + MongoDB (Mongoose, Atlas) + Socket.io. CommonJS. JWT auth with roles (owner, manager, kitchen). Zod validation, helmet, cors, rate limiting, qrcode + pdfkit.
- Do not use Next.js API routes. All API and socket logic lives in /server.
- Server env is in server/.env (MONGO_URI, JWT_SECRET, CLIENT_URL, PORT=5000). Client env in client/.env.local (NEXT_PUBLIC_API_URL). NEVER print, log or commit secrets.

## Key rules
- Room is identified only by a random token in the QR URL, never a plain room number.
- Server recalculates all prices and totals; never trust client prices.
- Orders flow: received -> preparing -> out_for_delivery -> delivered (or rejected/cancelled). Emit Socket.io "order:new" and "order:updated"; rooms are restaurant:{id} and order:{id}.
- Max 3 active orders per room; rate-limit order endpoints.
- Currency is INR (₹), GST 5%.
- Design: premium hospitality look (warm neutrals + gold accent), mobile-first at 360px for guests, tablet/desktop for admin. Branding configurable in one config file.

## Current status
- Done: Next.js client, Express + Mongoose server, Atlas connected, seed script (`npm run seed`, keeps room tokens), public API (menu by token, place order, get order), guest app (/menu, cart, checkout, /order/[id]), QR + printable room cards (`npm run qr`, `npm run poster`, `--lan` for phone testing), `npm run lan` (updates env files to this PC's Wi-Fi IP + regenerates QR/cards).
- Done: staff auth (POST /api/auth/login, JWT 12h, roles), /api/admin/orders + status transitions + settings (pause ordering), Socket.io (staff JWT handshake -> restaurant:{id}; guests join order:{id}), /admin/login + /admin live board (beep, notification, accept with prep time, reject with reason), guest live tracking over Socket.io with polling fallback.
- Seeded staff logins: owner@, manager@, kitchen@grandstay.test (demo passwords in server/src/seed.js).
- Next: (3) rooms/QR management page, (4) menu stock toggles, (5) reports, (6) deployment.

## Working style
- Build in small steps, run and test each before moving on. Tell me what you changed and how to test it.
- Keep code simple and commented where it is non-obvious. Ask before adding new packages.