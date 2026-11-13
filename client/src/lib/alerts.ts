// New-order alerts: a short beep made with the Web Audio API (no audio file) and a browser notification.
// Browsers only allow sound/notifications after a user gesture, so enableAlerts() must run from a click.

let ctx: AudioContext | null = null;

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window && window.isSecureContext;

export async function enableAlerts(): Promise<{ sound: boolean; notifications: NotificationPermission | "unsupported" }> {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new Ctor();
    await ctx.resume();
    beep(); // confirmation chirp
  } catch {
    ctx = null;
  }
  let notifications: NotificationPermission | "unsupported" = "unsupported";
  if (notificationsSupported()) {
    try { notifications = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission; } catch { /* ignore */ }
  }
  return { sound: ctx?.state === "running", notifications };
}

export const soundReady = () => ctx?.state === "running";

function tone(c: AudioContext, freq: number, start: number, dur: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

// Two-note chime.
export function beep() {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  tone(ctx, 880, t, 0.18);
  tone(ctx, 1175, t + 0.2, 0.3);
}

export function notify(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag: "new-order" }); } catch { /* some browsers need a service worker */ }
}
