"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts"
import { api } from "@/lib/api"
import { getUser, logout, PERMISSIONS, type User } from "@/lib/auth"
import dynamic from "next/dynamic"

const Machine3D = dynamic(() => import('@/components/Machine3D'), { ssr: false })

const POLL_FAST_MS = 5000
const POLL_SLOW_MS = 30000

function StatCard({ label, value, unit = "", warn = false, crit = false, icon = "", trend = null }: any) {
  const color = crit ? "#ff2d55" : warn ? "#ffb800" : "#f0f6ff"
  const borderColor = crit ? "rgba(255,45,85,0.4)" : warn ? "rgba(255,184,0,0.3)" : "rgba(0,212,255,0.12)"
  return (
    <div style={{
      background: "rgba(13,21,38,0.9)", borderRadius: 14,
      border: `1px solid ${borderColor}`,
      padding: "16px 20px", position: "relative", overflow: "hidden",
      boxShadow: crit ? "0 0 20px rgba(255,45,85,0.15)" : warn ? "0 0 12px rgba(255,184,0,0.08)" : "none",
      transition: "box-shadow 0.4s ease",
    }}>
      {icon && <div style={{ position: "absolute", top: 12, right: 14, fontSize: 20, opacity: 0.15 }}>{icon}</div>}
      <p style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
        {value ?? '—'}<span style={{ fontSize: 13, fontWeight: 400, color: "#8899bb", marginLeft: 4 }}>{unit}</span>
      </p>
      {trend !== null && (
        <p style={{ fontSize: 10, color: trend >= 0 ? "#ff2d55" : "#00ff88", marginTop: 6, fontWeight: 600 }}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)} vs prev
        </p>
      )}
    </div>
  )
}

function LiveTicker({ items }: { items: any[] }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!items.length) return
    const id = setInterval(() => setIdx(i => (i + 1) % items.length), 3000)
    return () => clearInterval(id)
  }, [items.length])
  if (!items.length) return null
  const item = items[idx]
  const sev = item.severity || "info"
  const sevColor = sev === "critical" ? "#ff2d55" : sev === "warning" ? "#ffb800" : "#00d4ff"
  return (
    <div style={{
      background: "rgba(13,21,38,0.9)", borderRadius: 10, border: `1px solid ${sevColor}30`,
      padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, overflow: "hidden",
      maxWidth: 580, animation: "slide-up 0.3s ease-out",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: sevColor, flexShrink: 0, animation: "data-pulse 1.5s infinite" }} />
      <span style={{ fontSize: 12, color: "#c0d0e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.message}</span>
      <span style={{ fontSize: 10, color: sevColor, flexShrink: 0, fontWeight: 700, textTransform: "uppercase" }}>{sev}</span>
    </div>
  )
}

function UptimeCounter({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startTime), 1000)
    return () => clearInterval(id)
  }, [startTime])
  const h = Math.floor(elapsed / 3600000)
  const m = Math.floor((elapsed % 3600000) / 60000)
  const s = Math.floor((elapsed % 60000) / 1000)
  return <span style={{ fontFamily: "monospace", color: "#00d4ff", fontWeight: 700, fontSize: 13 }}>
    {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
  </span>
}

