// Shared helpers for make-qr.js and make-poster.js: parse CLI args and work out the public base URL.
const os = require('os');

// Finds the PC's Wi-Fi/LAN IPv4, skipping virtual adapters (WSL, Docker, VMware, VirtualBox, Hyper-V).
function detectLanIp() {
  const virtual = /vethernet|wsl|docker|vmware|virtualbox|vbox|hyper-v|loopback|tailscale|zerotier|bluetooth/i;
  const privateRange = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const found = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && privateRange.test(a.address)) found.push({ name, ip: a.address });
    }
  }
  // Prefer 192.168.x.x (typical home/office Wi-Fi), then anything else private.
  found.sort((x, y) => Number(y.ip.startsWith('192.168.')) - Number(x.ip.startsWith('192.168.')));
  return found;
}

// Returns { base, wanted } from process.argv. `wanted` = room numbers passed as arguments.
function parseArgs(argv = process.argv.slice(2)) {
  const useLan = argv.includes('--lan');
  const wanted = argv.filter((a) => !a.startsWith('--'));
  let base = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  if (useLan) {
    const candidates = detectLanIp();
    if (!candidates.length) throw new Error('Could not find a LAN IPv4 address. Are you connected to Wi-Fi?');
    base = `http://${candidates[0].ip}:3000`;
    console.log(`LAN adapter: ${candidates[0].name} (${candidates[0].ip})`);
  }
  console.log(`Base URL: ${base}\n`);
  return { base, wanted };
}

module.exports = { detectLanIp, parseArgs };
