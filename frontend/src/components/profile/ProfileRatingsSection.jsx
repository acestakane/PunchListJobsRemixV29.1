import React from "react";
import { Star } from "lucide-react";

export function ProfileRatingsSection({ ratings }) {
  if (!ratings || ratings.length === 0) return null;
  return (
    <div className="card p-6">
      <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Recent Reviews</h3>
      <div className="space-y-3">
        {ratings.slice(0, 5).map(r => (
          <div key={r.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= r.stars ? "text-amber-400 fill-current" : "text-slate-300"}`} />
              ))}
            </div>
            {r.review && <p className="text-sm text-slate-600 dark:text-slate-300">{r.review}</p>}
            <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
