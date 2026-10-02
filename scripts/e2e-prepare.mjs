// Checks the API (:4000) and Mailpit (:8025) are up, then seeds the fixture problems.
// CAN_SERVER_DIR (default ../can_server) is the server checkout whose `seed` script runs.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const MAIL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
const serverDir = resolve(process.env.CAN_SERVER_DIR ?? '../can_server');

async function up(name, url) {
  try {
    const r = await fetch(url);
    if (r.status < 500) return;
    // /health answers 503 with a body when a dependency is down: still "reachable" but not ready.
  } catch {}
  console.error(
    `e2e-prepare: ${name} is not reachable at ${url}. Start it first (docker compose up in can_server, then npm run start:dev).`,
  );
  process.exit(1);
}

await up('API', `${API}/health`);
await up('Mailpit', `${MAIL}/api/v1/info`);

const seed = spawnSync('npm', ['--prefix', serverDir, 'run', 'seed', '--', '--fixture'], {
  stdio: 'inherit',
});
process.exit(seed.status ?? 1);
