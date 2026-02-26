import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.test into process.env before tests run
try {
  const envPath = resolve(process.cwd(), '.env.test');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch {
  // No .env.test — rely on environment variables already set
}
