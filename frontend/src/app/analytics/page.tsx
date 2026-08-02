"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts"
import { api } from "@/lib/api"
import { getUser, type User } from "@/lib/auth"

const POLL_MS = 6000

function MetricCard({ label, value, unit = "", color = "#00d4ff", icon = "📈", warn = false, crit = false }: any) {
  const c = crit ? "#ff2d55" : warn ? "#ffb800" : color
  return (
    <div style={{
      background: "rgba(13,21,38,0.9)", borderRadius: "14px",
      border: `1px solid ${crit ? "rgba(255,45,85,0.4)" : warn ? "rgba(255,184,0,0.3)" : "rgba(0,212,255,0.12)"}`,
      padding: "18px", position: "relative", overflow: "hidden",
      boxShadow: crit ? "0 0 20px rgba(255,45,85,0.15)" : "none",
    }}>
      <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: 0.2 }}>{icon}</div>
      <p style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1 }}>
        {value ?? "—"}<span style={{ fontSize: 13, fontWeight: 400, color: "#8899bb", marginLeft: 4 }}>{unit}</span>
      </p>
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [readings, setReadings] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
  }, [])

  const poll = useCallback(async () => {
    try {
      const [tr, rd, dash] = await Promise.all([
        api.trend(50),
        api.readings(100),
        api.dashboard()
      ])
      setTrend(tr.readings || [])
      setReadings(rd.readings || [])
      setStats(dash)
      setLoading(false)
    } catch { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) return
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll, user])

  const anomalies = readings.filter((r: any) => r.is_anomaly)
  const normal    = readings.filter((r: any) => !r.is_anomaly)

  const shiftStats = ["morning", "afternoon", "night"].map(s => {
    const rows = readings.filter((r: any) => r.shift === s)
    return {
      shift: s,
      avg_health: rows.length ? Math.round(rows.reduce((a: number, r: any) => a + r.health_score, 0) / rows.length) : 0,
      avg_temp:   rows.length ? Math.round(rows.reduce((a: number, r: any) => a + r.temperature, 0) / rows.length * 10) / 10 : 0,
      anomalies:  rows.filter((r: any) => r.is_anomaly).length,
    }
  })

  if (!user) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#8899bb" }}>Loading...</div>

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>Deep Analytics</h1>
        <p style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>Last {readings.length} sensor readings · machine_001</p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 28 }}>
        <MetricCard label="Total Readings"   value={readings.length}                               icon="📡" color="#00d4ff" />
        <MetricCard label="Anomalies"        value={anomalies.length}                              icon="⚠️" crit={anomalies.length > 5} warn={anomalies.length > 0} />
        <MetricCard label="Avg Health"       value={stats?.health_stats?.avg_health?.toFixed(1)}  icon="💚" unit="/100" color="#00ff88" />
        <MetricCard label="Avg Temperature"  value={stats?.health_stats?.avg_temp?.toFixed(1)}    icon="🌡" unit="°C"  warn={stats?.health_stats?.avg_temp > 70} crit={stats?.health_stats?.avg_temp > 80} />
        <MetricCard label="Peak Vibration"   value={stats?.health_stats?.max_vib?.toFixed(2)}     icon="📳" unit="mm/s" warn={stats?.health_stats?.max_vib > 4} crit={stats?.health_stats?.max_vib > 6} />
        <MetricCard label="ML Model"         value={stats ? (stats.is_anomaly !== undefined ? "Active" : "Off") : "—"} icon="🧠" color="#a855f7" />
      </div>

      {/* Multi-sensor chart */}
      <div style={{ background:"rgba(13,21,38,0.9)", borderRadius:14, border:"1px solid rgba(0,212,255,0.1)", padding:"20px 24px", marginBottom:24 }}>
        <p style={{ fontSize:13, fontWeight:700, color:"#00d4ff", marginBottom:16 }}>📈 Multi-Sensor Trend (Last 50 Readings)</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend} margin={{top:5,right:20,bottom:5,left:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
            <XAxis dataKey="t" tick={{fill:"#4a5a7a",fontSize:9}} />
            <YAxis yAxisId="left"  tick={{fill:"#4a5a7a",fontSize:9}} />
            <YAxis yAxisId="right" orientation="right" tick={{fill:"#4a5a7a",fontSize:9}} />
            <Tooltip contentStyle={{background:"#0d1526",border:"1px solid #1C7293",borderRadius:8,fontSize:12}} />
            <Legend wrapperStyle={{fontSize:11,color:"#8899bb"}} />
            <Line yAxisId="left"  type="monotone" dataKey="temp"    stroke="#ff2d55" strokeWidth={2} dot={false} name="Temp (°C)" />
            <Line yAxisId="left"  type="monotone" dataKey="vib"     stroke="#ffb800" strokeWidth={2} dot={false} name="Vibration" />
            <Line yAxisId="right" type="monotone" dataKey="health"  stroke="#00ff88" strokeWidth={2} dot={false} name="Health" />
            <Line yAxisId="left"  type="monotone" dataKey="current" stroke="#a855f7" strokeWidth={1.5} dot={false} name="Current (A)" strokeDasharray="4 2" />
            <ReferenceLine yAxisId="right" y={50} stroke="#ff2d55" strokeDasharray="4 4" label={{value:"Critical",fill:"#ff2d55",fontSize:9}} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Row: Anomaly Scatter + Shift Heatmap */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
        {/* Anomaly Scatter */}
        <div style={{ background:"rgba(13,21,38,0.9)", borderRadius:14, border:"1px solid rgba(0,212,255,0.1)", padding:"20px 24px" }}>
          <p style={{ fontSize:13, fontWeight:700, color:"#a855f7", marginBottom:4 }}>🔬 Anomaly Map: Temp vs Vibration</p>
          <p style={{ fontSize:11, color:"#4a5a7a", marginBottom:16 }}>Each dot = one reading; red = anomaly</p>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{top:5,right:10,bottom:5,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="temperature" name="Temp" unit="°C" tick={{fill:"#4a5a7a",fontSize:9}} />
              <YAxis dataKey="vibration"   name="Vib"  unit="mm/s" tick={{fill:"#4a5a7a",fontSize:9}} />
              <Tooltip contentStyle={{background:"#0d1526",border:"1px solid #1C7293",borderRadius:8,fontSize:11}} cursor={{strokeDasharray:"3 3"}} />
              <Scatter name="Normal"  data={normal}    fill="rgba(0,255,136,0.6)"  />
              <Scatter name="Anomaly" data={anomalies} fill="rgba(255,45,85,0.8)"  />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Shift Stats */}
        <div style={{ background:"rgba(13,21,38,0.9)", borderRadius:14, border:"1px solid rgba(0,212,255,0.1)", padding:"20px 24px" }}>
          <p style={{ fontSize:13, fontWeight:700, color:"#ffb800", marginBottom:16 }}>🕐 Shift Comparison</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={shiftStats} margin={{top:5,right:10,bottom:5,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="shift" tick={{fill:"#8899bb",fontSize:10}} />
              <YAxis tick={{fill:"#4a5a7a",fontSize:9}} />
              <Tooltip contentStyle={{background:"#0d1526",border:"1px solid #1C7293",borderRadius:8,fontSize:12}} />
              <Legend wrapperStyle={{fontSize:11,color:"#8899bb"}} />
              <Bar dataKey="avg_health" name="Avg Health" fill="#00ff88" radius={[4,4,0,0]} opacity={0.85} />
              <Bar dataKey="anomalies"  name="Anomalies"  fill="#ff2d55" radius={[4,4,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Power + Acoustic Row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div style={{ background:"rgba(13,21,38,0.9)", borderRadius:14, border:"1px solid rgba(0,212,255,0.1)", padding:"20px 24px" }}>
          <p style={{ fontSize:13, fontWeight:700, color:"#10b981", marginBottom:16 }}>🌱 Power Draw Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend}>
              <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="t" tick={{fill:"#4a5a7a",fontSize:9}} />
              <YAxis tick={{fill:"#4a5a7a",fontSize:9}} />
              <Tooltip contentStyle={{background:"#0d1526",border:"1px solid #1C7293",borderRadius:8,fontSize:11}} />
              <Area type="monotone" dataKey="power_kw" stroke="#10b981" fill="url(#pg)" strokeWidth={2} dot={false} name="Power (kW)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:"rgba(13,21,38,0.9)", borderRadius:14, border:"1px solid rgba(0,212,255,0.1)", padding:"20px 24px" }}>
          <p style={{ fontSize:13, fontWeight:700, color:"#a855f7", marginBottom:16 }}>🔊 Acoustic Frequency</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend}>
              <defs><linearGradient id="aq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.35}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
              <XAxis dataKey="t" tick={{fill:"#4a5a7a",fontSize:9}} />
              <YAxis tick={{fill:"#4a5a7a",fontSize:9}} />
              <Tooltip contentStyle={{background:"#0d1526",border:"1px solid #1C7293",borderRadius:8,fontSize:11}} />
              <ReferenceLine y={2000} stroke="#ff2d55" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="acoustic" stroke="#a855f7" fill="url(#aq)" strokeWidth={2} dot={false} name="Freq (Hz)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
