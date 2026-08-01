"use client"
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts"
import { api } from "@/lib/api"
import { getUser, logout, PERMISSIONS, type User } from "@/lib/auth"

const POLL_MS = 4000
const QUESTIONS = [
  "Why is this machine overheating?",
  "What caused the latest anomaly?",
  "What maintenance should I perform?",
  "What is the current health status?",
  "Generate a quick maintenance report",
]

const sc = (v:number) => v>=75?"#34d399":v>=50?"#fbbf24":"#f87171"
const sb = (v:number) => v>=75?"border-emerald-500":v>=50?"border-yellow-500":"border-red-500"

function StatCard({label,value,unit="",warn=false,crit=false}:any){
  const color = crit?"#f87171":warn?"#fbbf24":"#fff"
  return(
    <div className={`rounded-xl p-4 border bg-[#1a2744] ${crit?"border-red-500":warn?"border-yellow-500":"border-[#1C7293]/30"}`}>
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{color}}>
        {value??'—'}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </p>
    </div>
  )
}

function AlertCard({a,onAck,canAck}:any){
  const crit = a.severity==="critical"
  return(
    <div className={`rounded-lg p-2.5 border-l-4 mb-2 ${crit?"border-red-500 bg-red-950/30":"border-yellow-500 bg-yellow-950/20"}`}>
      <div className="flex justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-1 ${crit?"bg-red-600":"bg-yellow-600"}`}>
            {a.severity?.toUpperCase()}
          </span>
          <span className="text-xs text-slate-500">{a.created_at||a.timestamp?.slice(11,19)}</span>
          <p className="text-xs text-white mt-1 break-words">{a.message}</p>
        </div>
        {canAck && !a.acknowledged && (
          <button onClick={()=>onAck(a.id)}
            className="shrink-0 text-xs bg-[#1C7293] hover:bg-teal-600 px-2 py-1 rounded">✓</button>
        )}
      </div>
    </div>
  )
}

