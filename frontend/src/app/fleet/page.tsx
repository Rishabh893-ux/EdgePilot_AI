"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

const MACHINE_TYPES = ["Extruder", "Mixer", "Press", "Conveyor", "Compressor", "Pump", "Drill", "Welder"]
const ZONES = ["Zone A", "Zone B", "Zone C", "Zone D", "Zone E"]

interface LocalMachine {
  id: string
  name: string
  type: string
  location: string
  status: string
  health: number
  live?: boolean
}

const STATIC_MACHINES: LocalMachine[] = [
  { id: "machine_002", name: "Beta Mixer",     type: "Mixer",     location: "Zone B", status: "offline", health: 0, live: false },
  { id: "machine_003", name: "Gamma Press",    type: "Press",     location: "Zone C", status: "healthy", health: 98, live: false },
  { id: "machine_004", name: "Delta Conveyor", type: "Conveyor",  location: "Zone A", status: "healthy", health: 92, live: false },
]

const STATUS_COLOR: Record<string, string> = {
  healthy: "#00ff88", warning: "#ffb800", critical: "#ff2d55", offline: "#4a5a7a"
}

export default function FleetPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [liveMachines, setLiveMachines] = useState<any[]>([])
  const [localMachines, setLocalMachines] = useState<LocalMachine[]>(() => {
    if (typeof window === "undefined") return STATIC_MACHINES
    try {
      const saved = localStorage.getItem("ep_custom_machines")
      return saved ? [...STATIC_MACHINES, ...JSON.parse(saved)] : STATIC_MACHINES
    } catch { return STATIC_MACHINES }
  })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ id: "", name: "", type: "Extruder", location: "Zone A" })
  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
  }, [router])

  const pollFleet = useCallback(async () => {
    try {
      const f = await api.fleet()
      setLiveMachines(f.machines || [])
      setLoading(false)
    } catch { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) return
    pollFleet()
    const id = setInterval(pollFleet, 8000)
    return () => clearInterval(id)
  }, [user, pollFleet])

  const handleAddMachine = async () => {
    setFormError("")
    if (!form.id.trim()) { setFormError("Machine ID is required."); return }
    if (!form.name.trim()) { setFormError("Machine name is required."); return }
    if (!/^[a-z0-9_]+$/.test(form.id)) { setFormError("ID must be lowercase letters, numbers and underscores only."); return }
    
    const allIds = [...liveMachines.map(m => m.machine_id), ...localMachines.map(m => m.id)]
    if (allIds.includes(form.id)) { setFormError(`Machine ID "${form.id}" already exists.`); return }

    setSubmitting(true)
    await new Promise(r => setTimeout(r, 600)) // simulate save

    const newMachine: LocalMachine = {
      id: form.id, name: form.name, type: form.type,
      location: form.location, status: "offline", health: 0, live: false
    }
    const updated = [...localMachines, newMachine]
    setLocalMachines(updated)

    // Persist custom machines (exclude the static ones)
    const custom = updated.filter(m => !STATIC_MACHINES.some(s => s.id === m.id))
    localStorage.setItem("ep_custom_machines", JSON.stringify(custom))

    setFormSuccess(`✅ "${form.name}" added! Connect it to MQTT topic edgepilot/sensors/${form.id} to start streaming data.`)
    setForm({ id: "", name: "", type: "Extruder", location: "Zone A" })
    setSubmitting(false)
  }

  const handleRemoveCustom = (id: string) => {
    const updated = localMachines.filter(m => m.id !== id)
    setLocalMachines(updated)
    const custom = updated.filter(m => !STATIC_MACHINES.some(s => s.id === m.id))
    localStorage.setItem("ep_custom_machines", JSON.stringify(custom))
  }

  if (!user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8899bb" }}>Loading...</div>

  const isAdmin = user.role === "admin"

  // Merge live backend machines with local ones, avoiding duplicates
  const liveMachineIds = new Set(liveMachines.map(m => m.machine_id))
  const combined: LocalMachine[] = [
    ...liveMachines.map(m => ({
      id: m.machine_id, name: m.machine_id === "machine_001" ? "Alpha Extruder" : m.machine_id,
      type: "Extruder", location: "Zone A",
      status: m.is_anomaly ? "warning" : m.health_score < 50 ? "critical" : "healthy",
      health: m.health_score || 0, live: true,
    })),
    ...localMachines.filter(m => !liveMachineIds.has(m.id)),
  ]

  const totalHealthy  = combined.filter(m => m.status === "healthy").length
  const totalWarning  = combined.filter(m => m.status === "warning" || m.status === "critical").length
  const totalOffline  = combined.filter(m => m.status === "offline").length

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1300, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>🏭 Fleet Command Center</h1>
          <p style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>{combined.length} machines · Live telemetry + registered units</p>
        </div>
        <button
          id="add-machine-btn"
          onClick={() => { setShowModal(true); setFormError(""); setFormSuccess("") }}
          className="ep-btn ep-btn-primary"
        >
          + Add Machine
        </button>
      </div>

      {/* Fleet KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total Machines", value: combined.length, icon: "🏭", color: "#00d4ff" },
          { label: "Healthy",        value: totalHealthy,    icon: "✅", color: "#00ff88" },
          { label: "Warnings",       value: totalWarning,    icon: "⚠️", color: totalWarning > 0 ? "#ffb800" : "#8899bb" },
          { label: "Offline",        value: totalOffline,    icon: "💤", color: totalOffline > 0 ? "#4a5a7a" : "#8899bb" },
          { label: "Live MQTT",      value: liveMachines.length, icon: "📡", color: "#a855f7" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: "rgba(13,21,38,0.9)", borderRadius: 12, border: "1px solid rgba(0,212,255,0.1)", padding: "14px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 10, right: 12, fontSize: 20, opacity: 0.18 }}>{icon}</div>
            <p style={{ fontSize: 10, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Machine Cards */}
      {loading ? (
        <p style={{ color: "#8899bb" }}>Loading fleet data...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px,1fr))", gap: 20 }}>
          {combined.map(m => {
            const statusColor = STATUS_COLOR[m.status] || "#8899bb"
            const isCustom = !STATIC_MACHINES.some(s => s.id === m.id) && !m.live
            return (
              <div key={m.id} style={{
                background: "rgba(13,21,38,0.9)", borderRadius: 14,
                border: `1px solid ${m.status === "critical" ? "rgba(255,45,85,0.35)" : m.status === "warning" ? "rgba(255,184,0,0.3)" : m.status === "offline" ? "rgba(255,255,255,0.06)" : "rgba(0,255,136,0.18)"}`,
                padding: 22, opacity: m.status === "offline" ? 0.65 : 1,
                cursor: m.live ? "pointer" : "default", transition: "transform 0.2s, box-shadow 0.2s",
                position: "relative", overflow: "hidden",
                boxShadow: m.status === "critical" ? "0 0 20px rgba(255,45,85,0.12)" : "none",
              }}
              onClick={() => m.live && router.push("/")}
              onMouseEnter={e => m.live && ((e.currentTarget as HTMLElement).style.transform = "translateY(-4px)")}
              onMouseLeave={e => m.live && ((e.currentTarget as HTMLElement).style.transform = "none")}
              >
                {/* Live badge */}
                {m.live && (
                  <div style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "pulse-green 2s infinite" }} />
                    <span style={{ fontSize: 9, color: "#00ff88", fontWeight: 700, letterSpacing: "0.05em" }}>LIVE</span>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#f0f6ff", paddingRight: 50 }}>{m.name}</h3>
                  <p style={{ fontSize: 10, color: "#4a5a7a", marginTop: 3, fontFamily: "monospace" }}>{m.id}</p>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, background: "rgba(168,85,247,0.12)", padding: "2px 8px", borderRadius: 10, color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>{m.type}</span>
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 10, color: "#8899bb" }}>{m.location}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700, textTransform: "capitalize",
                    background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}35` }}>
                    {m.status}
                  </span>
                </div>

                {/* Health bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: "#8899bb" }}>Health Score</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: m.status === "offline" ? "#4a5a7a" : statusColor }}>
                      {m.status === "offline" ? "—" : `${m.health.toFixed(0)}/100`}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${m.status === "offline" ? 0 : m.health}%`, background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`, borderRadius: 3, transition: "width 0.8s ease" }} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {m.live ? (
                    <span style={{ fontSize: 11, color: "#00d4ff", fontWeight: 600 }}>View Details →</span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#4a5a7a" }}>Not connected to MQTT</span>
                  )}
                  {isCustom && isAdmin && (
                    <button onClick={e => { e.stopPropagation(); handleRemoveCustom(m.id) }}
                      style={{ background: "none", border: "none", color: "#4a5a7a", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}
                      title="Remove machine">✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Machine Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0d1526", border: "1px solid rgba(0,212,255,0.25)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 25px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: 17, color: "#f0f6ff" }}>🏭 Register New Machine</p>
                <p style={{ fontSize: 11, color: "#8899bb", marginTop: 4 }}>Add a machine to your fleet registry</p>
              </div>
              <button onClick={() => { setShowModal(false); setFormError(""); setFormSuccess("") }}
                style={{ background: "none", border: "none", color: "#8899bb", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Machine ID *</label>
                  <input id="fleet-machine-id" className="ep-input" value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, "_") }))}
                    placeholder="e.g. machine_005" />
                  <p style={{ fontSize: 10, color: "#4a5a7a", marginTop: 4 }}>Lowercase, no spaces</p>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Machine Name *</label>
                  <input id="fleet-machine-name" className="ep-input" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Epsilon Pump" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Machine Type</label>
                  <select id="fleet-machine-type" className="ep-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Zone / Location</label>
                  <select id="fleet-machine-zone" className="ep-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
              </div>

              {/* MQTT hint */}
              <div style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 11, color: "#00d4ff", fontWeight: 600, marginBottom: 4 }}>📡 MQTT Connection</p>
                <p style={{ fontSize: 11, color: "#8899bb", lineHeight: 1.5 }}>
                  After adding, stream sensor data to:<br />
                  <code style={{ color: "#a855f7", fontSize: 10 }}>edgepilot/sensors/{form.id || "<machine_id>"}</code>
                </p>
              </div>

              {formError && <p style={{ fontSize: 12, color: "#ff2d55", fontWeight: 600 }}>{formError}</p>}
              {formSuccess && (
                <div style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontSize: 12, color: "#00ff88", lineHeight: 1.6 }}>{formSuccess}</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: "14px 24px 20px", borderTop: "1px solid rgba(0,212,255,0.08)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowModal(false); setFormError(""); setFormSuccess("") }} className="ep-btn ep-btn-ghost">Cancel</button>
              <button id="fleet-submit-btn" onClick={handleAddMachine} disabled={submitting} className="ep-btn ep-btn-primary" style={{ opacity: submitting ? 0.6 : 1 }}>
                {submitting ? "Adding..." : "🏭 Register Machine"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
