// Is the kitchen taking orders right now? One place decides this for the menu, checkout and admin.
const TZ = 'Asia/Kolkata'; // opening hours are always in hotel local time, whatever the server's clock says

const toMins = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

// Current minutes since midnight in India.
function nowMins(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') * 60 + get('minute');
}

// "23:30" -> "11:30 PM"
function pretty(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// Returns { open, reason, message, opensAt }. reason is 'closed' | 'paused' | 'hours' | null.
function kitchenState(restaurant, date = new Date()) {
  if (restaurant.isOpen === false) return { open: false, reason: 'closed', message: 'The restaurant is closed today.', opensAt: null };
  if (restaurant.ordersPaused) return { open: false, reason: 'paused', message: 'The kitchen is paused right now. Please try again in a few minutes.', opensAt: null };

  const h = restaurant.hours;
  if (h && h.enabled && h.open && h.close) {
    const now = nowMins(date), start = toMins(h.open), end = toMins(h.close);
    // close < open means the kitchen runs past midnight (e.g. 18:00 - 02:00).
    const inside = start <= end ? now >= start && now < end : now >= start || now < end;
    if (!inside) {
      return { open: false, reason: 'hours', message: `The kitchen is closed. Orders open at ${pretty(h.open)}.`, opensAt: pretty(h.open) };
    }
  }
  return { open: true, reason: null, message: null, opensAt: null };
}

module.exports = { kitchenState, pretty };
