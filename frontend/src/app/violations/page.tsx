"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

const POLL_MS = 8000

type Violation = {
  id: number
  violation: string
  shift: string
  created_at: string
  machine_id?: string
}

const CATEGORIES: Record<string, { icon: string; color: string; keywords: string[] }> = {
  "No Helmet": { icon: "⛑️", color: "#ff2d55", keywords: ["helmet", "head", "hardhat"] },
  "No Vest":   { icon: "🦺", color: "#ffb800", keywords: ["vest", "hi-vis", "visibility"] },
  "No Gloves": { icon: "🧤", color: "#a855f7", keywords: ["glove", "hand protection"] },
  "No Goggles":{ icon: "🥽", color: "#00d4ff", keywords: ["goggle", "eye", "glasses"] },
  "Other":     { icon: "⚠️", color: "#8899bb", keywords: [] },
}

function categorize(v: string): string {
  const lower = v.toLowerCase()
  for (const [cat, data] of Object.entries(CATEGORIES)) {
    if (cat === "Other") continue
    if (data.keywords.some(k => lower.includes(k))) return cat
  }
  return "Other"
}

function RiskScore({ value }: { value: number }) {
  const color = value > 70 ? "#ff2d55" : value > 40 ? "#ffb800" : "#00ff88"
  const label = value > 70 ? "HIGH RISK" : value > 40 ? "MODERATE" : "LOW RISK"
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 12px" }}>
        <svg viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${(value / 100) * 314} 314`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 9, color: "#8899bb", marginTop: 2 }}>/ 100</span>
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.1em" }}>{label}</span>
    </div>
  )
}

export default function SafetyPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [safety, setSafety] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterShift, setFilterShift] = useState("all")
  const [filterCat, setFilterCat] = useState("all")

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
  }, [router])

  const poll = useCallback(async () => {
    try {
      const [v, s] = await Promise.all([api.violations(), api.safety()])
      setViolations(v.violations || [])
      setSafety(s)
      setLoading(false)
    } catch { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) return
    if (!PERMISSIONS[user.role]?.canViewViolations) { setLoading(false); return }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [user, poll])

  if (!user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8899bb" }}>Loading...</div>

  const canView = PERMISSIONS[user.role]?.canViewViolations

  if (!canView) return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, color: "#ffb800", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>🦺 Safety Intelligence Hub</h1>
      </div>
      <div style={{ padding: 60, textAlign: "center", background: "rgba(13,21,38,0.9)", borderRadius: 16, border: "1px solid rgba(255,45,85,0.2)" }}>
        <p style={{ fontSize: 42, marginBottom: 16 }}>🔒</p>
        <p style={{ color: "#f0f6ff", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Restricted Access</p>
        <p style={{ color: "#8899bb", fontSize: 13 }}>Safety Intelligence requires Operator or Admin access.</p>
      </div>
    </div>
  )

  // ── Computed stats ────────────────────────────────────────────────
  const totalViolations = violations.length
  const last24h = violations.filter(v => {
    const t = new Date(v.created_at || "").getTime()
    return Date.now() - t < 86400000
  }).length

  const byShift = { morning: 0, afternoon: 0, night: 0 } as Record<string, number>
  violations.forEach(v => { byShift[v.shift] = (byShift[v.shift] || 0) + 1 })
  const worstShift = Object.entries(byShift).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"

  const byCat: Record<string, number> = {}
  violations.forEach(v => {
    const c = categorize(v.violation || "")
    byCat[c] = (byCat[c] || 0) + 1
  })
  const catData = Object.entries(CATEGORIES).map(([name, meta]) => ({
    name, count: byCat[name] || 0, color: meta.color, icon: meta.icon
  })).filter(d => d.count > 0)

  const shiftChartData = Object.entries(byShift).map(([shift, count]) => ({ shift, count }))

  // Group by day for trend chart
  const byDay: Record<string, number> = {}
  violations.forEach(v => {
    const d = (v.created_at || "").slice(0, 10)
    if (d) byDay[d] = (byDay[d] || 0) + 1
  })
  const trendData = Object.entries(byDay).sort().slice(-14).map(([date, count]) => ({ date: date.slice(5), count }))

  const riskScore = Math.min(100, Math.round((last24h * 25) + (totalViolations * 2)))

  const filtered = violations.filter(v =>
    (filterShift === "all" || v.shift === filterShift) &&
    (filterCat === "all" || categorize(v.violation || "") === filterCat)
  )

  const SHIFT_COLORS: Record<string, string> = { morning: "#ffb800", afternoon: "#00d4ff", night: "#a855f7" }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: "#ffb800", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>🦺 Safety Intelligence Hub</h1>
          <p style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>PPE Compliance · Violation Tracking · Risk Analytics</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ padding: "6px 14px", background: last24h > 0 ? "rgba(255,45,85,0.15)" : "rgba(0,255,136,0.12)", border: `1px solid ${last24h > 0 ? "rgba(255,45,85,0.4)" : "rgba(0,255,136,0.3)"}`, borderRadius: 20, fontSize: 11, fontWeight: 700, color: last24h > 0 ? "#ff2d55" : "#00ff88" }}>
            {last24h > 0 ? `⚠ ${last24h} violations today` : "✓ Clear today"}
          </span>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#8899bb" }}>Loading safety data...</p>
      ) : (
        <>
          {/* KPI Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Violations", value: totalViolations, icon: "🚨", color: totalViolations > 10 ? "#ff2d55" : "#ffb800" },
              { label: "Last 24h", value: last24h, icon: "⏱", color: last24h > 0 ? "#ff2d55" : "#00ff88" },
              { label: "Worst Shift", value: worstShift || "—", icon: "🕐", color: "#00d4ff", isText: true },
              { label: "PPE Types Breached", value: catData.length, icon: "🦺", color: catData.length > 2 ? "#ff2d55" : "#ffb800" },
              { label: "Compliance Rate", value: `${Math.max(0, 100 - Math.min(100, totalViolations * 3))}%`, icon: "✅", color: "#00ff88", isText: true },
            ].map(({ label, value, icon, color, isText }) => (
              <div key={label} style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: 0.18 }}>{icon}</div>
                <p style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</p>
                <p style={{ fontSize: isText ? 22 : 30, fontWeight: 800, color, lineHeight: 1, textTransform: "capitalize" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Risk Score + Category Pie */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Risk Score */}
            <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: `1px solid ${riskScore > 70 ? "rgba(255,45,85,0.3)" : riskScore > 40 ? "rgba(255,184,0,0.25)" : "rgba(0,255,136,0.2)"}`, padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Safety Risk Score</p>
              <RiskScore value={riskScore} />
            </div>

            {/* PPE Category Breakdown */}
            <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "20px 24px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ffb800", marginBottom: 16 }}>⛑️ PPE Category Breakdown</p>
              {catData.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "#00ff88", fontSize: 13 }}>✅ No violations recorded</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={catData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                      {catData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#8899bb" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Shift Breakdown */}
            <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "20px 24px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#a855f7", marginBottom: 16 }}>🕐 Violations by Shift</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={shiftChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
                  <XAxis dataKey="shift" tick={{ fill: "#8899bb", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#4a5a7a", fontSize: 9 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Violations" radius={[6, 6, 0, 0]}>
                    {shiftChartData.map((d, i) => (
                      <Cell key={i} fill={SHIFT_COLORS[d.shift] || "#8899bb"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Chart */}
          {trendData.length > 0 && (
            <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "20px 24px", marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ff2d55", marginBottom: 16 }}>📈 Violation Trend (Last 14 Days)</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ff2d55" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#4a5a7a", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#4a5a7a", fontSize: 9 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8, fontSize: 11 }} />
                  <Area type="monotone" dataKey="count" stroke="#ff2d55" fill="url(#vg)" strokeWidth={2} dot={{ fill: "#ff2d55", r: 3 }} name="Violations" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Violation Log with filters */}
          <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(255,184,0,0.15)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ffb800" }}>📋 Violation Log ({filtered.length} records)</p>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="ep-input" style={{ width: "auto", fontSize: 11, padding: "4px 10px" }}>
                  <option value="all">All Shifts</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="night">Night</option>
                </select>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="ep-input" style={{ width: "auto", fontSize: 11, padding: "4px 10px" }}>
                  <option value="all">All Types</option>
                  {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p style={{ padding: 30, textAlign: "center", color: "#00ff88", fontSize: 13 }}>✅ No violations match the current filter.</p>
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="ep-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Violation</th>
                      <th>Category</th>
                      <th>Shift</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v, i) => {
                      const cat = categorize(v.violation || "")
                      const meta = CATEGORIES[cat]
                      return (
                        <tr key={v.id || i}>
                          <td style={{ color: "#4a5a7a", fontSize: 11 }}>{i + 1}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, display: "inline-block", flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: "#f0f6ff" }}>{v.violation || "—"}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}40` }}>
                              {meta.icon} {cat}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: 11, color: SHIFT_COLORS[v.shift] || "#8899bb", textTransform: "capitalize", fontWeight: 600 }}>{v.shift || "—"}</span>
                          </td>
                          <td style={{ fontSize: 11, color: "#4a5a7a", fontFamily: "monospace" }}>{v.created_at?.slice(0, 19) || "—"}</td>
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
    </div>
  )
}
