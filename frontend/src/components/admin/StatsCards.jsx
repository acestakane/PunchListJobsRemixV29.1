import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const PIE_COLORS = ["#0000FF", "#7EC8E3", "#10B981", "#F59E0B"];

export default function StatsCards({ statCards, metricsCards, analytics, pieData }) {
  return (
    <div className="space-y-6">
      {/* Primary stat cards: Total Users · Total Jobs · Completed Jobs · Revenue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500">{card.label}</span>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricsCards.map(m => (
          <div key={m.label} className="card p-3 text-center">
            <div className="text-xl font-extrabold text-[#0000FF]">{m.value}</div>
            <div className="text-xs font-semibold text-[#050A30] dark:text-white mt-0.5">{m.label}</div>
            <div className="text-xs text-slate-400">{m.note}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="font-bold text-[#050A30] dark:text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>User Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                labelLine={false}>
                {pieData.map((entry, i) => <Cell key={entry.name || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-[#050A30] dark:text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Jobs by Trade</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics?.jobs_by_trade || []} margin={{ top: 0, right: 0, left: -30, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="trade" tick={{ fill: "#94A3B8", fontSize: 10 }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, color: "#fff" }} />
              <Bar dataKey="count" fill="#0000FF" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-[#050A30] dark:text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Top Crew</h3>
          <div className="space-y-2">
            {(analytics?.top_crew || []).map((c, i) => (
              <div key={c.id || c.name || i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-4">#{i+1}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#050A30] dark:text-white truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{c.discipline || c.trade || "—"}</p>
                </div>
                <span className="text-xs font-bold text-emerald-600">{c.jobs_completed} jobs</span>
              </div>
            ))}
            {(!analytics?.top_crew || analytics.top_crew.length === 0) && (
              <p className="text-xs text-slate-400">No completed jobs yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="card p-6">
        <h3 className="font-bold text-[#050A30] dark:text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Recent Users</h3>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {analytics?.recent_users?.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
              <div className="w-8 h-8 bg-[#0000FF] rounded-full flex items-center justify-center text-white text-xs font-bold">
                {u.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#050A30] dark:text-white truncate">{u.name}</p>
                <p className="text-xs text-slate-500 capitalize">{u.role}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                u.subscription_status === "trial"  ? "bg-blue-100 text-blue-700"  :
                u.subscription_status === "active" ? "bg-green-100 text-green-700" :
                "bg-red-100 text-red-600"
              }`}>
                {u.subscription_status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
