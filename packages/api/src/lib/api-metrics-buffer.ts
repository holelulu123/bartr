// Ring buffer for API request events (response time + status code).
// `recordRequest` is called from the Fastify onResponse hook.
// `drainSince` is called by the metrics-collector every 5s.

const MAX_ENTRIES = 10_000;

interface RequestEvent {
  ts: number;
  duration_ms: number;
  status: number;
}

const buffer: RequestEvent[] = new Array(MAX_ENTRIES);
let writeIdx = 0;
let count = 0;

export function recordRequest(duration_ms: number, status: number): void {
  buffer[writeIdx] = { ts: Date.now(), duration_ms, status };
  writeIdx = (writeIdx + 1) % MAX_ENTRIES;
  if (count < MAX_ENTRIES) count++;
}

/**
 * Returns all events recorded since `since` (epoch ms), oldest-first.
 * Non-destructive — the ring buffer keeps rolling.
 */
export function drainSince(since: number): RequestEvent[] {
  const result: RequestEvent[] = [];
  const start = count < MAX_ENTRIES ? 0 : writeIdx;
  for (let i = 0; i < count; i++) {
    const idx = (start + i) % MAX_ENTRIES;
    const evt = buffer[idx];
    if (evt.ts >= since) {
      result.push(evt);
    }
  }
  return result;
}

/** Reset for testing. */
export function _resetBuffer(): void {
  writeIdx = 0;
  count = 0;
}