export default function MissionControl() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [fleet, setFleet] = useState<any[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [trained, setTrained] = useState(false)
  const [training, setTraining] = useState(false)
  const [sessionStart] = useState(Date.now())
  const [pulse, setPulse] = useState(false)

  // Time-Travel
  const [timeTravelIdx, setTimeTravelIdx] = useState(-1)
  const [ttActive, setTtActive] = useState(false)

  const alertCountRef = useRef(0)
  const prevTemp = useRef<number | null>(null)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
  }, [])

  const perms = user ? PERMISSIONS[user.role] : null

  const pollFast = useCallback(async () => {
    try {
      const [dash, tr, al] = await Promise.all([
        api.dashboard(), api.trend(25), api.alerts(15),
      ])
      const activeAlerts = Number(dash?.active_alerts ?? 0)
      if (activeAlerts > 0 && activeAlerts !== alertCountRef.current) {
        setToast(activeAlerts > alertCountRef.current ? `🚨 New alert: ${activeAlerts} active alert(s)` : `Active alerts: ${activeAlerts}`)
      } else if (activeAlerts === 0 && alertCountRef.current > 0) {
        setToast("✅ All clear — no active alerts")
      }
      alertCountRef.current = activeAlerts
      setData(dash)
      prevTemp.current = dash?.temperature ?? null
      setTrend(tr.readings || [])
      setAlerts(al.alerts || [])
      setError("")
      setPulse(p => !p) // trigger live-pulse indicator
    } catch {
      setError("Backend offline — confirm Render deployment is live.")
    }
  }, [])

  const pollSlow = useCallback(async () => {
    try {
      const [ml, noti, fleetData] = await Promise.all([
        api.mlStatus(), api.notifications(), api.fleet()
      ])
      setNotes(noti.notifications || [])
      setFleet(fleetData.machines || [])
      setTrained(ml.is_trained || false)
    } catch { }
  }, [])

  useEffect(() => {
    if (!user) return
    pollFast()
    pollSlow()
    const fastId = setInterval(pollFast, POLL_FAST_MS)
    const slowId = setInterval(pollSlow, POLL_SLOW_MS)
    return () => { clearInterval(fastId); clearInterval(slowId) }
  }, [pollFast, pollSlow, user])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleTrain() {
    setTraining(true)
    try { await api.trainModel(); setTrained(true); setToast("🧠 ML Model Trained!") }
    catch { }
    setTraining(false)
  }

  async function handleEStop() {
    if (!confirm("Are you sure you want to trigger Emergency Stop?")) return
    try {
      await api.sendControlCommand("machine_001", { command: "estop" })
      setToast("🛑 Emergency Stop triggered!")
    } catch { setToast("Failed to trigger E-Stop") }
  }

  if (!user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8899bb" }}>Loading...</div>

  const score = data?.machineiq_score ?? 0
  const unack = alerts.filter((a: any) => !a.acknowledged)
  const roleInfo = PERMISSIONS[user.role]

  const ttReadings = data?.recent_readings || []
  const ttSnapshot = ttActive && timeTravelIdx >= 0 && ttReadings[timeTravelIdx]
    ? ttReadings[timeTravelIdx]
    : null

  // Compute carbon today from trend
  const totalCarbon = trend.reduce((s: number, r: any) => s + (r.carbon_emission ?? 0), 0).toFixed(1)
  const totalPower = trend.reduce((s: number, r: any) => s + (r.power_kw ?? 0), 0).toFixed(1)

  const tempTrend = trend.length >= 4
    ? (trend[trend.length - 1]?.temp ?? 0) - (trend[trend.length - 4]?.temp ?? 0)
    : null

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, background: "#0d1526",
          border: "1px solid #00d4ff", borderRadius: 10, padding: "10px 18px",
          fontSize: 13, color: "#00d4ff", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          animation: "slide-up 0.3s ease-out"
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>Mission Control</h1>
          <p style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>Real-time telemetry &amp; autonomous control · machine_001</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {data?.shift && (
              <span style={{ fontSize: 11, background: "rgba(0,212,255,0.1)", color: "#00d4ff", padding: "4px 10px", borderRadius: 12, textTransform: "capitalize", fontWeight: 600 }}>
                {data.shift} Shift
              </span>
            )}
            <span style={{ fontSize: 11, background: `${roleInfo.color}22`, color: roleInfo.color, padding: "4px 10px", borderRadius: 12, fontWeight: 600 }}>
              {roleInfo.label} Access
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#4a5a7a" }}>Session:</span>
            <UptimeCounter startTime={sessionStart} />
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: data ? "#00ff88" : "#4a5a7a",
              display: "inline-block",
              animation: data ? "pulse-green 2.5s infinite" : "none"
            }} />
          </div>
        </div>
      </div>

      {/* Alert ticker */}
      {unack.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <LiveTicker items={unack} />
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.4)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, color: "#ff2d55", fontSize: 13 }}>
          ❌ {error}
        </div>
      )}

      {user.role === "viewer" && (
        <div style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, color: "#a855f7", fontSize: 13 }}>
          👁 You are in read-only view. Contact an Operator or Admin to make changes.
        </div>
      )}

      {/* 3D Digital Twin */}
      {data?.status !== "waiting_for_data" && (
        <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.12)", padding: 4, marginBottom: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 16, right: 20, zIndex: 10, textAlign: "right" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#00d4ff", marginBottom: 4 }}>3D Digital Twin</p>
            {ttActive && ttSnapshot ? (
              <span style={{ fontSize: 11, background: "#a855f7", color: "#fff", padding: "2px 8px", borderRadius: 12, fontWeight: 700, animation: "data-pulse 2s infinite" }}>
                ⏪ TIME TRAVEL: {ttSnapshot.t}
              </span>
            ) : (
              <span style={{ fontSize: 11, background: data?.is_anomaly ? "#ff2d55" : "#00ff88", color: "#000", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                {data?.is_anomaly ? "⚠ ANOMALY" : "🟢 LIVE"}
              </span>
            )}
          </div>
          <Machine3D
            temperature={ttSnapshot ? ttSnapshot.temp : (data?.temperature || 65)}
            vibration={ttSnapshot ? ttSnapshot.vib : (data?.vibration || 2.0)}
            power_kw={ttSnapshot ? (ttSnapshot.power_kw || 0) : (data?.power_kw || 0)}
            rpm={ttSnapshot ? (ttSnapshot.rpm || 0) : (data?.rpm || 0)}
            is_anomaly={ttSnapshot ? (ttSnapshot.health < 50) : (data?.is_anomaly || false)}
          />
        </div>
      )}

      {/* Primary KPI row */}
      {data?.machineiq_score !== undefined && (
        <div style={{
          background: "linear-gradient(135deg, rgba(13,21,38,0.95), rgba(4,13,33,0.95))",
          borderRadius: 16, border: `2px solid ${data.is_anomaly ? "#ff2d55" : "#00ff88"}`,
          padding: "24px 32px", marginBottom: 24, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24,
          boxShadow: data.is_anomaly ? "0 0 40px rgba(255,45,85,0.2)" : "0 0 30px rgba(0,255,136,0.1)"
        }}>
          <div>
            <p style={{ fontSize: 12, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>MachineIQ Score</p>
            <p style={{ fontSize: 56, fontWeight: 900, color: data.is_anomaly ? "#ff2d55" : score < 70 ? "#ffb800" : "#00ff88", lineHeight: 1 }}>
              {score?.toFixed?.(0) ?? score}
              <span style={{ fontSize: 20, color: "#4a5a7a", fontWeight: 600, marginLeft: 8 }}>/100</span>
            </p>
            <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.05)", width: 180 }}>
              <div style={{ height: "100%", borderRadius: 4, width: `${score}%`, background: score < 50 ? "#ff2d55" : score < 70 ? "#ffb800" : "#00ff88", transition: "width 1s ease" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 40px" }}>
            <div>
              <p style={{ fontSize: 11, color: "#4a5a7a", textTransform: "uppercase", marginBottom: 2 }}>Total Readings</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff" }}>{data?.total_readings ?? 0}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#4a5a7a", textTransform: "uppercase", marginBottom: 2 }}>Active Alerts</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: unack.length > 0 ? "#ff2d55" : "#00ff88" }}>{unack.length}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#4a5a7a", textTransform: "uppercase", marginBottom: 2 }}>Predicted RUL</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#f0f6ff" }}>{data?.rul_days === 999 ? "Stable" : data?.rul_days !== undefined ? `~${data.rul_days}d` : "—"}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#4a5a7a", textTransform: "uppercase", marginBottom: 2 }}>Status</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: data?.is_anomaly ? "#ff2d55" : "#00ff88", animation: data?.is_anomaly ? "data-pulse 1s infinite" : "none" }}>{data?.is_anomaly ? "ANOMALY" : "HEALTHY"}</p>
            </div>
          </div>
          {/* Carbon + Power snapshot */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderLeft: "1px solid rgba(0,212,255,0.1)", paddingLeft: 28 }}>
            <div>
              <p style={{ fontSize: 10, color: "#4a5a7a", textTransform: "uppercase", marginBottom: 2 }}>🌱 Power (session)</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{totalPower} <span style={{ fontSize: 11, color: "#8899bb" }}>kWh</span></p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#4a5a7a", textTransform: "uppercase", marginBottom: 2 }}>💨 CO₂ Emitted</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{totalCarbon} <span style={{ fontSize: 11, color: "#8899bb" }}>kg</span></p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {perms?.canTrainModel && (
              <button onClick={handleTrain} disabled={training || trained} className="ep-btn" style={{
                background: trained ? "rgba(0,255,136,0.15)" : "linear-gradient(135deg, #1C7293, #00d4ff)",
                color: trained ? "#00ff88" : "#fff", border: trained ? "1px solid rgba(0,255,136,0.3)" : "none",
                opacity: (training || trained) ? 0.7 : 1
              }}>
                {training ? "Training..." : trained ? "✅ Model Trained" : "🧠 Train ML Model"}
              </button>
            )}
            {perms?.canResolveAlerts && (
              <button onClick={handleEStop} className="ep-btn" style={{
                background: "#ff2d55", color: "#fff", border: "none", boxShadow: "0 0 20px rgba(255,45,85,0.4)", fontWeight: 800
              }}>
                🛑 EMERGENCY STOP
              </button>
            )}
          </div>
        </div>
      )}

      {/* Time Travel Slider */}
      {ttReadings.length > 1 && (
        <div style={{ background: "rgba(168,85,247,0.05)", borderRadius: 14, border: "1px solid rgba(168,85,247,0.2)", padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ttActive ? 12 : 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#a855f7" }}>⏪ Time-Travel Root Cause Analysis</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {ttActive && timeTravelIdx >= 0 && (
                <span style={{ fontSize: 11, background: "rgba(168,85,247,0.15)", color: "#c084fc", padding: "4px 10px", borderRadius: 8 }}>
                  Viewing: {ttReadings[timeTravelIdx]?.t || "—"} | Health: {ttReadings[timeTravelIdx]?.health?.toFixed(0) ?? "—"}
                </span>
              )}
              <button onClick={() => { setTtActive(!ttActive); if (ttActive) setTimeTravelIdx(-1) }}
                className="ep-btn" style={{ background: ttActive ? "#a855f7" : "rgba(168,85,247,0.15)", color: ttActive ? "#fff" : "#c084fc", border: "none" }}>
                {ttActive ? "⏹ Exit Time-Travel" : "▶ Enable Time-Travel"}
              </button>
            </div>
          </div>
          {ttActive && (
            <div>
              <input type="range" min={0} max={ttReadings.length - 1} value={timeTravelIdx < 0 ? ttReadings.length - 1 : timeTravelIdx} onChange={e => setTimeTravelIdx(Number(e.target.value))} style={{ width: "100%", accentColor: "#a855f7", cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8899bb", marginTop: 4 }}>
                <span>{ttReadings[0]?.t}</span>
                <span style={{ color: "#a855f7" }}>← Scrub to replay machine history →</span>
                <span>{ttReadings[ttReadings.length - 1]?.t} (live)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Secondary Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard label="Temperature" value={data?.temperature?.toFixed(1)} unit="°C" icon="🌡" warn={data?.temperature > 70} crit={data?.temperature > 80} trend={tempTrend} />
        <StatCard label="Vibration" value={data?.vibration?.toFixed(2)} unit="mm/s" icon="📳" warn={data?.vibration > 4.5} crit={data?.vibration > 6} />
        <StatCard label="Spindle Speed" value={data?.rpm?.toFixed(0)} unit="RPM" icon="⚙️" warn={data?.rpm < 1400} />
        <StatCard label="Motor Current" value={data?.motor_current?.toFixed(2)} unit="A" icon="⚡" warn={data?.motor_current > 15} />
        <StatCard label="Power Draw" value={data?.power_kw?.toFixed(2)} unit="kW" icon="🔋" />
        <StatCard label="Acoustic Freq" value={data?.acoustic_freq?.toFixed(0)} unit="Hz" icon="🔊" warn={data?.acoustic_freq > 1800} crit={data?.acoustic_freq > 2000} />
      </div>

      {/* Trend Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.12)", padding: "16px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#00d4ff", marginBottom: 16 }}>🌡 Temperature &amp; Health Score</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="t" tick={{ fill: "#4a5a7a", fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: "#4a5a7a", fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#4a5a7a", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8 }} />
              <ReferenceLine yAxisId="left" y={80} stroke="#ff2d55" strokeDasharray="4 4" />
              <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#ff2d55" strokeWidth={2} dot={false} name="Temp °C" />
              <Line yAxisId="right" type="monotone" dataKey="health" stroke="#00ff88" strokeWidth={2} dot={false} name="Health" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.12)", padding: "16px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#a855f7", marginBottom: 16 }}>🔊 Acoustic Frequency Signature</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={data?.is_anomaly ? "#ff2d55" : "#a855f7"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={data?.is_anomaly ? "#ff2d55" : "#a855f7"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="t" tick={{ fill: "#4a5a7a", fontSize: 10 }} />
              <YAxis tick={{ fill: "#4a5a7a", fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8 }} />
              <ReferenceLine y={2000} stroke="#ff2d55" strokeDasharray="4 4" label={{ value: "Threshold", fill: "#ff2d55", fontSize: 9 }} />
              <Area type="monotone" dataKey="acoustic" stroke={data?.is_anomaly ? "#ff2d55" : "#a855f7"} fill="url(#ag)" strokeWidth={2} dot={false} name="Freq (Hz)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Carbon / Energy row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "16px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 16 }}>🌱 Power Draw Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="t" tick={{ fill: "#4a5a7a", fontSize: 9 }} />
              <YAxis tick={{ fill: "#4a5a7a", fontSize: 9 }} />
              <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="power_kw" stroke="#10b981" fill="url(#pg)" strokeWidth={2} dot={false} name="Power (kW)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.12)", padding: "16px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#00d4ff", marginBottom: 16 }}>⚡ Vibration Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="t" tick={{ fill: "#4a5a7a", fontSize: 9 }} />
              <YAxis tick={{ fill: "#4a5a7a", fontSize: 9 }} />
              <Tooltip contentStyle={{ background: "#0d1526", border: "1px solid #1C7293", borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={4.5} stroke="#ffb800" strokeDasharray="4 4" />
              <ReferenceLine y={6} stroke="#ff2d55" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="vib" stroke="#00d4ff" fill="url(#vg)" strokeWidth={2} dot={false} name="Vibration (mm/s)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
