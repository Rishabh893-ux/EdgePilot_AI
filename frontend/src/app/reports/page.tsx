"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type Report = {
  id: string
  type: string
  date: string
  status: string
  icon: string
  description: string
  machineId: string
  days: number
  downloadType: "csv" | "story" | "maintenance" | "safety"
}

function buildId(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function downloadJson(obj: object, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genModal, setGenModal] = useState(false)
  const [genType, setGenType] = useState("sensor_csv")
  const [genDays, setGenDays] = useState(7)
  const [genMsg, setGenMsg] = useState("")
  const [downloading, setDownloading] = useState<string | null>(null)
  const [storyModal, setStoryModal] = useState(false)
  const [storyContent, setStoryContent] = useState("")
  const [storyLoading, setStoryLoading] = useState(false)
  const [reports, setReports] = useState<Report[]>([
    {
      id: buildId("RPT"),
      type: "Sensor Data Export (30 days)",
      date: new Date().toISOString().slice(0, 10),
      status: "Ready",
      icon: "📡",
      description: "Full CSV export of all sensor readings for the last 30 days.",
      machineId: "machine_001",
      days: 30,
      downloadType: "csv",
    },
    {
      id: buildId("RPT"),
      type: "Sensor Data Export (7 days)",
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      status: "Ready",
      icon: "📊",
      description: "CSV export of the last 7 days of sensor readings.",
      machineId: "machine_001",
      days: 7,
      downloadType: "csv",
    },
    {
      id: buildId("RPT"),
      type: "AI Failure Story Report",
      date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
      status: "Ready",
      icon: "🤖",
      description: "AI-generated root-cause analysis and failure narrative.",
      machineId: "machine_001",
      days: 0,
      downloadType: "story",
    },
    {
      id: buildId("RPT"),
      type: "Maintenance History Log",
      date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
      status: "Ready",
      icon: "🔧",
      description: "Full maintenance log export as JSON.",
      machineId: "machine_001",
      days: 0,
      downloadType: "maintenance",
    },
  ])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
  }, [router])

  const handleDownload = async (report: Report) => {
    setDownloading(report.id)
    try {
      if (report.downloadType === "csv") {
        // Trigger real backend CSV download
        window.open(`${BASE}/api/machine/${report.machineId}/export?days=${report.days}`, "_blank")
      } else if (report.downloadType === "story") {
        setStoryLoading(true)
        setStoryModal(true)
        const s = await api.story()
        setStoryContent(
          `# AI Failure Story Report\n## Machine: ${s.machine_id || report.machineId}\n## Generated: ${new Date().toLocaleString()}\n\n### Story\n${s.story || "No failure story available."}\n\n### Root Cause\n${s.root_cause || "N/A"}\n\n### Health at Failure\n${s.health_at_failure != null ? s.health_at_failure : "N/A"}`
        )
        setStoryLoading(false)
      } else if (report.downloadType === "maintenance") {
        const m = await api.maintenance()
        downloadJson({
          generated: new Date().toISOString(),
          machine_id: report.machineId,
          total_logs: m.logs?.length || 0,
          logs: m.logs || [],
          recurring_patterns: m.recurring_patterns || [],
        }, `maintenance_log_${report.machineId}_${new Date().toISOString().slice(0, 10)}.json`)
      }
    } catch (e) {
      alert("Download failed — make sure the backend is running.")
    }
    setDownloading(null)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenMsg("")
    try {
      if (genType === "sensor_csv") {
        window.open(`${BASE}/api/machine/machine_001/export?days=${genDays}`, "_blank")
        const newReport: Report = {
          id: buildId("RPT"),
          type: `Sensor Data Export (${genDays} days)`,
          date: new Date().toISOString().slice(0, 10),
          status: "Downloaded",
          icon: "📡",
          description: `CSV export of the last ${genDays} days.`,
          machineId: "machine_001",
          days: genDays,
          downloadType: "csv",
        }
        setReports(r => [newReport, ...r])
        setGenMsg(`✅ CSV export started — check your downloads.`)
      } else if (genType === "failure_story") {
        setGenerating(true)
        const s = await api.story()
        const text = `# AI Failure Story Report\n## Machine: ${s.machine_id || "machine_001"}\n## Generated: ${new Date().toLocaleString()}\n\n${s.story || "No failure data available."}\n\nRoot Cause: ${s.root_cause || "N/A"}`
        downloadText(text, `failure_story_${new Date().toISOString().slice(0, 10)}.md`)
        setGenMsg("✅ Failure story downloaded.")
      } else if (genType === "maintenance_json") {
        const m = await api.maintenance()
        downloadJson({ generated: new Date().toISOString(), ...m }, `maintenance_${new Date().toISOString().slice(0, 10)}.json`)
        setGenMsg("✅ Maintenance JSON downloaded.")
      } else if (genType === "dashboard_snapshot") {
        const d = await api.dashboard()
        downloadJson({ generated: new Date().toISOString(), snapshot: d }, `dashboard_snapshot_${new Date().toISOString().slice(0, 10)}.json`)
        setGenMsg("✅ Dashboard snapshot downloaded.")
      }
    } catch {
      setGenMsg("❌ Failed — check backend is running on :8000")
    }
    setGenerating(false)
  }

  if (!user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8899bb" }}>Loading...</div>

  const STATUS_COLOR: Record<string, string> = {
    Ready: "#00d4ff", Downloaded: "#00ff88", Processing: "#ffb800"
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>EdgePilot AI</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>📋 Reports & Exports</h1>
          <p style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>Download sensor data, maintenance logs, and AI-generated reports</p>
        </div>
        <button
          id="generate-report-btn"
          onClick={() => { setGenModal(true); setGenMsg("") }}
          className="ep-btn ep-btn-primary"
        >
          ⚡ Generate New Report
        </button>
      </div>

      {/* Quick export row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Last 24h CSV", days: 1, icon: "⚡", color: "#00d4ff" },
          { label: "Last 7 Days CSV", days: 7, icon: "📊", color: "#a855f7" },
          { label: "Last 30 Days CSV", days: 30, icon: "📁", color: "#00ff88" },
          { label: "AI Story Report", days: 0, icon: "🤖", color: "#ffb800" },
        ].map(({ label, days, icon, color }) => (
          <button
            key={label}
            onClick={() => {
              if (days > 0) window.open(`${BASE}/api/machine/machine_001/export?days=${days}`, "_blank")
              else { setStoryLoading(true); setStoryModal(true); api.story().then(s => { setStoryContent(`# AI Failure Story\n\n${s.story || "No data."}\n\nRoot Cause: ${s.root_cause || "N/A"}`); setStoryLoading(false) }).catch(() => { setStoryContent("Error loading story."); setStoryLoading(false) }) }
            }}
            style={{ background: "rgba(13,21,38,0.9)", borderRadius: 12, border: `1px solid ${color}22`, padding: "14px 18px", cursor: "pointer", textAlign: "left", transition: "all 0.18s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}12`; (e.currentTarget as HTMLElement).style.borderColor = `${color}44` }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(13,21,38,0.9)"; (e.currentTarget as HTMLElement).style.borderColor = `${color}22` }}
          >
            <p style={{ fontSize: 22, marginBottom: 8 }}>{icon}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color, margin: 0 }}>{label}</p>
            <p style={{ fontSize: 10, color: "#4a5a7a", marginTop: 3 }}>Click to download ↓</p>
          </button>
        ))}
      </div>

      {/* Reports table */}
      <div style={{ background: "rgba(13,21,38,0.9)", borderRadius: 14, border: "1px solid rgba(0,212,255,0.08)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.15)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#00d4ff", margin: 0 }}>📂 Report History ({reports.length})</p>
        </div>

        <table className="ep-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Report Type</th>
              <th>Description</th>
              <th>Date</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize: 20 }}>{r.icon}</td>
                <td>
                  <div>
                    <p style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600, margin: 0 }}>{r.type}</p>
                    <p style={{ fontSize: 10, color: "#4a5a7a", marginTop: 2, fontFamily: "monospace" }}>{r.id}</p>
                  </div>
                </td>
                <td style={{ fontSize: 12, color: "#8899bb", maxWidth: 260 }}>{r.description}</td>
                <td style={{ fontSize: 12, color: "#c0d0e8" }}>{r.date}</td>
                <td>
                  <span style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 12, fontWeight: 700,
                    background: `${STATUS_COLOR[r.status] || "#8899bb"}18`,
                    color: STATUS_COLOR[r.status] || "#8899bb",
                    border: `1px solid ${STATUS_COLOR[r.status] || "#8899bb"}35`,
                  }}>{r.status}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    id={`download-${r.id}`}
                    onClick={() => handleDownload(r)}
                    disabled={downloading === r.id}
                    style={{
                      background: downloading === r.id ? "rgba(0,212,255,0.05)" : "rgba(0,212,255,0.1)",
                      border: "1px solid rgba(0,212,255,0.25)", color: "#00d4ff",
                      borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 600,
                      cursor: downloading === r.id ? "wait" : "pointer", transition: "all 0.15s",
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.18)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.1)"}
                  >
                    {downloading === r.id
                      ? <><span style={{ width: 10, height: 10, border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00d4ff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Preparing...</>
                      : "⬇ Download"
                    }
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generate Report Modal */}
      {genModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0d1526", border: "1px solid rgba(0,212,255,0.25)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 25px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: 17, color: "#f0f6ff" }}>⚡ Generate Report</p>
                <p style={{ fontSize: 11, color: "#8899bb", marginTop: 4 }}>Select type and download instantly</p>
              </div>
              <button onClick={() => setGenModal(false)} style={{ background: "none", border: "none", color: "#8899bb", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Report type */}
              <div>
                <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Report Type</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { value: "sensor_csv",        label: "📡 Sensor Data CSV",         desc: "Raw sensor readings as spreadsheet" },
                    { value: "failure_story",      label: "🤖 AI Failure Story",        desc: "Gemini-generated root cause report (.md)" },
                    { value: "maintenance_json",   label: "🔧 Maintenance History JSON", desc: "All maintenance logs as JSON" },
                    { value: "dashboard_snapshot", label: "📸 Dashboard Snapshot JSON",  desc: "Current machine state as JSON" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setGenType(opt.value)}
                      style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${genType === opt.value ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.07)"}`, background: genType === opt.value ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)", transition: "all 0.15s" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: genType === opt.value ? "#00d4ff" : "#c0d0e8", margin: 0 }}>{opt.label}</p>
                      <p style={{ fontSize: 11, color: "#4a5a7a", marginTop: 3 }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {genType === "sensor_csv" && (
                <div>
                  <label style={{ fontSize: 11, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>Date Range</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[1, 7, 14, 30].map(d => (
                      <button key={d} onClick={() => setGenDays(d)}
                        style={{ padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${genDays === d ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`, background: genDays === d ? "rgba(0,212,255,0.12)" : "transparent", color: genDays === d ? "#00d4ff" : "#8899bb" }}>
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {genMsg && <p style={{ fontSize: 12, color: genMsg.startsWith("✅") ? "#00ff88" : "#ff2d55", fontWeight: 600 }}>{genMsg}</p>}
            </div>
            <div style={{ padding: "14px 24px 20px", borderTop: "1px solid rgba(0,212,255,0.08)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setGenModal(false)} className="ep-btn ep-btn-ghost">Close</button>
              <button onClick={handleGenerate} disabled={generating} className="ep-btn ep-btn-primary" style={{ opacity: generating ? 0.6 : 1 }}>
                {generating ? "Generating..." : "⬇ Download Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Modal */}
      {storyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0d1526", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: "#f0f6ff" }}>🤖 AI Failure Story Report</p>
              <button onClick={() => setStoryModal(false)} style={{ background: "none", border: "none", color: "#8899bb", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
              {storyLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, gap: 12, flexDirection: "column" }}>
                  <div style={{ width: 32, height: 32, border: "3px solid rgba(168,85,247,0.2)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 13, color: "#8899bb" }}>Fetching AI analysis...</p>
                </div>
              ) : (
                <pre style={{ fontSize: 13, color: "#c0d0e8", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{storyContent}</pre>
              )}
            </div>
            {!storyLoading && storyContent && (
              <div style={{ padding: "14px 24px 20px", borderTop: "1px solid rgba(0,212,255,0.08)", display: "flex", gap: 10 }}>
                <button onClick={() => downloadText(storyContent, `failure_story_${new Date().toISOString().slice(0, 10)}.md`)} className="ep-btn ep-btn-primary">⬇ Download .md</button>
                <button onClick={() => navigator.clipboard.writeText(storyContent)} className="ep-btn ep-btn-ghost">📋 Copy</button>
                <button onClick={() => setStoryModal(false)} className="ep-btn ep-btn-ghost" style={{ marginLeft: "auto" }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
