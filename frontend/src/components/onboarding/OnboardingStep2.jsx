import React from "react";
import { MapPin, ArrowRight } from "lucide-react";

export function OnboardingStep2({
  address,
  suggestions,
  showSuggestions,
  fetchingSuggestions,
  suggestionsRef,
  savingAddress,
  onAddressChange,
  onFocus,
  onSuggestionSelect,
  onSkip,
  onSaveAndNext,
}) {
  return (
    <div>
      <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
        STEP 2 — Add Your Address
      </h3>
      <p className="text-slate-500 text-sm mb-4">Your exact address is never shown publicly — only street name and city.</p>

      <div className="relative mb-1" ref={suggestionsRef}>
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
        <input
          type="text"
          value={address}
          onChange={e => onAddressChange(e.target.value)}
          onFocus={onFocus}
          placeholder="123 Main St, Atlanta, GA 30301"
          className="w-full pl-9 pr-8 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
          data-testid="onboarding-address-input"
          onKeyPress={e => e.key === "Enter" && onSaveAndNext()}
          autoComplete="off"
        />
        {fetchingSuggestions && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#0000FF] border-t-transparent rounded-full animate-spin" />
        )}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i}
                onMouseDown={() => onSuggestionSelect(s)}
                className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <MapPin className="w-3.5 h-3.5 text-[#0000FF] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#050A30] dark:text-white leading-tight">
                    {s.city && s.state ? `${s.city}, ${s.state}` : s.full_address.split(",").slice(0, 2).join(",")}
                  </p>
                  <p className="text-xs text-slate-400 truncate max-w-xs">{s.full_address}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-3 pl-1">Start typing to auto-complete your address</p>

      <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 mb-5">
        <strong>Privacy:</strong> We only show street name + city on the map. Your exact address is never visible to other users.
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
          data-testid="skip-step-2"
        >
          Skip for now
        </button>
        <button
          onClick={onSaveAndNext}
          disabled={savingAddress || !address.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0000FF] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
          data-testid="next-step-2"
        >
          {savingAddress ? "Saving..." : <><span>Save & Next</span> <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}
