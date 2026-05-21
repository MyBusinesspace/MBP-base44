/**
 * Frees API_PORT (default 3001) before starting dev:local.
 * Safe to run when nothing is listening.
 */
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const port = String(process.env.API_PORT || 3001);

function killOnWindows() {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}" | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Stopped process ${pid} on port ${port}`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* no listener */
  }
}

function killOnUnix() {
  try {
    const pid = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (pid) {
      execSync(`kill -9 ${pid.split('\n').join(' ')}`);
      console.log(`Stopped process on port ${port}`);
    }
  } catch {
    /* no listener */
  }
}

if (process.platform === 'win32') killOnWindows();
else killOnUnix();
