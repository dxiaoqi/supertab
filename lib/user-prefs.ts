export type PreferenceSuggestion = { suggestion: string; score: number } | null;

const STORAGE_KEY = "supertab_user_prefs_v1";
const MAX_PREFIXES = 500; // LRU cap
const MAX_SUG_PER_PREFIX = 5;
const DECAY_HALF_LIFE_DAYS = 21; // weight halves every 21 days

type SuggestEntry = { w: number; t: number };
type PrefixEntry = Record<string, SuggestEntry>; // suggestion -> entry
type Model = {
  v: 1;
  order: string[]; // LRU by prefix
  items: Record<string, PrefixEntry>;
};

function now(): number {
  return Date.now();
}

function decayFactor(sinceMs: number): number {
  const days = sinceMs / (1000 * 60 * 60 * 24);
  const halfLife = DECAY_HALF_LIFE_DAYS;
  return Math.pow(0.5, days / halfLife);
}

function load(): Model {
  if (typeof window === "undefined") return { v: 1, order: [], items: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { v: 1, order: [], items: {} };
    const parsed = JSON.parse(raw) as Model;
    if (!parsed || parsed.v !== 1 || !parsed.items) return { v: 1, order: [], items: {} };
    return parsed;
  } catch {
    return { v: 1, order: [], items: {} };
  }
}

function save(m: Model) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {}
}

function normalizePrefix(prefix: string): string {
  // keep last 64 chars, collapse spaces
  const tail = prefix.slice(-64);
  return tail.replace(/\s+/g, " ").trim();
}

function touchLRU(m: Model, key: string) {
  const idx = m.order.indexOf(key);
  if (idx >= 0) m.order.splice(idx, 1);
  m.order.unshift(key);
  while (m.order.length > MAX_PREFIXES) {
    const drop = m.order.pop();
    if (drop) delete m.items[drop];
  }
}

export function recordAccept(prefix: string, suggestion: string) {
  if (!prefix || !suggestion) return;
  const m = load();
  const key = normalizePrefix(prefix);
  const entry = (m.items[key] = m.items[key] || {});
  const nowMs = now();
  const e = (entry[suggestion] = entry[suggestion] || { w: 0, t: nowMs });
  // apply decay to existing weight before adding
  e.w = e.w * decayFactor(nowMs - e.t) + 1.0;
  e.t = nowMs;
  prune(entry);
  touchLRU(m, key);
  save(m);
}

export function recordReject(prefix: string, suggestion: string) {
  if (!prefix || !suggestion) return;
  const m = load();
  const key = normalizePrefix(prefix);
  const entry = (m.items[key] = m.items[key] || {});
  const nowMs = now();
  const e = (entry[suggestion] = entry[suggestion] || { w: 0, t: nowMs });
  e.w = e.w * decayFactor(nowMs - e.t) - 0.35; // small negative reinforcement
  if (e.w < 0) e.w = 0;
  e.t = nowMs;
  prune(entry);
  touchLRU(m, key);
  save(m);
}

function prune(entry: PrefixEntry) {
  const keys = Object.keys(entry);
  if (keys.length <= MAX_SUG_PER_PREFIX) return;
  keys
    .sort((a, b) => entry[b].w - entry[a].w)
    .slice(MAX_SUG_PER_PREFIX)
    .forEach((k) => delete entry[k]);
}

export function getPreferenceSuggestion(prefix: string): PreferenceSuggestion {
  const m = load();
  const key = normalizePrefix(prefix);
  const entry = m.items[key];
  if (!entry) return null;
  const nowMs = now();
  const scored = Object.entries(entry).map(([sugg, { w, t }]) => {
    const wDecayed = w * decayFactor(nowMs - t);
    return [sugg, wDecayed] as const;
  });
  if (scored.length === 0) return null;
  scored.sort((a, b) => b[1] - a[1]);
  const [sugg, w] = scored[0];
  const score = 1 - Math.exp(-w); // map to 0..1
  return { suggestion: sugg, score };
}


