import { brand, phoneHref } from "@/config/brand";

// Landing page: guests normally arrive via their room QR link, not here.
export default function Home() {
  const steps = [
    ["Scan", "Scan the QR code on the card in your room."],
    ["Order", "Browse the menu and add dishes to your cart."],
    ["Relax", "Track your order live until it reaches your door."],
  ];
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent-dark">{brand.hotelName}</p>
      <h1 className="mt-3 font-display text-4xl leading-tight">{brand.restaurantName}</h1>
      <p className="mt-3 text-muted">In-room dining, straight from our kitchen to your door.</p>

      <ol className="mt-10 space-y-5">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-accent-dark">{i + 1}</span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        Each room has its own private link, like{" "}
        <span className="break-all font-mono text-xs text-ink">/menu?t=your-room-code</span>. If you can&apos;t scan the
        QR code, please call the front desk.
      </div>
      <a href={phoneHref} className="mt-6 inline-flex h-12 items-center justify-center rounded-full border border-accent px-6 font-medium text-accent-dark">
        Call {brand.restaurantName}
      </a>
    </main>
  );
}
