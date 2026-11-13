// One command to get the phone demo working after your PC's Wi-Fi address changes:
//   npm run lan
// 1. finds this PC's current Wi-Fi/LAN IPv4 address
// 2. updates PUBLIC_BASE_URL + CLIENT_URL in server/.env and NEXT_PUBLIC_API_URL in client/.env.local
// 3. regenerates the QR codes (PNG) and printable room cards (PDF)
// Only these three keys are touched, and no secret values are ever printed.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectLanIp } = require('./qr-common');

const SERVER_ENV = path.join(__dirname, '.env');
const CLIENT_ENV = path.join(__dirname, '..', 'client', '.env.local');

// Sets KEY=value in an env file: replaces the existing line (all copies collapse to one) or appends it.
function setEnvKey(file, key, value) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const re = new RegExp(`^\\s*${key}\\s*=`);
  let done = false;
  const out = [];
  for (const line of lines) {
    if (re.test(line)) {
      if (!done) out.push(`${key}=${value}`);
      done = true; // drop duplicate copies of the same key
    } else out.push(line);
  }
  if (!done) {
    while (out.length && out[out.length - 1] === '') out.pop();
    out.push(`${key}=${value}`, '');
  }
  fs.writeFileSync(file, out.join(eol));
}

function main() {
  const found = detectLanIp();
  if (!found.length) {
    console.error('Could not find a Wi-Fi/LAN IPv4 address. Connect this PC to Wi-Fi and try again.');
    process.exit(1);
  }
  const { name, ip } = found[0];
  console.log(`Using ${name}: ${ip}`);
  if (found.length > 1) console.log(`(other candidates ignored: ${found.slice(1).map((f) => `${f.name} ${f.ip}`).join(', ')})`);

  const web = `http://${ip}:3000`;
  setEnvKey(SERVER_ENV, 'PUBLIC_BASE_URL', web);
  setEnvKey(SERVER_ENV, 'CLIENT_URL', `http://localhost:3000,${web}`);
  setEnvKey(CLIENT_ENV, 'NEXT_PUBLIC_API_URL', `http://${ip}:5000`);
  console.log('Updated: PUBLIC_BASE_URL, CLIENT_URL (server/.env) and NEXT_PUBLIC_API_URL (client/.env.local)\n');

  // Child processes re-read server/.env, so they pick up the new PUBLIC_BASE_URL.
  for (const script of ['make-qr.js', 'make-poster.js']) {
    const r = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit', cwd: __dirname });
    if (r.status !== 0) {
      console.error(`\n${script} failed (see above). If it says the IP is not whitelisted, add your IP in MongoDB Atlas > Network Access.`);
      process.exit(r.status || 1);
    }
  }

  console.log(`
Done. Now:
  1. Restart the client dev server (Ctrl+C, then npm run dev in /client) - Next.js reads .env.local only at start.
  2. Restart the API server (type rs + Enter in its terminal, or Ctrl+C and npm run dev in /server).
  3. Open on your phone: ${web}/menu?t=<room token>   (or scan qr-output/poster-room-<n>.pdf)
  Staff board: ${web}/admin/login  (use http://localhost:3000/admin on the laptop so browser notifications work)`);
}

main();