export default function MissionControl(){
  const router  = useRouter()
  const [user,   setUser]   = useState<User|null>(null)
  const [data,   setData]   = useState<any>(null)
  const [trend,  setTrend]  = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [viols,  setViols]  = useState<any[]>([])
  const [maint,  setMaint]  = useState<any[]>([])
  const [recs, setRecs] = useState<any[]>([])
  const [story,  setStory]  = useState("")
  const [notes, setNotes] = useState<any[]>([])
  const [fleet, setFleet] = useState<any[]>([])
  const [safety, setSafety] = useState<any>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [storyLoad,setStoryLoad] = useState(false)
  const [copilotQ,setCopilotQ]   = useState("")
  const [copilotA,setCopilotA]   = useState("")
  const [copLoad, setCopLoad]    = useState(false)
  const [error,   setError]      = useState("")
  const [lastUp,  setLastUp]     = useState("")
  const [tab,     setTab]        = useState<"alerts"|"violations"|"maintenance">("alerts")
  const [trained, setTrained]    = useState(false)
  const [training,setTraining]   = useState(false)
  const alertCountRef = useRef(0)

  // Check auth on mount
  useEffect(()=>{
    const u = getUser()
    if(!u){ router.push("/login"); return }
    setUser(u)
  },[])

  const perms = user ? PERMISSIONS[user.role] : null

  const poll = useCallback(async()=>{
    try{
      const [dash,tr,al,v,m,ml,rec,noti,fleetData,safetyData] = await Promise.all([
        api.dashboard(), api.trend(25), api.alerts(15),
        api.violations(), api.maintenance(), api.mlStatus(), api.recommendations(), api.notifications(), api.fleet(), api.safety()
      ])
      const activeAlerts = Number(dash?.active_alerts ?? 0)
      if (activeAlerts > 0 && activeAlerts !== alertCountRef.current) {
        setToast(activeAlerts > alertCountRef.current ? `New alert activity: ${activeAlerts} active alert${activeAlerts > 1 ? "s" : ""}` : `Active alerts: ${activeAlerts}`)
      } else if (activeAlerts === 0 && alertCountRef.current > 0) {
        setToast("All clear — no active alerts")
      }
      alertCountRef.current = activeAlerts

      setData(dash); setTrend(tr.readings||[])
      setAlerts(al.alerts||[])
      setViols(v.violations?.slice(0,8)||[])
      setMaint(m.logs?.slice(0,8)||[])
      setRecs(rec.recommendations||[])
      setNotes(noti.notifications||[])
      setFleet(fleetData.machines||[])
      setSafety(safetyData || null)
      setTrained(ml.is_trained||false)
      setLastUp(new Date().toLocaleTimeString())
      setError("")
    }catch{
      setError("Backend not running — open Terminal 1 and run: py -3.11 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload")
    }
  },[])

  useEffect(()=>{
    if(!user) return
    poll()
    const id=setInterval(poll,POLL_MS)
    return()=>clearInterval(id)
  },[poll,user])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleCopilot(q:string){
    setCopilotQ(q);setCopilotA("");setCopLoad(true)
    try{const r=await api.copilot(q);setCopilotA(r.answer)}
    catch{setCopilotA("Copilot error — check GEMINI_API_KEY in .env")}
    setCopLoad(false)
  }

  async function handleStory(){
    setStoryLoad(true);setStory("")
    try{const r=await api.story();setStory(r.story||"No story yet")}
    catch{setStory("Error generating story")}
    setStoryLoad(false)
  }

  async function handleAck(id:number){
    await api.acknowledgeAlert(id); poll()
  }

  async function handleTrain(){
    setTraining(true)
    try{await api.trainModel();setTrained(true)}
    catch{}
    setTraining(false)
  }

  async function handleLogout(){
    await logout()
    setUser(null)
    router.replace("/login")
  }

  if(!user) return(
    <div className="min-h-screen bg-[#0f1729] flex items-center justify-center">
      <p className="text-slate-400">Loading...</p>
    </div>
  )

  const score  = data?.machineiq_score??0
  const unack  = alerts.filter((a:any)=>!a.acknowledged)
  const roleInfo = PERMISSIONS[user.role]

  return(
    <div className="min-h-screen bg-[#0f1729] p-4 max-w-7xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-teal-400/40 bg-[#0f1729]/95 px-4 py-3 text-sm text-teal-200 shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{color:"#1C7293"}}>⚡ EdgePilot AI</h1>
          <p className="text-xs text-slate-500">Mission Control · Team Tech Titans · Tata InnoVent</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Updated: {lastUp||"—"}</p>
            <div className="flex gap-2 justify-end mt-1">
              {data?.shift&&(
                <span className="text-xs bg-[#1C7293]/20 border border-[#1C7293]/40 px-2 py-0.5 rounded capitalize">
                  {data.shift} Shift
                </span>
              )}
              <span className="text-xs font-bold px-2 py-0.5 rounded"
                style={{background: roleInfo.color+"22", color: roleInfo.color}}>
                {roleInfo.label}
              </span>
            </div>
          </div>

          {/* User + Logout */}
          <div className="flex items-center gap-2 bg-[#1a2744] border border-[#1C7293]/30 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{background: roleInfo.color}}>
              {user.name[0].toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="text-xs text-white font-semibold">{user.name}</p>
              <p className="text-xs text-slate-400">{user.username}</p>
            </div>
            <button onClick={handleLogout}
              className="ml-2 text-xs text-slate-400 hover:text-red-400 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error&&(
        <div className="bg-red-900/40 border border-red-500 rounded-lg p-3 mb-4 text-sm text-red-300">
          ❌ {error}
        </div>
      )}

      {/* Viewer banner */}
      {user.role==="viewer"&&(
        <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3 mb-4 text-blue-300 text-sm">
          👁 You are in read-only view. Contact an Operator or Admin to make changes.
        </div>
      )}

      {/* Waiting */}
      {data?.status==="waiting_for_data"&&(
        <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-4 text-blue-300 text-sm">
          ⏳ Waiting for sensor data... Start: <code className="bg-black/30 px-1 rounded">py -3.11 simulator/simulate_sensors.py</code>
        </div>
      )}

      {/* MachineIQ Score */}
      {data?.machineiq_score!==undefined&&(
        <div className={`bg-[#1a2744] rounded-2xl p-5 mb-4 border-2 flex flex-wrap items-center justify-between gap-4 ${sb(score)}`}>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">MachineIQ Score</p>
            <p className="text-6xl font-black mt-1" style={{color:sc(score)}}>{score?.toFixed?.(0)??score}</p>
            <p className="text-slate-400 text-sm">/ 100</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <span className="text-slate-400">Readings: <b className="text-white">{data?.total_readings??0}</b></span>
            <span className="text-slate-400">Alerts: <b className={unack.length>0?"text-red-400":"text-emerald-400"}>{unack.length}</b></span>
            <span className="text-slate-400">RUL: <b className="text-white">{data?.rul_days===999?"Stable":data?.rul_days!==undefined?`~${data.rul_days}d`:"—"}</b></span>
            <span className="text-slate-400">Anomaly: <b className={data?.is_anomaly?"text-red-400 animate-pulse":"text-emerald-400"}>{data?.is_anomaly?"ACTIVE":"None"}</b></span>
          </div>
          {perms?.canTrainModel&&(
            <button onClick={handleTrain} disabled={training||trained}
              className="text-xs px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{background: trained?"#064e3b":"#1C7293"}}>
              {training?"Training...":trained?"✅ Model Trained":"🧠 Train ML Model"}
            </button>
          )}
        </div>
      )}

      {/* Fleet Overview */}
      <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20 mb-4">
        <p className="text-sm font-semibold mb-3" style={{color:"#1C7293"}}>🏭 Fleet Overview</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {fleet.map((machine:any)=> (
            <div key={machine.machine_id} className="rounded-lg border border-[#1C7293]/20 bg-[#21295C] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{machine.machine_id}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded ${machine.is_anomaly ? "bg-red-600/30 text-red-300" : "bg-emerald-600/30 text-emerald-300"}`}>
                  {machine.is_anomaly ? "Anomaly" : "Stable"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-400">
                <span>Health: <b className="text-white">{machine.health_score}</b></span>
                <span>Temp: <b className="text-white">{machine.temperature}°C</b></span>
                <span>Vibration: <b className="text-white">{machine.vibration}</b></span>
                <span>RPM: <b className="text-white">{machine.rpm}</b></span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Alerts: {machine.active_alerts} · {machine.last_alert || "No recent alert"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Monitoring */}
      <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{color:"#1C7293"}}>📷 Safety Monitor</p>
          <span className={`text-[10px] px-2 py-1 rounded ${safety?.status === "critical" ? "bg-red-600/30 text-red-300" : safety?.status === "attention" ? "bg-yellow-600/30 text-yellow-300" : "bg-emerald-600/30 text-emerald-300"}`}>
            {safety?.status || "ok"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg bg-[#21295C] p-3">
            <p className="text-xs text-slate-400">Camera Status</p>
            <p className="text-sm font-semibold text-white mt-1">Live feed ready</p>
          </div>
          <div className="rounded-lg bg-[#21295C] p-3">
            <p className="text-xs text-slate-400">Recent Violations</p>
            <p className="text-sm font-semibold text-white mt-1">{safety?.violation_count ?? 0}</p>
          </div>
          <div className="rounded-lg bg-[#21295C] p-3">
            <p className="text-xs text-slate-400">Latest Event</p>
            <p className="text-sm font-semibold text-white mt-1">{safety?.latest_violation || "No issues detected"}</p>
          </div>
        </div>
      </div>

      {/* Notification Strip */}
      <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20 mb-4">
        <p className="text-sm font-semibold mb-3" style={{color:"#1C7293"}}>🔔 Live Notifications</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {notes.map((note:any)=> (
            <div key={note.id} className="rounded-lg border border-[#1C7293]/20 bg-[#21295C] p-3">
              <p className="text-xs font-semibold text-white">{note.title}</p>
              <p className="text-xs text-slate-400 mt-1">{note.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Temperature"   value={data?.temperature?.toFixed(1)}   unit="°C"   warn={data?.temperature>70}  crit={data?.temperature>80}/>
        <StatCard label="Vibration"     value={data?.vibration?.toFixed(2)}     unit="mm/s" warn={data?.vibration>4.5}   crit={data?.vibration>6}/>
        <StatCard label="RPM"           value={data?.rpm?.toFixed(0)}                        warn={data?.rpm<1400}/>
        <StatCard label="Motor Current" value={data?.motor_current?.toFixed(2)} unit="A"    warn={data?.motor_current>15}/>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20">
          <p className="text-sm font-semibold mb-3" style={{color:"#1C7293"}}>🌡 Temperature Trend</p>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#5EEAD4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#5EEAD4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C729320"/>
              <XAxis dataKey="t" tick={{fill:"#94a3b8",fontSize:10}}/>
              <YAxis tick={{fill:"#94a3b8",fontSize:10}} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{background:"#1a2744",border:"1px solid #1C7293",borderRadius:8}}/>
              <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" label={{value:"Critical",fill:"#ef4444",fontSize:9}}/>
              <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{value:"Warning",fill:"#f59e0b",fontSize:9}}/>
              <Area type="monotone" dataKey="temp" stroke="#5EEAD4" fill="url(#tg)" strokeWidth={2} dot={false} name="Temp °C"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20">
          <p className="text-sm font-semibold mb-3" style={{color:"#1C7293"}}>💚 MachineIQ Score Trend</p>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C729320"/>
              <XAxis dataKey="t" tick={{fill:"#94a3b8",fontSize:10}}/>
              <YAxis tick={{fill:"#94a3b8",fontSize:10}} domain={[0,100]}/>
              <Tooltip contentStyle={{background:"#1a2744",border:"1px solid #1C7293",borderRadius:8}}/>
              <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 4" label={{value:"Critical",fill:"#ef4444",fontSize:9}}/>
              <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{value:"Warning",fill:"#f59e0b",fontSize:9}}/>
              <Area type="monotone" dataKey="health" stroke="#f59e0b" fill="url(#hg)" strokeWidth={2} dot={false} name="Health"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts / Violations / Maintenance + Copilot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Recommendations panel */}
        <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20">
          <p className="text-sm font-semibold mb-3" style={{color:"#1C7293"}}>🛠 Recommended Actions</p>
          <div className="space-y-2">
            {recs.map((item:any, idx:number)=>(
              <div key={idx} className="rounded-lg border border-[#1C7293]/20 bg-[#21295C] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${item.priority === "high" ? "bg-red-600/30 text-red-300" : item.priority === "medium" ? "bg-yellow-600/30 text-yellow-300" : "bg-emerald-600/30 text-emerald-300"}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabbed panel */}
        <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20">
          <div className="flex gap-1 mb-3">
            {(["alerts","violations","maintenance"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`text-xs px-3 py-1.5 rounded-lg capitalize transition-colors ${tab===t?"bg-[#1C7293] text-white":"bg-[#21295C] text-slate-400 hover:text-white"}`}>
                {t}
                {t==="alerts"&&unack.length>0&&(
                  <span className="ml-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{unack.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {tab==="alerts"&&(
              alerts.length===0
                ?<p className="text-slate-500 text-sm">No alerts — machine running normally</p>
                :alerts.map((a:any)=>(
                  <AlertCard key={a.id} a={a} onAck={handleAck} canAck={perms?.canResolveAlerts}/>
                ))
            )}
            {tab==="violations"&&(
              !perms?.canViewViolations
                ?<p className="text-slate-500 text-sm">🔒 Viewer role cannot access violations</p>
                :viols.length===0
                  ?<p className="text-slate-500 text-sm">No PPE violations logged</p>
                  :viols.map((v:any,i:number)=>(
                    <div key={i} className="bg-[#21295C] rounded-lg p-2.5 mb-2 border border-orange-500/30">
                      <p className="text-xs text-orange-400 font-bold">PPE VIOLATION</p>
                      <p className="text-xs text-white mt-1">{v.violation}</p>
                      <p className="text-xs text-slate-500">{v.created_at?.slice(0,19)}</p>
                    </div>
                  ))
            )}
            {tab==="maintenance"&&(
              maint.length===0
                ?<p className="text-slate-500 text-sm">No maintenance logged yet</p>
                :maint.map((m:any)=>(
                  <div key={m.id} className="bg-[#21295C] rounded-lg p-2.5 mb-2 border border-teal-500/30">
                    <p className="text-xs text-teal-400 font-bold capitalize">{m.type||m.maintenance_type}</p>
                    <p className="text-xs text-white mt-1">{m.description}</p>
                    <p className="text-xs text-slate-500">{m.timestamp?.slice(0,19)}</p>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* AI Copilot */}
        <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20">
          <p className="text-sm font-semibold mb-3" style={{color:"#1C7293"}}>🤖 AI Maintenance Copilot</p>
          {!perms?.canViewCopilot?(
            <div className="bg-[#21295C] rounded-lg p-4 text-center">
              <p className="text-slate-400 text-sm">🔒 AI Copilot requires Operator or Admin access</p>
            </div>
          ):(
            <>
              <div className="space-y-1 mb-3">
                {QUESTIONS.map(q=>(
                  <button key={q} onClick={()=>handleCopilot(q)}
                    className="w-full text-left text-xs bg-[#21295C] hover:bg-[#1C7293] px-3 py-2 rounded-lg transition-colors">
                    {q}
                  </button>
                ))}
              </div>
              {copLoad&&<p className="text-xs text-teal-400 animate-pulse">Analysing live sensor data...</p>}
              {copilotA&&(
                <div className="bg-[#0f1729] rounded-lg p-3 border border-teal-500/30 mt-2">
                  <p className="text-xs text-slate-400 italic mb-1">{copilotQ}</p>
                  <p className="text-sm text-white leading-relaxed">{copilotA}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Failure Story */}
      <div className="bg-[#1a2744] rounded-xl p-4 border border-[#1C7293]/20">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{color:"#1C7293"}}>📋 Failure Story (AI Analysis)</p>
          {perms?.canViewCopilot&&(
            <button onClick={handleStory} disabled={storyLoad}
              className="text-xs bg-[#1C7293] hover:bg-teal-600 disabled:opacity-50 px-3 py-1.5 rounded-lg">
              {storyLoad?"Generating...":"Generate Story"}
            </button>
          )}
        </div>
        {!perms?.canViewCopilot
          ?<p className="text-slate-500 text-sm">🔒 Requires Operator or Admin access</p>
          :story
            ?<p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{story}</p>
            :<p className="text-slate-500 text-sm">Click Generate to get a plain-language analysis.</p>
        }
      </div>

      <p className="text-center text-xs text-slate-700 mt-4">
        EdgePilot AI · Team Tech Titans · Tata Technologies InnoVent · Zero-Cloud Edge Intelligence
      </p>
    </div>
  )
}
