// In-process fixed-window counter — no Redis dependency exists anywhere in this project yet
// (docker-compose.yml has only postgres + temporal), and v1 traffic doesn't need one. Revisit
// if a second apps/api instance ever makes in-process state insufficient.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

const buckets = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(key: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  bucket.count++;
  return true;
}
