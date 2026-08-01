"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { PERMISSIONS, setSession, normalizeUser } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const response = await api.login(username, password)
      if (response?.token) {
        const user = normalizeUser({ username: response.user?.username || username, role: response.user?.role || "viewer" })
        if (user) {
          setSession(user, response.token)
          window.location.href = "/"
        } else {
          setError("Unable to create session")
          setLoading(false)
        }
      } else {
        setError("Invalid username or password")
        setLoading(false)
      }
    } catch {
      setError("Unable to reach the authentication server")
      setLoading(false)
    }
  }

  const roles = [
    { role: "Admin",    user: "admin",    pass: "admin123",  color: "#f59e0b", desc: "Full access — train models, manage alerts" },
    { role: "Operator", user: "operator", pass: "op123",     color: "#34d399", desc: "Resolve alerts, log maintenance" },
    { role: "Viewer",   user: "viewer",   pass: "view123",   color: "#60a5fa", desc: "Read-only dashboard access" },
  ]

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex">

      {/* Left panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: "linear-gradient(135deg, #21295C 0%, #065A82 50%, #1C7293 100%)" }}>

        {/* Logo */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black"
              style={{ background: "rgba(255,255,255,0.15)" }}>
              ⚡
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-wide">EdgePilot AI</h1>
              <p className="text-xs" style={{ color: "#BFD7E5" }}>Autonomous Heavy Machine Intelligence</p>
            </div>
          </div>
        </div>

        {/* Centre content */}
        <div>
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Zero-Cloud<br />Industrial<br />Intelligence
          </h2>
          <p className="text-lg mb-8" style={{ color: "#BFD7E5" }}>
            Real-time machine health monitoring, PPE safety detection,
            and AI-powered maintenance guidance — all running on-site
            without cloud dependency.
          </p>

          {/* Feature pills */}
          {[
            "⚙️  Predictive Maintenance",
            "📷  Computer Vision Safety",
            "🤖  AI Maintenance Copilot",
            "📊  Mission Control Dashboard",
          ].map(f => (
            <div key={f} className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400"/>
              <p className="text-sm text-white">{f}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div>
          <p className="text-xs" style={{ color: "#9FB8C9" }}>
            Team Tech Titans · Tata Technologies InnoVent
          </p>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-20">

        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-black" style={{ color: "#1C7293" }}>EdgePilot AI</h1>
        </div>

        <div className="max-w-md w-full mx-auto">
          <h2 className="text-3xl font-black text-white mb-1">Welcome back</h2>
          <p className="text-sm text-slate-400 mb-8">Sign in to your EdgePilot AI account</p>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Username */}
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-widest mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 outline-none transition-all text-sm"
                style={{
                  background: "#1a2744",
                  border: "1px solid #1C7293",
                }}
                onFocus={e => e.target.style.borderColor = "#5EEAD4"}
                onBlur={e  => e.target.style.borderColor = "#1C7293"}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 outline-none transition-all text-sm pr-12"
                  style={{
                    background: "#1a2744",
                    border: "1px solid #1C7293",
                  }}
                  onFocus={e => e.target.style.borderColor = "#5EEAD4"}
                  onBlur={e  => e.target.style.borderColor = "#1C7293"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white text-sm px-1">
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/40 border border-red-500 rounded-lg px-4 py-3 text-sm text-red-300">
                ❌ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-60"
              style={{ background: loading ? "#1C7293" : "linear-gradient(135deg, #1C7293, #065A82)" }}>
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
              Demo Credentials
            </p>
            <div className="space-y-2">
              {roles.map(r => (
                <button
                  key={r.role}
                  onClick={() => { setUsername(r.user); setPassword(r.pass); setError("") }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left hover:border-slate-500"
                  style={{ background: "#1a2744", border: "1px solid #1C7293" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: r.color + "22", color: r.color }}>
                      {r.role}
                    </span>
                    <span className="text-xs text-slate-400">{r.desc}</span>
                  </div>
                  <span className="text-xs text-slate-500">{r.user} / {r.pass}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2 text-center">
              Click any row to auto-fill credentials
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
