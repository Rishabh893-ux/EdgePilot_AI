"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { getUser, PERMISSIONS, type User } from "@/lib/auth"

const PRESET_QUESTIONS = [
  { q: "Why is this machine overheating?",    icon: "🌡", cat: "Temperature" },
  { q: "What caused the latest anomaly?",     icon: "⚡", cat: "Anomaly" },
  { q: "What maintenance should I perform?",  icon: "🔧", cat: "Maintenance" },
  { q: "What is the current health status?",  icon: "💚", cat: "Health" },
  { q: "Generate a quick maintenance report", icon: "📋", cat: "Report" },
  { q: "Is the vibration level dangerous?",   icon: "📳", cat: "Vibration" },
  { q: "What is the predicted RUL?",          icon: "⏱",  cat: "RUL" },
  { q: "Analyze my acoustic frequency data",  icon: "🔊", cat: "Acoustic" },
]

interface Message { role: "user" | "ai"; text: string; time: string }

export default function CopilotPage() {
  const router = useRouter()
  const [user, setUser]   = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [woModal, setWoModal] = useState(false)
  const [workOrder, setWorkOrder] = useState("")
  const [woLoading, setWoLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const u = getUser()
    if (!u) { router.push("/login"); return }
    setUser(u)
    setMessages([{
      role: "ai",
      text: "👋 Hello! I'm your EdgePilot AI Maintenance Copilot. I have real-time access to machine_001's sensor data. Ask me anything about the machine's health, anomalies, or maintenance needs!",
      time: new Date().toLocaleTimeString(),
    }])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const ask = async (q: string) => {
    if (!q.trim() || loading) return
    const userMsg: Message = { role: "user", text: q, time: new Date().toLocaleTimeString() }
    setMessages(m => [...m, userMsg])
    setInput("")
    setLoading(true)
    try {
      const r = await api.copilot(q)
      setMessages(m => [...m, { role: "ai", text: r.answer || "No response from copilot.", time: new Date().toLocaleTimeString() }])
    } catch {
      setMessages(m => [...m, { role: "ai", text: "⚠️ Copilot error — check GEMINI_API_KEY in .env", time: new Date().toLocaleTimeString() }])
    }
    setLoading(false)
  }

  const handleWorkOrder = async () => {
    setWoModal(true); setWoLoading(true); setWorkOrder("")
    try {
      const r = await api.generateWorkOrder("machine_001")
      setWorkOrder(r.work_order || "Could not generate work order.")
    } catch { setWorkOrder("Error — check Gemini API key in .env") }
    setWoLoading(false)
  }

  const perms = user ? PERMISSIONS[user.role] : null

  if (!user) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#8899bb"}}>Loading...</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>
      {/* Header */}
      <div style={{ padding: "24px 0 16px", borderBottom: "1px solid rgba(0,212,255,0.08)", flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 4 }}>EdgePilot AI</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f0f6ff", margin: 0 }}>🤖 AI Maintenance Copilot</h1>
          {perms?.canViewCopilot && (
            <button onClick={handleWorkOrder} style={{
              background: "linear-gradient(135deg,#92400e,#ffb800)", color: "#fff",
              border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12,
              fontWeight: 700, cursor: "pointer", display:"flex", alignItems:"center", gap:6
            }}>🎫 Generate Work Order</button>
          )}
        </div>
      </div>

      {!perms?.canViewCopilot ? (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ textAlign:"center", padding:40 }}>
            <p style={{ fontSize:36, marginBottom:12 }}>🔒</p>
            <p style={{ color:"#8899bb", fontSize:14 }}>AI Copilot requires Operator or Admin access.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Preset question grid */}
          <div style={{ padding:"16px 0 8px", flexShrink:0 }}>
            <p style={{ fontSize:11, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Quick Questions</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8 }}>
              {PRESET_QUESTIONS.map(({ q, icon, cat }) => (
                <button key={q} onClick={() => ask(q)} style={{
                  background:"rgba(13,21,38,0.9)", border:"1px solid rgba(0,212,255,0.1)",
                  borderRadius:10, padding:"10px 14px", cursor:"pointer", textAlign:"left",
                  transition:"all 0.18s",
                }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(0,212,255,0.35)"; (e.currentTarget as HTMLElement).style.background="rgba(0,212,255,0.05)"}}
                   onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(0,212,255,0.1)";  (e.currentTarget as HTMLElement).style.background="rgba(13,21,38,0.9)"}}>
                  <span style={{ fontSize:16, display:"block", marginBottom:4 }}>{icon}</span>
                  <span style={{ fontSize:10, color:"#00d4ff", textTransform:"uppercase", letterSpacing:"0.06em" }}>{cat}</span>
                  <p style={{ fontSize:11, color:"#8899bb", marginTop:2, lineHeight:1.4 }}>{q}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 0", display:"flex", flexDirection:"column", gap:12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display:"flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth:"78%", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding:"12px 16px",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg,#1C7293,#00d4ff)"
                    : "rgba(13,21,38,0.95)",
                  border: msg.role === "ai" ? "1px solid rgba(0,212,255,0.12)" : "none",
                  boxShadow: msg.role === "user" ? "0 4px 14px rgba(0,212,255,0.2)" : "none",
                }}>
                  <p style={{ fontSize:13, color:"#f0f6ff", lineHeight:1.6, margin:0, whiteSpace:"pre-wrap" }}>{msg.text}</p>
                  <p style={{ fontSize:9, color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "#4a5a7a", marginTop:6, textAlign:"right" }}>{msg.time}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:"flex", justifyContent:"flex-start" }}>
                <div style={{ background:"rgba(13,21,38,0.95)", border:"1px solid rgba(0,212,255,0.12)", borderRadius:"16px 16px 16px 4px", padding:"14px 20px" }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#00d4ff", opacity:0.8, animation:`data-pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />
                    ))}
                    <span style={{ fontSize:11, color:"#8899bb", marginLeft:4 }}>Analysing live sensor data...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding:"12px 0 20px", flexShrink:0, borderTop:"1px solid rgba(0,212,255,0.08)" }}>
            <div style={{ display:"flex", gap:10 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && ask(input)}
                placeholder="Ask anything about machine_001..."
                className="ep-input"
                style={{ flex:1 }}
              />
              <button onClick={() => ask(input)} disabled={!input.trim() || loading}
                className="ep-btn ep-btn-primary" style={{ flexShrink:0, opacity: !input.trim() || loading ? 0.5 : 1 }}>
                Send ↑
              </button>
            </div>
            <p style={{ fontSize:10, color:"#4a5a7a", marginTop:6 }}>Powered by Google Gemini · Grounded on real sensor data · Press Enter to send</p>
          </div>
        </>
      )}

      {/* Work Order Modal */}
      {woModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#0d1526", border:"1px solid rgba(0,212,255,0.2)", borderRadius:16, width:"100%", maxWidth:680, maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 25px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(0,212,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"start" }}>
              <div>
                <p style={{ fontWeight:700, fontSize:16, color:"#f0f6ff" }}>🎫 Work Order Ticket</p>
                <p style={{ fontSize:11, color:"#8899bb", marginTop:4 }}>AI-generated Jira/ServiceNow-style maintenance ticket</p>
              </div>
              <button onClick={() => setWoModal(false)} style={{ background:"none", border:"none", color:"#8899bb", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ overflowY:"auto", flex:1, padding:"20px 24px" }}>
              {woLoading ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:160, gap:12 }}>
                  <div style={{ width:36, height:36, border:"3px solid rgba(0,212,255,0.2)", borderTopColor:"#00d4ff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                  <p style={{ fontSize:13, color:"#8899bb" }}>Generating ticket from live sensor data...</p>
                </div>
              ) : (
                <pre style={{ fontSize:13, color:"#c0d0e8", lineHeight:1.7, whiteSpace:"pre-wrap", fontFamily:"inherit" }}>{workOrder}</pre>
              )}
            </div>
            {!woLoading && workOrder && (
              <div style={{ padding:"14px 24px 20px", borderTop:"1px solid rgba(0,212,255,0.08)", display:"flex", justifyContent:"space-between" }}>
                <button onClick={() => navigator.clipboard.writeText(workOrder)} className="ep-btn ep-btn-primary">📋 Copy to Clipboard</button>
                <button onClick={() => setWoModal(false)} className="ep-btn ep-btn-ghost">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
