import React from "react";
import { CheckCircle } from "lucide-react";

export function OnboardingStep3({ isOnline, onToggle, onSkip, onFinish }) {
  return (
    <div className="text-center">
      <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
        STEP 3 — Enable Map Visibility
      </h3>
      <p className="text-slate-500 text-sm mb-6">Flip the switch to appear on the live job map and get hired.</p>

      <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-left">
            <p className="font-bold text-[#050A30] dark:text-white">
              {isOnline ? "LIVE ON MAP" : "OFFLINE"}
            </p>
            <p className="text-xs text-slate-500">
              {isOnline ? "Contractors can find and hire you" : "Flip switch to appear on map"}
            </p>
          </div>
          <button
            onClick={onToggle}
            className={`w-16 h-8 rounded-full flex items-center px-1 transition-colors cursor-pointer ${isOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
            data-testid="onboarding-visibility-toggle"
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${isOnline ? "translate-x-8" : ""}`} />
          </button>
        </div>

        {isOnline && (
          <div className="flex items-center gap-2 mt-3 text-emerald-600 text-sm font-semibold">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            You will appear on the live job map
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
          data-testid="skip-step-3"
        >
          Maybe later
        </button>
        <button
          onClick={onFinish}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0000FF] text-white rounded-xl text-sm font-bold hover:bg-blue-700"
          data-testid="finish-onboarding"
        >
          <CheckCircle className="w-4 h-4" /> Finish Setup
        </button>
      </div>
    </div>
  );
}
