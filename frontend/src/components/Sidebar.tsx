"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { getUser, logout, PERMISSIONS, type User } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"

const NAV = [
  { href: "/",          icon: "⚡", label: "Mission Control" },
  { href: "/analytics", icon: "📊", label: "Analytics" },
  { href: "/alerts",    icon: "🚨", label: "Alerts" },
  { href: "/fleet",     icon: "🏭", label: "Fleet" },
  { href: "/copilot",   icon: "🤖", label: "AI Copilot" },
  { href: "/reports",   icon: "📋", label: "Reports" },
  { href: "/violations",icon: "🦺", label: "Safety" },
  { href: "/maintenance",icon:"🔧", label: "Maintenance" },
  { href: "/settings",  icon: "⚙️", label: "Settings" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [user,   setUser]   = useState<User|null>(null)
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    const u = getUser()
    setUser(u)
    // Poll system status every 5s
    const fetch = () => api.systemStatus().then(s => setStatus(s)).catch(()=>{})
    fetch()
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }

  const isLive = status?.mqtt_connected === true
  const roleInfo = user ? PERMISSIONS[user.role] : null

  return (
    <aside style={{
      width: "220px",
      minHeight: "100vh",
      background: "linear-gradient(180deg, #020817 0%, #040d21 100%)",
      borderRight: "1px solid rgba(0,212,255,0.08)",
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 0,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(0,212,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "10px",
            background: "linear-gradient(135deg, #1C7293, #00d4ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", boxShadow: "0 0 20px rgba(0,212,255,0.3)",
          }}>⚡</div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.01em" }}>EdgePilot</p>
            <p style={{ fontSize: "10px", color: "#4a5a7a", letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Platform</p>
          </div>
        </div>
        {/* Live status */}
        <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span className={`status-dot ${isLive ? "live" : "off"}`} />
          <span style={{ fontSize: "10px", color: isLive ? "#00ff88" : "#4a5a7a", fontWeight: 600 }}>
            {isLive ? "LIVE DATA" : "OFFLINE"}
          </span>
          {status && <span style={{ fontSize: "10px", color: "#4a5a7a", marginLeft: "auto" }}>{status.readings_processed ?? 0} pts</span>}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "9px 12px", borderRadius: "9px", marginBottom: "2px",
              fontSize: "13px", fontWeight: active ? 600 : 400,
              color: active ? "#00d4ff" : "#8899bb",
              background: active ? "rgba(0,212,255,0.08)" : "transparent",
              border: active ? "1px solid rgba(0,212,255,0.15)" : "1px solid transparent",
              transition: "all 0.18s",
              textDecoration: "none",
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#c0d0e8" } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#8899bb" } }}
            >
              <span style={{ fontSize: "15px", flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: "13px" }}>{label}</span>
              {href === "/alerts" && status?.active_alerts > 0 && (
                <span style={{
                  marginLeft: "auto", background: "#ff2d55", color: "#fff",
                  fontSize: "9px", fontWeight: 800, padding: "1px 6px",
                  borderRadius: "20px", minWidth: 18, textAlign: "center"
                }}>{status.active_alerts}</span>
              )}
            </Link>
          )
        })}
      </nav>

    {/* User Footer */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(0,212,255,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
        
        {/* Theme Toggle */}
        <button onClick={() => {
          const isLight = document.documentElement.classList.contains("light")
          if (isLight) {
            document.documentElement.classList.remove("light")
            localStorage.setItem("theme", "dark")
          } else {
            document.documentElement.classList.add("light")
            localStorage.setItem("theme", "light")
          }
        }} style={{
          background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)",
          color: "#00d4ff", padding: "6px 12px", borderRadius: "6px",
          fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "center", gap: 6,
          transition: "all 0.2s"
        }}>
          🌓 Toggle Theme
        </button>

        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `linear-gradient(135deg, ${roleInfo?.color || "#1C7293"}, #00d4ff)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>{user.name[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#f0f6ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</p>
              <p style={{ fontSize: "10px", color: roleInfo?.color || "#4a5a7a", textTransform: "capitalize" }}>{user.role}</p>
            </div>
            <button onClick={handleLogout} title="Sign out" style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#4a5a7a", fontSize: "14px", padding: "4px", borderRadius: "6px",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ff2d55"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#4a5a7a"}
            >⏻</button>
          </div>
        )}
      </div>
    </aside>
  )
}

