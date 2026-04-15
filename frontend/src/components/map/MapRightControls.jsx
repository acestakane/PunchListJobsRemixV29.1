import React from "react";

export function MapRightControls({
  onRefresh,
  locating,
  onLocate,
  bearing,
  onRotateCCW,
  onResetNorth,
  onRotateCW,
  onZoomIn,
  onZoomOut,
}) {
  return (
    <div className="absolute top-3 right-3 flex flex-col gap-2 pointer-events-auto">
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Refresh markers"
          className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          data-testid="refresh-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          Refresh
        </button>
      )}
      <button
        onClick={onLocate}
        disabled={locating}
        title="Go to my location"
        className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-600 shadow-md hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
        data-testid="locate-btn"
      >
        {locating ? (
          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          </svg>
        )}
        {locating ? "Locating…" : "Locate"}
      </button>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md overflow-hidden flex items-center">
        <button
          onClick={onRotateCCW}
          title="Rotate counterclockwise 45°"
          className="px-2.5 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
          data-testid="rotate-ccw-btn"
        >
          ↺
        </button>
        <button
          onClick={onResetNorth}
          title={bearing === 0 ? "North up" : `${bearing}° — click to reset`}
          className="px-2 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors border-x border-slate-200 dark:border-slate-700 min-w-[38px] text-center tabular-nums"
          data-testid="reset-north-btn"
        >
          {bearing === 0 ? "N" : `${bearing}°`}
        </button>
        <button
          onClick={onRotateCW}
          title="Rotate clockwise 45°"
          className="px-2.5 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
          data-testid="rotate-cw-btn"
        >
          ↻
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md overflow-hidden flex items-center">
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
          data-testid="zoom-in-btn"
        >
          +
        </button>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="w-8 h-8 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
          data-testid="zoom-out-btn"
        >
          −
        </button>
      </div>
    </div>
  );
}
