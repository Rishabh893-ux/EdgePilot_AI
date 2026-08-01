/**
 * EdgePilot AI — API Helper
 *
 * The backend URL is loaded from frontend/.env
 * Change NEXT_PUBLIC_API_URL in that file if your backend
 * runs on a different port or machine.
 *
 * Default: http://localhost:8000
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const api = {

  // ── Auth ─────────────────────────────────────────────────────
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

  // ── Dashboard (single call — all data) ────────────────────────
  dashboard: () =>
    fetch(`${BASE}/api/dashboard`, { cache: "no-store" }).then(r => r.json()),

  fleet: () =>
    fetch(`${BASE}/api/fleet`, { cache: "no-store" }).then(r => r.json()),

  // ── Sensor trend (for charts) ──────────────────────────────────
  trend: (n = 25) =>
    fetch(`${BASE}/api/machine/machine_001/trend?n=${n}`, { cache: "no-store" }).then(r => r.json()),

  // ── Alerts ────────────────────────────────────────────────────
  alerts: (limit = 15) =>
    fetch(`${BASE}/api/machine/machine_001/alerts?limit=${limit}`, { cache: "no-store" }).then(r => r.json()),

  acknowledgeAlert: (id: number) =>
    fetch(`${BASE}/api/alerts/${id}/acknowledge`, { method: "POST" }),

  // ── Failure Story ─────────────────────────────────────────────
  story: () =>
    fetch(`${BASE}/api/machine/machine_001/failure-story`, { cache: "no-store" }).then(r => r.json()),

  // ── Maintenance log ───────────────────────────────────────────
  maintenance: () =>
    fetch(`${BASE}/api/machine/machine_001/maintenance`, { cache: "no-store" }).then(r => r.json()),

  // ── Recommendations ───────────────────────────────────────────
  recommendations: () =>
    fetch(`${BASE}/api/machine/machine_001/recommendations`, { cache: "no-store" }).then(r => r.json()),

  notifications: () =>
    fetch(`${BASE}/api/machine/machine_001/notifications`, { cache: "no-store" }).then(r => r.json()),

  safety: () =>
    fetch(`${BASE}/api/machine/machine_001/safety`, { cache: "no-store" }).then(r => r.json()),

  // ── PPE Violations ────────────────────────────────────────────
  violations: () =>
    fetch(`${BASE}/api/violations`, { cache: "no-store" }).then(r => r.json()),

  // ── AI Copilot ────────────────────────────────────────────────
  copilot: (question: string, machineId = "machine_001") =>
    fetch(`${BASE}/api/copilot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machine_id: machineId, question }),
    }).then(r => r.json()),

  // ── ML Model ─────────────────────────────────────────────────
  mlStatus: () =>
    fetch(`${BASE}/api/ml/status`, { cache: "no-store" }).then(r => r.json()),

  trainModel: () =>
    fetch(`${BASE}/api/machine/machine_001/train`, { method: "POST" }).then(r => r.json()),

  // ── System Status ─────────────────────────────────────────────
  systemStatus: () =>
    fetch(`${BASE}/api/status`, { cache: "no-store" }).then(r => r.json()),

}
