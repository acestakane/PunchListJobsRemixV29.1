import React from "react";
import {
  MapPin, List, Zap, Navigation, ToggleLeft, ToggleRight,
} from "lucide-react";

/**
 * Header row for the Crew Dashboard:
 * username greeting, online/location toggles, map/list toggle, smart-match button.
 */
export function CrewDashboardHeader({
  user,
  connected,
  isOnline,
  locationEnabled,
  view,
  smartMatch,
  onToggleOnline,
  onToggleLocation,
  onViewChange,
  onToggleSmartMatch,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
          {user?.name?.split(" ")[0]}'s Dashboard
        </h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full capitalize"
            data-testid="user-role-badge"
          >
            Crew Member
          </span>
          <span className="text-slate-400 text-xs">·</span>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
            {connected ? "Live updates active" : "Connecting..."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onToggleOnline}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all
            ${isOnline ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"}`}
          data-testid="online-status-toggle"
        >
          {isOnline ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {isOnline ? "Online" : "Offline"}
        </button>

        <button
          onClick={onToggleLocation}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all
            ${locationEnabled ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"}`}
          data-testid="location-toggle"
        >
          {locationEnabled ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              <Navigation className="w-4 h-4" />
              GPS ON
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Use My Location
            </>
          )}
        </button>

        <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
          <button
            onClick={() => onViewChange("map")}
            className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 transition-colors
              ${view === "map" ? "bg-[#0000FF] text-white" : "text-slate-500"}`}
            data-testid="view-map-btn"
          >
            <MapPin className="w-4 h-4" /> Map
          </button>
          <button
            onClick={() => onViewChange("list")}
            className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 transition-colors
              ${view === "list" ? "bg-[#0000FF] text-white" : "text-slate-500"}`}
            data-testid="view-list-btn"
          >
            <List className="w-4 h-4" /> List
          </button>
        </div>

        <button
          onClick={onToggleSmartMatch}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-colors
            ${smartMatch ? "border-transparent text-[#050A30]" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#0000FF]"}`}
          style={smartMatch ? { backgroundColor: "var(--theme-accent)" } : {}}
          data-testid="smart-match-btn"
        >
          <Zap className="w-4 h-4" /> Smart Match
        </button>
      </div>
    </div>
  );
}
