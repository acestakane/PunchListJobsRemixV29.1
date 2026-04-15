import React from "react";
import { US_STATES } from "./mapConstants";

export function MapLeftControls({
  profileAddress,
  mapMode,
  geocoding,
  onCurrentMode,
  onProfileMode,
  selectedState,
  onStateSelect,
  radiusMi,
  onRadiusChange,
}) {
  return (
    <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-auto">
      {profileAddress && (
        <div data-testid="map-mode-control">
          <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md overflow-hidden text-xs font-bold">
            <button
              onClick={onCurrentMode}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${mapMode === "current" ? "bg-blue-700 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              data-testid="map-mode-current"
            >
              Current Location
            </button>
            <button
              onClick={onProfileMode}
              disabled={geocoding}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap border-l border-slate-200 dark:border-slate-700 ${mapMode === "profile" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"} disabled:opacity-60`}
              data-testid="map-mode-profile"
            >
              {geocoding ? "Locating…" : "Profile Address"}
            </button>
          </div>
        </div>
      )}
      <select
        value={selectedState}
        onChange={onStateSelect}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-md focus:outline-none focus:border-blue-500 cursor-pointer max-w-[140px]"
        data-testid="state-selector"
      >
        <option value="">Jump to state...</option>
        {US_STATES.map(s => (
          <option key={s.name} value={s.name}>{s.name}</option>
        ))}
      </select>
      <select
        value={radiusMi || ""}
        onChange={e => onRadiusChange(e.target.value ? Number(e.target.value) : null)}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-md focus:outline-none focus:border-blue-500 cursor-pointer max-w-[140px]"
        data-testid="radius-select"
      >
        <option value="">All distances...</option>
        <option value="5">Within 5 mi</option>
        <option value="10">Within 10 mi</option>
        <option value="25">Within 25 mi</option>
        <option value="50">Within 50 mi</option>
        <option value="100">Within 100 mi</option>
      </select>
    </div>
  );
}
