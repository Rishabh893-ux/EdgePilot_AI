"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

const SEV_COLOR: Record<string, string> = { critical: "#ff2d55", warning: "#ffb800" }
const SEV_BG:    Record<string, string> = { critical: "rgba(255,45,85,0.1)", warning: "rgba(255,184,0,0.08)" }

export default function AlertsPage() {
  const router = useRouter()
  const [user, setUser]     = useState<User | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [filter, setFilter] = useState<"all"|"critical"|"warning"|"unacked">("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [toast, setToast]   = useState<string|null>(null)

  useEffect(() => {
    const u = getUser(); if (!u) { router.push("/login"); return }; setUser(u)
  }, [])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])

  const load = useCallback(async () => {
    try {
      const r = await api.alerts(100)
      setAlerts(r.alerts || [])
      setLoading(false)
    } catch { setLoading(false) }
  }, [])

  useEffect(() => { if (!user) return; load(); const id = setInterval(load, 5000); return () => clearInterval(id) }, [load, user])

  const ack = async (id: number) => {
    await api.acknowledgeAlert(id); load(); setToast("Alert acknowledged ✓")
  }
  const ackAll = async () => {
    const unacked = alerts.filter(a => !a.acknowledged)
    await Promise.all(unacked.map(a => api.acknowledgeAlert(a.id)))
    load(); setToast(`Acknowledged ${unacked.length} alerts ✓`)
  }

  const perms = user ? PERMISSIONS[user.role] : null

  const filtered = alerts.filter(a => {
    if (filter === "critical" && a.severity !== "critical") return false
    if (filter === "warning"  && a.severity !== "warning")  return false
    if (filter === "unacked"  && a.acknowledged)            return false
    if (search && !a.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const critCount  = alerts.filter(a => a.severity === "critical").length
  const warnCount  = alerts.filter(a => a.severity === "warning").length
  const unackCount = alerts.filter(a => !a.acknowledged).length

  // Hourly alert chart (last 12 hours)
  const now = Date.now()
  const hourBuckets = Array.from({length:12}, (_, i) => {
    const h = new Date(now - (11 - i) * 3600000)
    const label = h.getHours().toString().padStart(2,"0") + ":00"
    const count = alerts.filter(a => {
      const at = new Date(a.timestamp).getTime()
      return at >= h.getTime() && at < h.getTime() + 3600000
    }).length
    return { label, count }
  })

  if (!user) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#8899bb"}}>Loading...</div>

  return (
    <div style={{ padding:"28px 32px", maxWidth:1200, margin:"0 auto" }}>
      {toast && (
        <div style={{ position:"fixed", top:20, right:24, background:"#0d1526", border:"1px solid #00d4ff", borderRadius:10, padding:"10px 18px", fontSize:13, color:"#00d4ff", zIndex:50, boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:11, color:"#00d4ff", textTransform:"uppercase", letterSpacing:"0.2em", marginBottom:6 }}>EdgePilot AI</p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h1 style={{ fontSize:26, fontWeight:800, color:"#f0f6ff", margin:0 }}>🚨 Alerts Command Center</h1>
          {perms?.canResolveAlerts && unackCount > 0 && (
            <button onClick={ackAll} style={{ background:"rgba(0,255,136,0.12)", border:"1px solid rgba(0,255,136,0.25)", color:"#00ff88", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              ✓ Acknowledge All ({unackCount})
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[
          { label:"Total Alerts",    value:alerts.length, color:"#00d4ff" },
          { label:"Critical",         value:critCount,     color:"#ff2d55" },
          { label:"Warnings",         value:warnCount,     color:"#ffb800" },
          { label:"Unacknowledged",   value:unackCount,    color:"#a855f7" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:"rgba(13,21,38,0.9)", borderRadius:12, border:`1px solid rgba(255,255,255,0.05)`, padding:"16px 18px" }}>
            <p style={{ fontSize:10, color:"#8899bb", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{label}</p>
            <p style={{ fontSize:30, fontWeight:800, color, lineHeight:1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Hourly chart */}
      <div style={{ background:"rgba(13,21,38,0.9)", borderRadius:14, border:"1px solid rgba(0,212,255,0.08)", padding:"20px 24px", marginBottom:22 }}>
        <p style={{ fontSize:13, fontWeight:700, color:"#ffb800", marginBottom:14 }}>📊 Alerts Per Hour (Last 12h)</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={hourBuckets} margin={{top:0,right:10,bottom:0,left:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
            <XAxis dataKey="label" tick={{fill:"#4a5a7a",fontSize:9}} />
            <YAxis tick={{fill:"#4a5a7a",fontSize:9}} allowDecimals={false} />
            <Tooltip contentStyle={{background:"#0d1526",border:"1px solid #1C7293",borderRadius:8,fontSize:11}} />
            <Bar dataKey="count" name="Alerts" radius={[3,3,0,0]}>
              {hourBuckets.map((_, i) => <Cell key={i} fill={_.count > 2 ? "#ff2d55" : _.count > 0 ? "#ffb800" : "#1a2744"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters + Search */}
      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
        {(["all","critical","warning","unacked"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"6px 14px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer",
            background: filter===f ? "rgba(0,212,255,0.15)" : "rgba(13,21,38,0.9)",
            border: filter===f ? "1px solid rgba(0,212,255,0.4)" : "1px solid rgba(255,255,255,0.06)",
            color: filter===f ? "#00d4ff" : "#8899bb", textTransform:"capitalize",
          }}>{f === "unacked" ? "Unacknowledged" : f}</button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search alerts..."
          className="ep-input"
          style={{ maxWidth:260, marginLeft:"auto" }}
        />
      </div>

      {/* Alert list */}
      <div style={{ background:"rgba(13,21,38,0.9)", borderRadius:14, border:"1px solid rgba(0,212,255,0.08)", overflow:"hidden" }}>
        {loading ? (
          <p style={{ padding:24, color:"#8899bb", fontSize:13 }}>Loading alerts...</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding:40, textAlign:"center" }}>
            <p style={{ fontSize:32, marginBottom:8 }}>✅</p>
            <p style={{ color:"#8899bb", fontSize:14 }}>No alerts match your filter</p>
          </div>
        ) : (
          <div>
            {filtered.map((a: any) => (
              <div key={a.id} style={{
                display:"flex", alignItems:"flex-start", gap:14, padding:"14px 20px",
                borderBottom:"1px solid rgba(255,255,255,0.03)",
                background: a.acknowledged ? "transparent" : SEV_BG[a.severity] || "transparent",
                transition:"background 0.2s",
              }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:SEV_COLOR[a.severity]||"#8899bb", marginTop:5, flexShrink:0, boxShadow:!a.acknowledged?`0 0 8px ${SEV_COLOR[a.severity]||"#8899bb"}`:"none" }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:SEV_COLOR[a.severity]||"#8899bb", textTransform:"uppercase", letterSpacing:"0.06em" }}>{a.severity}</span>
                    {a.parameter && <span style={{ fontSize:10, color:"#4a5a7a", background:"rgba(255,255,255,0.04)", padding:"1px 6px", borderRadius:4 }}>{a.parameter}</span>}
                    {a.acknowledged && <span style={{ fontSize:9, color:"#00ff88", marginLeft:"auto" }}>✓ ACK</span>}
                  </div>
                  <p style={{ fontSize:13, color:"#c0d0e8", lineHeight:1.5, margin:0 }}>{a.message}</p>
                  <p style={{ fontSize:10, color:"#4a5a7a", marginTop:4 }}>{a.timestamp?.slice(0,19)?.replace("T"," ")}</p>
                </div>
                {perms?.canResolveAlerts && !a.acknowledged && (
                  <button onClick={() => ack(a.id)} style={{
                    background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.2)", color:"#00ff88",
                    borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", flexShrink:0, fontWeight:600,
                  }}>✓ Ack</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
