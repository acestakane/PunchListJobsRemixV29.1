import React from "react";
import { Search, MapPin, Zap, Users } from "lucide-react";
import { CrewCard } from "./CrewCard";

export function CrewSearchPanel({
  crewSearch,
  onSearchChange,
  grouped,
  crewSmartMatch,
  onToggleSmartMatch,
  onSearch,
  crew,
  onRequestCrew,
  onViewProfile,
  isViewerFree,
  pubSettings,
}) {
  return (
    <>
      <div className="card p-4">
        <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
          Search Crew
        </h3>
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Name..."
              value={crewSearch.name}
              onChange={e => onSearchChange(s => ({ ...s, name: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
              data-testid="crew-search-name"
            />
          </div>
          <select
            value={crewSearch.trade}
            onChange={e => onSearchChange(s => ({ ...s, trade: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
            data-testid="crew-search-trade"
          >
            <option value="">All Trades</option>
            {grouped.map(cat => (
              <optgroup key={cat.id} label={cat.name}>
                {(cat.trades || []).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Location (city, zip)..."
              value={crewSearch.address}
              onChange={e => onSearchChange(s => ({ ...s, address: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
              data-testid="crew-search-location"
            />
          </div>
          <select
            value={crewSearch.min_travel_radius}
            onChange={e => onSearchChange(s => ({ ...s, min_travel_radius: e.target.value }))}
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
            data-testid="crew-search-travel-radius"
          >
            <option value="">Any Travel Range</option>
            {[10, 25, 50, 100, 200].map(m => (
              <option key={m} value={m}>Travels {m}+ miles</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={onSearch}
              className="flex-1 bg-[#0000FF] text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
              data-testid="crew-search-btn"
            >
              Search
            </button>
            <button
              onClick={onToggleSmartMatch}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${crewSmartMatch ? "border-transparent text-[#050A30]" : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-[#0000FF]"}`}
              style={crewSmartMatch ? { backgroundColor: "var(--theme-accent)" } : {}}
              data-testid="crew-smart-match-btn"
            >
              <Zap className="w-4 h-4" /> Smart
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold text-[#050A30] dark:text-white text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>
          Available Crew ({crew.length})
        </h3>
        {crew.length === 0 ? (
          <div className="card p-6 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No crew found</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-350px)] overflow-y-auto grid grid-cols-1 gap-2">
            {crew.map(member => (
              <div key={member.id} className="relative">
                {crewSmartMatch && member.match_score !== undefined && (
                  <div
                    className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow"
                    style={{
                      backgroundColor: member.match_score >= 0.7 ? "var(--theme-accent)" : member.match_score >= 0.45 ? "#fbbf24" : "#94a3b8",
                      color: "#050A30",
                    }}
                    data-testid={`crew-score-${member.id}`}
                  >
                    <Zap className="w-3 h-3" />
                    {Math.round(member.match_score * 100)}%
                  </div>
                )}
                <CrewCard
                  member={member}
                  onRequest={onRequestCrew}
                  onViewProfile={onViewProfile}
                  isViewerFree={isViewerFree}
                  showTransportType={!!pubSettings.enable_crew_transportation_type}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
