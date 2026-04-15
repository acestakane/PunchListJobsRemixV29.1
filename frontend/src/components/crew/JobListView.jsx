import React from "react";
import { MapPin, Zap } from "lucide-react";
import JobCard from "../JobCard";

export function JobListView({
  loading,
  jobs,
  smartMatch,
  pendingIds,
  acceptedIds,
  onAccept,
  onComplete,
  onPreview,
  onShare,
  user,
  locationEnabled,
  userLocation,
  isExpired,
}) {
  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
      {locationEnabled && userLocation && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          GPS active — jobs sorted by distance from your location
        </div>
      )}
      {loading ? (
        Array(3).fill(0).map((_, i) => (
          <div key={`skeleton-${i}`} className="card p-4 animate-pulse h-32 bg-slate-200 dark:bg-slate-800" />
        ))
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No jobs found</p>
          <p className="text-slate-400 text-sm mt-1">Try enabling GPS or expanding radius</p>
        </div>
      ) : (
        jobs.map(job => (
          <div key={job.id} className="relative">
            {smartMatch && job.match_score !== undefined && (
              <div
                className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow"
                style={{
                  backgroundColor: job.match_score >= 0.7 ? "var(--theme-accent)" : job.match_score >= 0.45 ? "#fbbf24" : "#94a3b8",
                  color: "#050A30",
                }}
                data-testid={`match-score-${job.id}`}
              >
                <Zap className="w-3 h-3" />
                {Math.round(job.match_score * 100)}%
              </div>
            )}
            {pendingIds.includes(job.id) && (
              <div
                className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300"
                data-testid={`pending-badge-${job.id}`}
              >
                Pending
              </div>
            )}
            <JobCard
              job={job}
              onAccept={onAccept}
              onComplete={onComplete}
              onPreview={onPreview}
              onShare={acceptedIds.includes(job.id) && !pendingIds.includes(job.id) ? onShare : undefined}
              currentUser={user}
              isAccepted={acceptedIds.includes(job.id) || pendingIds.includes(job.id)}
              isPending={pendingIds.includes(job.id)}
              isExpired={isExpired}
              userLocation={locationEnabled ? userLocation : null}
            />
          </div>
        ))
      )}
    </div>
  );
}
