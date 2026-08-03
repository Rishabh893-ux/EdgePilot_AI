"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

function SettingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.10)", padding: "24px 28px", marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#00d4ff", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</h2>
      {children}
    </div>
  )
}

function SliderRow({ label, value, min, max, unit, onChange, disabled, warn, crit }: any) {
  const pct = ((value - min) / (max - min)) * 100
  const color = crit && value >= crit ? "#ff2d55" : warn && value >= warn ? "#ffb800" : "#00d4ff"
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: "#8899bb" }}>{label}</label>
        <span style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "monospace" }}>
          {value} <span style={{ fontSize: 11, color: "#4a5a7a" }}>{unit}</span>
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a3a5a", marginTop: 3 }}>
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [thresholds, setThresholds] = useState({ temp: 80, vib: 6, rpm: 1400, current: 18, power: 20 })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [sysStatus, setSysStatus] = useState<any>(null)
  const [pollInterval, setPollInterval] = useState(5)
  const [notifications, setNotifications] = useState({ email: true, critical: true, maintenance: false })
  const [darkMode, setDarkMode] = useState(true)
  const [unit, setUnit] = useState<"celsius" | "fahrenheit">("celsius")
  const [buildTs] = useState(() => new Date().toLocaleString())

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
    api.getThresholds().then(s => setThresholds(t => ({
      ...t,
      temp: s.temp_limit || 80,
      vib: s.vib_limit || 6,
      rpm: s.rpm_min || 1400,
    }))).catch(() => { })
    api.systemStatus().then(s => setSysStatus(s)).catch(() => { })
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  const save = async () => {
    setLoading(true)
    try {
      await api.updateThresholds("machine_001", {
        temp_limit: thresholds.temp,
        vib_limit: thresholds.vib,
        rpm_min: thresholds.rpm,
      } as any)
      setToast({ msg: "✅ Thresholds saved successfully!", ok: true })
    } catch {
      setToast({ msg: "❌ Failed to save — check backend connection.", ok: false })
    }
    setLoading(false)
  }

  if (!user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8899bb" }}>Loading...</div>

  const canEdit = user.role === "admin" || user.role === "operator"
  const perms = PERMISSIONS[user.role]

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, background: "#0d1526",
          border: `1px solid ${toast.ok ? "#00d4ff" : "#ff2d55"}`, borderRadius: 10,
          padding: "10px 18px", fontSize: 13, color: toast.ok ? "#00d4ff" : "#ff2d55",
          zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", animation: "slide-up 0.3s ease-out",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>⚙️ System Settings</h1>
        <p style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>Configure machine thresholds, preferences, and system diagnostics</p>
      </div>

      {/* Role + access */}
      <div style={{ background: `${perms.color}12`, border: `1px solid ${perms.color}30`, borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20 }}>{user.role === "admin" ? "👑" : user.role === "operator" ? "🔧" : "👁"}</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: perms.color, margin: 0 }}>{perms.label} Access — @{user.username}</p>
          <p style={{ fontSize: 11, color: "#8899bb", marginTop: 2 }}>
            {canEdit ? "You can modify alert thresholds and machine configuration." : "You have read-only access. Contact an Admin to change settings."}
          </p>
        </div>
      </div>

      {/* Alert Thresholds */}
      <SettingCard title="🚨 Machine Alert Thresholds">
        <SliderRow label="Max Temperature" value={thresholds.temp} min={50} max={120} unit="°C" onChange={(v: number) => setThresholds(t => ({ ...t, temp: v }))} disabled={!canEdit} warn={75} crit={90} />
        <SliderRow label="Max Vibration" value={thresholds.vib} min={1} max={12} unit="mm/s" onChange={(v: number) => setThresholds(t => ({ ...t, vib: v }))} disabled={!canEdit} warn={5} crit={8} />
        <SliderRow label="Min Spindle RPM" value={thresholds.rpm} min={500} max={3000} unit="RPM" onChange={(v: number) => setThresholds(t => ({ ...t, rpm: v }))} disabled={!canEdit} />
        <SliderRow label="Max Motor Current" value={thresholds.current} min={5} max={30} unit="A" onChange={(v: number) => setThresholds(t => ({ ...t, current: v }))} disabled={!canEdit} warn={18} crit={25} />
        <SliderRow label="Max Power Draw" value={thresholds.power} min={5} max={50} unit="kW" onChange={(v: number) => setThresholds(t => ({ ...t, power: v }))} disabled={!canEdit} warn={35} crit={45} />

        {canEdit ? (
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={save} disabled={loading} className="ep-btn ep-btn-primary" style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? "Saving..." : "💾 Save Thresholds"}
            </button>
            <button onClick={() => setThresholds({ temp: 80, vib: 6, rpm: 1400, current: 18, power: 20 })} className="ep-btn ep-btn-ghost">
              ↺ Reset to Defaults
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#ff2d55", marginTop: 8 }}>🔒 Admin or Operator role required to modify thresholds.</p>
        )}
      </SettingCard>

      {/* Display Preferences */}
      <SettingCard title="🎨 Display Preferences">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: "#8899bb", marginBottom: 10, display: "block" }}>Theme</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Dark", "Light"].map(t => (
                <button key={t} onClick={() => setDarkMode(t === "Dark")} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: (t === "Dark") === darkMode ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${(t === "Dark") === darkMode ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.07)"}`,
                  color: (t === "Dark") === darkMode ? "#00d4ff" : "#8899bb",
                }}>{t === "Dark" ? "🌙 Dark" : "☀️ Light"}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#8899bb", marginBottom: 10, display: "block" }}>Temperature Unit</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["celsius", "fahrenheit"] as const).map(u => (
                <button key={u} onClick={() => setUnit(u)} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: unit === u ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${unit === u ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.07)"}`,
                  color: unit === u ? "#00d4ff" : "#8899bb",
                }}>{u === "celsius" ? "°C Celsius" : "°F Fahrenheit"}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#8899bb", marginBottom: 10, display: "block" }}>
              Poll Interval: <strong style={{ color: "#00d4ff" }}>{pollInterval}s</strong>
            </label>
            <input type="range" min={2} max={30} value={pollInterval} onChange={e => setPollInterval(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#00d4ff" }} />
          </div>
        </div>
      </SettingCard>

      {/* Notifications */}
      <SettingCard title="🔔 Notification Preferences">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {([
            { key: "email", label: "Email Alerts", desc: "Receive email when critical alerts are triggered" },
            { key: "critical", label: "Critical Alert Popups", desc: "Show browser toast for CRITICAL events" },
            { key: "maintenance", label: "Maintenance Reminders", desc: "Daily maintenance schedule reminders" },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#c0d0e8", margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: "#4a5a7a", marginTop: 2 }}>{desc}</p>
              </div>
              <button
                onClick={() => setNotifications(n => ({ ...n, [key]: !n[key] }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: notifications[key] ? "#00d4ff" : "#1a2744",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: notifications[key] ? 22 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s", display: "block"
                }} />
              </button>
            </div>
          ))}
        </div>
      </SettingCard>

      {/* System Diagnostics */}
      <SettingCard title="🖥 System Diagnostics">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "Backend Status", value: sysStatus ? "🟢 Online" : "⚪ Unknown", color: sysStatus ? "#00ff88" : "#8899bb" },
            { label: "Machine ID", value: "machine_001", color: "#00d4ff" },
            { label: "API Version", value: sysStatus?.version || "v1.0", color: "#a855f7" },
            { label: "Total Readings", value: sysStatus?.total_readings ?? "—", color: "#ffb800" },
            { label: "Active Alerts", value: sysStatus?.active_alerts ?? "—", color: "#ff2d55" },
            { label: "Session Built", value: buildTs, color: "#8899bb" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", padding: "12px 14px" }}>
              <p style={{ fontSize: 10, color: "#4a5a7a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color }}>{String(value)}</p>
            </div>
          ))}
        </div>
        <button onClick={() => api.systemStatus().then(s => setSysStatus(s))} className="ep-btn ep-btn-ghost" style={{ marginTop: 16 }}>
          🔄 Refresh Status
        </button>
      </SettingCard>

      {/* Danger Zone (admin only) */}
      {user.role === "admin" && (
        <SettingCard title="⛔ Danger Zone">
          <p style={{ fontSize: 12, color: "#8899bb", marginBottom: 16 }}>These actions are irreversible. Proceed with caution.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => { if (confirm("Clear ALL alert cache? This cannot be undone.")) setToast({ msg: "Cache cleared (simulated).", ok: true }) }}
              style={{ background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.3)", color: "#ff2d55", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              🗑 Clear Alert Cache
            </button>
            <button onClick={() => { if (confirm("Reset ML model training? Machine will go to untrained state.")) setToast({ msg: "ML model reset (simulated).", ok: true }) }}
              style={{ background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.3)", color: "#ff2d55", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              🧠 Reset ML Model
            </button>
          </div>
        </SettingCard>
      )}

      {/* Footer branding */}
      <div style={{ marginTop: 32, textAlign: "center", padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p style={{ fontSize: 11, color: "#2a3a5a" }}>EdgePilot AI · Industrial IoT Intelligence Platform · v1.0.0</p>
        <p style={{ fontSize: 10, color: "#1a2744", marginTop: 4 }}>Built with Next.js 14 · FastAPI · SQLite · Gemini AI · Recharts</p>
      </div>
    </div>
  )
}
