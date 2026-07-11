import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const PORT = 1420;
const HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function isViteDevServer() {
  for (const host of HOSTS) {
    try {
      const res = await fetch(`http://${host}:${PORT}/`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes('/@vite/client') || html.includes('/src/main.tsx')) return true;
    } catch {
    }
  }
  return false;
}

function killPortWindows(port) {
  try {
    const out = execSync(`netstat -ano -p tcp | findstr ":${port}"`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const pid = Number(line.trim().split(/\s+/).at(-1));
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Killed process ${pid} on port ${port}`);
      } catch {
        console.warn(`Could not kill PID ${pid} (port ${port}). Close it in Task Manager if dev fails.`);
      }
    }
  } catch {
  }
}

async function isPortInUse() {
  for (const host of HOSTS) {
    if (await portOpen(host, PORT)) return true;
  }
  return false;
}

async function waitForPortFree(maxMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (!(await isPortInUse())) return true;
    await sleep(250);
  }
  return !(await isPortInUse());
}

async function main() {
  if (await isViteDevServer()) {
    console.log(`Vite already running on http://localhost:${PORT} - reusing it`);
    await new Promise(() => {});
    return;
  }

  if (await isPortInUse()) {
    try {
      execSync(`npx --yes kill-port ${PORT}`, { stdio: 'inherit' });
    } catch {
    }
    killPortWindows(PORT);
    const free = await waitForPortFree();
    if (!free) {
      console.error(`Port ${PORT} is still in use. End the node.exe process in Task Manager, then retry.`);
      process.exit(1);
    }
  }

  const vite = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
  });

  vite.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});