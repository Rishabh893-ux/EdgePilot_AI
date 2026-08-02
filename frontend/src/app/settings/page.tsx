"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [thresholds, setThresholds] = useState({ temp: 80, vib: 6, rpm: 1400 })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string|null>(null)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
    api.getThresholds().then(s => setThresholds({ temp: s.temp_limit||80, vib: s.vib_limit||6, rpm: s.rpm_min||1400 })).catch(()=>{})
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  const save = async () => {
    setLoading(true)
    try {
      await api.updateThresholds("machine_001", { temp_limit: thresholds.temp, vib_limit: thresholds.vib, rpm_min: thresholds.rpm } as any)
      setToast("Settings saved successfully!")
    } catch {
      setToast("Failed to save settings.")
    }
    setLoading(false)
  }

  if (!user) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#8899bb"}}>Loading...</div>

  const canEdit = user.role === "admin" || user.role === "operator"

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto" }}>
      {toast && <div style={{ position:"fixed", top:20, right:24, background:"#0d1526", border:"1px solid #00d4ff", borderRadius:10, padding:"10px 18px", fontSize:13, color:"#00d4ff", zIndex:50 }}>{toast}</div>}

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>⚙️ System Settings</h1>
      </div>

      <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.1)", padding: "24px 32px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#00d4ff", marginBottom: 20 }}>Machine Alert Thresholds</h2>
        
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#8899bb", marginBottom: 6 }}>Max Temperature (°C)</label>
            <input type="number" value={thresholds.temp} disabled={!canEdit} onChange={e => setThresholds(t => ({...t, temp: Number(e.target.value)}))} className="ep-input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#8899bb", marginBottom: 6 }}>Max Vibration (mm/s)</label>
            <input type="number" value={thresholds.vib} disabled={!canEdit} onChange={e => setThresholds(t => ({...t, vib: Number(e.target.value)}))} className="ep-input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#8899bb", marginBottom: 6 }}>Min RPM</label>
            <input type="number" value={thresholds.rpm} disabled={!canEdit} onChange={e => setThresholds(t => ({...t, rpm: Number(e.target.value)}))} className="ep-input" />
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {canEdit ? (
            <button onClick={save} disabled={loading} className="ep-btn ep-btn-primary">
              {loading ? "Saving..." : "Save Configuration"}
            </button>
          ) : (
            <p style={{ fontSize: 12, color: "#ff2d55" }}>🔒 You need Admin access to change settings.</p>
          )}
        </div>
      </div>
    </div>
  )
}
