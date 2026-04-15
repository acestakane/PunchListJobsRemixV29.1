import React from "react";
import TradeSelect from "../TradeSelect";
import { RefreshCw } from "lucide-react";

/**
 * Filters row for the Crew Dashboard: trade selector, radius picker, refresh button.
 */
export function JobFiltersRow({ grouped, tradeFilter, radius, onTradeChange, onRadiusChange, onRefresh }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      <div className="flex-1 min-w-[180px] max-w-xs">
        <TradeSelect
          grouped={grouped}
          value={tradeFilter}
          onChange={onTradeChange}
          placeholder="All Trades"
          data-testid="filter-trade-select"
        />
      </div>

      <select
        value={radius}
        onChange={e => onRadiusChange(Number(e.target.value))}
        className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
        data-testid="radius-select"
      >
        {[10, 25, 50, 100].map(r => <option key={r} value={r}>{r} mi</option>)}
      </select>

      <button
        onClick={onRefresh}
        className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center gap-1"
        data-testid="refresh-btn"
      >
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}
