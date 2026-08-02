/**
 * EdgePilot AI — API Helper with In-Memory Cache
 *
 * GET requests are cached client-side for `DEFAULT_TTL` ms.
 * This means switching tabs shows data immediately from cache
 * while a background refresh happens silently.
 *
 * POST/mutation requests are never cached.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ── Cache ──────────────────────────────────────────────────────────
const DEFAULT_TTL = 5_000   // 5s for fast-changing sensor data
const SLOW_TTL    = 30_000  // 30s for rarely-changing data

interface CacheEntry { data: any; ts: number; ttl: number }
const _cache = new Map<string, CacheEntry>()

function getCached(key: string): any | null {
  const e = _cache.get(key)
  if (!e) return null
  if (Date.now() - e.ts > e.ttl) { _cache.delete(key); return null }
  return e.data
}

function setCached(key: string, data: any, ttl = DEFAULT_TTL) {
  _cache.set(key, { data, ts: Date.now(), ttl })
}

async function cachedFetch(key: string, url: string, ttl = DEFAULT_TTL): Promise<any> {
  const hit = getCached(key)
  if (hit !== null) return hit          // instant return from cache
  const data = await fetch(url, { cache: "no-store" }).then(r => r.json())
  setCached(key, data, ttl)
  return data
}

// ── Public cache utils ─────────────────────────────────────────────
export const apiCache = {
  /** Invalidate a specific key or all keys matching a prefix */
  invalidate: (prefix?: string) => {
    if (!prefix) { _cache.clear(); return }
    for (const k of Array.from(_cache.keys())) { if (k.startsWith(prefix)) _cache.delete(k) }
  },
  /** Force-refresh a key next time it's requested */
  bust: (key: string) => _cache.delete(key),
  /** How many entries are currently cached */
  size: () => _cache.size,
}

// ── API ────────────────────────────────────────────────────────────
export const api = {

  // ── Auth (never cached — mutations) ──────────────────────────────
  login: (username: string, password: string) =>
    fetch(`${BASE}/api/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
      method: "POST",
    }).then(r => r.json()),

  logout: (token: string) =>
    fetch(`${BASE}/api/auth/logout?token=${encodeURIComponent(token)}`, { method: "POST" }).then(r => r.json()),

  me: (token: string) =>
    fetch(`${BASE}/api/auth/me?token=${encodeURIComponent(token)}`, { cache: "no-store" }).then(r => r.json()),

  register: (username: string, password: string, role = "viewer") =>
    fetch(`${BASE}/api/auth/register?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&role=${encodeURIComponent(role)}`, {
      method: "POST",
    }).then(r => r.json()),

  // ── Dashboard — cached 5s (real-time sensor data) ─────────────────
  dashboard: () =>
    cachedFetch("dashboard", `${BASE}/api/dashboard`, DEFAULT_TTL),

  // ── Fleet — cached 15s (changes rarely mid-session) ───────────────
  fleet: () =>
    cachedFetch("fleet", `${BASE}/api/fleet`, 15_000),

  export: (machineId = "machine_001", days = 30) => {
    window.open(`${BASE}/api/machine/${machineId}/export?days=${days}`, "_blank")
  },

  // ── Settings ─────────────────────────────────────────────────────
  getThresholds: (machineId = "machine_001") =>
    cachedFetch(`thresholds:${machineId}`, `${BASE}/api/machine/${machineId}/thresholds`, SLOW_TTL),

  updateThresholds: (machineId: string, updates: any[]) => {
    apiCache.invalidate(`thresholds:${machineId}`)
    return fetch(`${BASE}/api/machine/${machineId}/thresholds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).then(r => r.json())
  },

  // ── Sensor trend — cached 5s ──────────────────────────────────────
  trend: (n = 25) =>
    cachedFetch(`trend:${n}`, `${BASE}/api/machine/machine_001/trend?n=${n}`, DEFAULT_TTL),

  // ── Alerts — cached 4s ────────────────────────────────────────────
  alerts: (limit = 15) =>
    cachedFetch(`alerts:${limit}`, `${BASE}/api/machine/machine_001/alerts?limit=${limit}`, 4_000),

  acknowledgeAlert: (id: number) => {
    apiCache.invalidate("alerts")
    return fetch(`${BASE}/api/alerts/${id}/acknowledge`, { method: "POST" })
  },

  // ── Failure story — cached 60s (expensive AI call) ────────────────
  story: () =>
    cachedFetch("story", `${BASE}/api/machine/machine_001/failure-story`, 60_000),

  // ── Maintenance — cached 15s ──────────────────────────────────────
  maintenance: () =>
    cachedFetch("maintenance", `${BASE}/api/machine/machine_001/maintenance`, 15_000),

  // ── Recommendations — cached 10s ─────────────────────────────────
  recommendations: () =>
    cachedFetch("recommendations", `${BASE}/api/machine/machine_001/recommendations`, 10_000),

  // ── Notifications — cached 8s ─────────────────────────────────────
  notifications: () =>
    cachedFetch("notifications", `${BASE}/api/machine/machine_001/notifications`, 8_000),

  // ── Safety — cached 10s ──────────────────────────────────────────
  safety: () =>
    cachedFetch("safety", `${BASE}/api/machine/machine_001/safety`, 10_000),

  // ── PPE Violations — cached 10s ──────────────────────────────────
  violations: () =>
    cachedFetch("violations", `${BASE}/api/violations`, 10_000),

  // ── AI Copilot (POST — never cached) ─────────────────────────────
  copilot: (question: string, machineId = "machine_001") =>
    fetch(`${BASE}/api/copilot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machine_id: machineId, question }),
    }).then(r => r.json()),

  generateWorkOrder: (machineId = "machine_001") =>
    fetch(`${BASE}/api/machine/${machineId}/work-order`, { cache: "no-store" }).then(r => r.json()),

  // ── ML Model — cached 20s ────────────────────────────────────────
  mlStatus: () =>
    cachedFetch("ml_status", `${BASE}/api/ml/status`, 20_000),

  trainModel: () => {
    apiCache.invalidate("ml_status")
    return fetch(`${BASE}/api/machine/machine_001/train`, { method: "POST" }).then(r => r.json())
  },

  // ── System Status — cached 5s ────────────────────────────────────
  systemStatus: () =>
    cachedFetch("system_status", `${BASE}/api/status`, DEFAULT_TTL),

  // ── Control (POST — never cached) ────────────────────────────────
  sendControlCommand: (machineId: string, command: any) =>
    fetch(`${BASE}/api/machine/${machineId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    }).then(r => r.json()),

}
