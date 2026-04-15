import React from "react";
import { Zap } from "lucide-react";

export function ProfileBoostCard({ boostStatus, onActivateBoost }) {
  return (
    <div className="card p-5" data-testid="boost-section">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className={`w-4 h-4 ${boostStatus?.is_boosted ? "text-amber-500 fill-current" : "text-slate-400"}`} />
            <h3 className="font-bold text-[#050A30] dark:text-white text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Profile Boost</h3>
            {boostStatus?.is_boosted && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {boostStatus?.is_boosted
              ? `Boosted until ${new Date(boostStatus.expires_at).toLocaleDateString()}`
              : "Get seen first by contractors for 7 days"}
          </p>
        </div>
        {!boostStatus?.is_boosted && (
          <button onClick={onActivateBoost}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600"
            data-testid="boost-activate-btn">
            <Zap className="w-3.5 h-3.5" /> Boost · ${(boostStatus?.price ?? 4.99).toFixed(2)}
          </button>
        )}
      </div>
    </div>
  );
}
