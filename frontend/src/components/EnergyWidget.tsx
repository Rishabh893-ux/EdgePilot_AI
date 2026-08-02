"use client"
import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

function StatCard({label,value,unit=""}:any){
  return(
    <div className={`rounded-xl p-4 border bg-[#1a2744] border-emerald-500/50`}>
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">
        {value??'—'}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </p>
    </div>
  )
}

export default function EnergyWidget({ data, trend }: { data: any, trend: any[] }) {
  if (data?.status === "waiting_for_data" || data?.power_kw === undefined) {
    return null;
  }

  return (
    <div className="bg-[#1a2744] rounded-xl p-4 border border-emerald-500/20 mb-4">
      <p className="text-sm font-semibold mb-3 text-emerald-400">🌱 Energy & Carbon Tracking</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Stats */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <StatCard label="Power Draw" value={data?.power_kw?.toFixed(2)} unit="kW" />
          <StatCard label="Carbon Emission" value={data?.carbon_emission?.toFixed(2)} unit="kg CO₂/h" />
        </div>

        {/* Trend Chart */}
        <div className="md:col-span-2 bg-[#21295C] rounded-xl p-4 border border-[#1C7293]/20">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Power Draw Trend</p>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1C729320"/>
                <XAxis dataKey="t" tick={{fill:"#94a3b8",fontSize:10}}/>
                <YAxis tick={{fill:"#94a3b8",fontSize:10}} domain={["auto","auto"]}/>
                <Tooltip contentStyle={{background:"#1a2744",border:"1px solid #1C7293",borderRadius:8}}/>
                <Area type="monotone" dataKey="power_kw" stroke="#10b981" fill="url(#powerGrad)" strokeWidth={2} dot={false} name="Power (kW)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
