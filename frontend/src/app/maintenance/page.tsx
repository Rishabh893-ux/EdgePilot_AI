"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

const POLL_MS = 10000

const MAINTENANCE_TYPES = ["preventive", "corrective", "inspection", "lubrication", "calibration", "emergency"]
const TYPE_COLORS: Record<string, string> = {
  preventive:  "#00ff88",
  corrective:  "#ff2d55",
  inspection:  "#00d4ff",
  lubrication: "#ffb800",
  calibration: "#a855f7",
  emergency:   "#ff6b35",
}
const TYPE_ICONS: Record<string, string> = {
  preventive:  "🛡",
  corrective:  "🔨",
  inspection:  "🔍",
  lubrication: "💧",
  calibration: "⚖️",
  emergency:   "🚨",
}

interface LogEntry {
  id: number
  timestamp: string
  type?: string
  maintenance_type?: string
  description: string
  performed_by?: string
  technician?: string
  health_before?: number
  health_after?: number
}

interface FormData {
  maintenance_type: string
  description: string
  technician: string
  duration_minutes: string
  parts_used: string
}

export default function MaintenancePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [patterns, setPatterns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [form, setForm] = useState<FormData>({
    maintenance_type: "preventive",
    description: "",
    technician: "",
    duration_minutes: "",
    parts_used: "",
  })

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
    setForm(f => ({ ...f, technician: u.username }))
  }, [router])

  const poll = useCallback(async () => {
    try {
      const m = await api.maintenance()
      setLogs(m.logs || [])
      setPatterns(m.recurring_patterns || [])
      setLoading(false)
    } catch { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) return
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [user, poll])

  const handleSubmit = async () => {
    if (!form.description.trim()) { setSubmitMsg("Please enter a description."); return }
    setSubmitting(true)
    setSubmitMsg("")
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${BASE}/api/machine/machine_001/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenance_type: form.maintenance_type,
          description: form.description,
          performed_by: form.technician,
          duration_minutes: parseInt(form.duration_minutes) || null,
          parts_used: form.parts_used || null,
        }),
      })
      if (res.ok) {
        setSubmitMsg("✅ Maintenance logged successfully!")
        setForm(f => ({ ...f, description: "", duration_minutes: "", parts_used: "" }))
        poll()
        setTimeout(() => { setShowModal(false); setSubmitMsg("") }, 1500)
      } else {
        setSubmitMsg("❌ Failed to save. Check backend.")
      }
    } catch { setSubmitMsg("❌ Network error.") }
    setSubmitting(false)
  }

  if (!user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8899bb" }}>Loading...</div>

  const canLog = PERMISSIONS[user.role]?.canLogMaintenance
  const filtered = filterType === "all" ? logs : logs.filter(l => (l.type || l.maintenance_type) === filterType)

  // Stats
  const typeCounts = MAINTENANCE_TYPES.reduce((acc, t) => {
    acc[t] = logs.filter(l => (l.type || l.maintenance_type) === t).length
    return acc
  }, {} as Record<string, number>)
  const typeChartData = MAINTENANCE_TYPES.map(t => ({ type: t, count: typeCounts[t], color: TYPE_COLORS[t] })).filter(d => d.count > 0)

  const healthDelta = logs
    .filter(l => l.health_before != null && l.health_after != null)
    .map(l => ({ label: `#${l.id}`, before: l.health_before, after: l.health_after, gain: (l.health_after || 0) - (l.health_before || 0) }))
    .slice(-10)

  const lastMaintenance = logs[0]?.timestamp?.slice(0, 10) || "—"
  const totalEmergency = typeCounts["emergency"] || 0
  const avgHealthGain = healthDelta.length
    ? Math.round(healthDelta.reduce((s, h) => s + h.gain, 0) / healthDelta.length * 10) / 10
    : 0

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: "#00ff88", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>🔧 Maintenance Hub</h1>
          <p style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>Work Orders · History · Health Impact · Recurring Patterns</p>
        </div>
        {canLog && (
          <button onClick={() => setShowModal(true)} className="ep-btn ep-btn-primary" style={{ gap: 8 }}>
            + Log Maintenance
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#8899bb" }}>Loading maintenance data...</p>
      ) : (
        <>
          {/* KPI Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Logs", value: logs.length, icon: "📋", color: "#00d4ff" },
              { label: "Last Maintenance", value: lastMaintenance, icon: "🗓", color: "#00ff88", isText: true },
              { label: "Emergency Events", value: totalEmergency, icon: "🚨", color: totalEmergency > 0 ? "#ff2d55" : "#00ff88" },
              { label: "Avg Health Gain", value: `+${avgHealthGain}`, icon: "💚", color: "#00ff88", isText: true },
              { label: "Patterns Found", value: patterns.length, icon: "🔁", color: "#a855f7" },
            ].map(({ label, value, icon, color, isText }) => (
              <div key={label} style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: 0.18 }}>{icon}</div>
                <p style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</p>
                <p style={{ fontSize: isText ? 20 : 30, fontWeight: 800, color, lineHeight: 1 }}>{value ?? "—"}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Type distribution */}
            <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "20px 24px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#00d4ff", marginBottom: 16 }}>📊 Maintenance by Type</p>
              {typeChartData.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "#8899bb", fontSize: 13 }}>No data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={typeChartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#4a5a7a", fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="type" tick={{ fill: "#8899bb", fontSize: 10 }} width={80} />
                    <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                      {typeChartData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Health impact */}
            <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "20px 24px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#00ff88", marginBottom: 16 }}>💚 Health Before vs After</p>
              {healthDelta.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#8899bb", fontSize: 13 }}>No health data tracked yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={healthDelta} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fill: "#8899bb", fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#4a5a7a", fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#8899bb" }} />
                    <ReferenceLine y={70} stroke="#ffb800" strokeDasharray="4 4" />
                    <Bar dataKey="before" name="Before" fill="rgba(255,45,85,0.7)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="after"  name="After"  fill="rgba(0,255,136,0.7)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recurring Patterns */}
          {patterns.length > 0 && (
            <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(168,85,247,0.2)", padding: "20px 24px", marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#a855f7", marginBottom: 16 }}>🔁 Recurring Maintenance Patterns</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 12 }}>
                {patterns.map((p: any, i: number) => (
                  <div key={i} style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{TYPE_ICONS[p.type] || "🔧"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLORS[p.type] || "#a855f7", textTransform: "capitalize" }}>{p.type || "unknown"}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, background: "rgba(168,85,247,0.2)", color: "#a855f7", padding: "1px 8px", borderRadius: 10, fontWeight: 700 }}>{p.count}×</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#8899bb" }}>{p.description || `Repeated ${p.count} times`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maintenance Log Table */}
          <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,255,136,0.15)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#00ff88" }}>📋 Maintenance History ({filtered.length} records)</p>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="ep-input" style={{ width: "auto", fontSize: 11, padding: "4px 10px" }}>
                <option value="all">All Types</option>
                {MAINTENANCE_TYPES.map(t => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <p style={{ padding: 30, textAlign: "center", color: "#8899bb", fontSize: 13 }}>No maintenance records{filterType !== "all" ? ` of type "${filterType}"` : ""} yet.</p>
            ) : (
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                <table className="ep-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Technician</th>
                      <th>Health Δ</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, i) => {
                      const mtype = m.type || m.maintenance_type || "unknown"
                      const gain = m.health_after != null && m.health_before != null ? m.health_after - m.health_before : null
                      return (
                        <tr key={m.id || i}>
                          <td>
                            <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: `${TYPE_COLORS[mtype] || "#8899bb"}18`, color: TYPE_COLORS[mtype] || "#8899bb", border: `1px solid ${TYPE_COLORS[mtype] || "#8899bb"}40`, textTransform: "capitalize" }}>
                              {TYPE_ICONS[mtype] || "🔧"} {mtype}
                            </span>
                          </td>
                          <td style={{ maxWidth: 340 }}>
                            <p style={{ fontSize: 13, color: "#f0f6ff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description}</p>
                          </td>
                          <td style={{ fontSize: 12, color: "#8899bb" }}>{m.performed_by || m.technician || "—"}</td>
                          <td>
                            {gain != null ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: gain >= 0 ? "#00ff88" : "#ff2d55" }}>
                                {gain >= 0 ? "▲" : "▼"} {Math.abs(gain).toFixed(1)}
                              </span>
                            ) : <span style={{ color: "#4a5a7a", fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ fontSize: 11, color: "#4a5a7a", fontFamily: "monospace" }}>{m.timestamp?.slice(0, 16) || "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Log Maintenance Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0d1526", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0 25px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
            {/* Modal Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: 17, color: "#f0f6ff" }}>🔧 Log Maintenance Event</p>
                <p style={{ fontSize: 11, color: "#8899bb", marginTop: 4 }}>Record a maintenance action for machine_001</p>
              </div>
              <button onClick={() => { setShowModal(false); setSubmitMsg("") }} style={{ background: "none", border: "none", color: "#8899bb", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Type selector */}
              <div>
                <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Maintenance Type *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {MAINTENANCE_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, maintenance_type: t }))}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s",
                        background: form.maintenance_type === t ? `${TYPE_COLORS[t]}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${form.maintenance_type === t ? TYPE_COLORS[t] : "rgba(255,255,255,0.08)"}`,
                        color: form.maintenance_type === t ? TYPE_COLORS[t] : "#8899bb" }}>
                      {TYPE_ICONS[t]} {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Description *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the maintenance performed..."
                  rows={3}
                  style={{ width: "100%", background: "#111d35", border: "1px solid rgba(28,114,147,0.3)", borderRadius: 8, padding: "10px 12px", color: "#f0f6ff", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
              </div>

              {/* Row: Technician + Duration */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Technician</label>
                  <input className="ep-input" value={form.technician} onChange={e => setForm(f => ({ ...f, technician: e.target.value }))} placeholder="Technician name" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Duration (min)</label>
                  <input className="ep-input" type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="e.g. 45" />
                </div>
              </div>

              {/* Parts */}
              <div>
                <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Parts / Tools Used</label>
                <input className="ep-input" value={form.parts_used} onChange={e => setForm(f => ({ ...f, parts_used: e.target.value }))} placeholder="e.g. Bearing kit, Lubricant, Filter..." />
              </div>

              {submitMsg && (
                <p style={{ fontSize: 12, color: submitMsg.startsWith("✅") ? "#00ff88" : "#ff2d55", fontWeight: 600 }}>{submitMsg}</p>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 24px 20px", borderTop: "1px solid rgba(0,212,255,0.08)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowModal(false); setSubmitMsg("") }} className="ep-btn ep-btn-ghost">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="ep-btn ep-btn-primary" style={{ opacity: submitting ? 0.6 : 1, background: "linear-gradient(135deg, #065f46, #00ff88)", color: "#020817" }}>
                {submitting ? "Saving..." : "✓ Save Log"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
