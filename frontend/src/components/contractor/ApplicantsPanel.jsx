import React from "react";
import { CheckCircle } from "lucide-react";

/**
 * Shows applicants panel inline below a job card.
 * Handles both pending applicants and per-crew completion approvals.
 */
export function ApplicantsPanel({ job, applicantDetails, onApproveComplete, onApproveApplicant, onDeclineApplicant }) {
  const isPendingComplete = job.status === "pending_complete";

  return (
    <div
      className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 space-y-2 border border-amber-200 dark:border-amber-700"
      data-testid={`applicants-panel-${job.id}`}
    >
      {isPendingComplete ? (
        /* Per-crew completion approval panel */
        (() => {
          const pending = (applicantDetails[job.id] || []).filter(c => {
            const a = (job.crew_assignments || []).find(x => x.crew_id === c.id);
            return a?.status === "pending_complete";
          });
          return pending.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-1">All crew approvals processed</p>
          ) : pending.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{c.name}</p>
                <p className="text-[10px] text-slate-500">{c.discipline || c.trade || "—"} · Awaiting your approval</p>
              </div>
              <button
                onClick={() => onApproveComplete(job.id, c.id, c.name)}
                className="flex-shrink-0 px-2 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded"
                data-testid={`approve-btn-${c.id}`}
              >
                Approve
              </button>
            </div>
          ));
        })()
      ) : (
        /* Regular applicants panel */
        !applicantDetails[job.id]?.length ? (
          <p className="text-xs text-slate-400 text-center py-1">Loading applicants…</p>
        ) : (applicantDetails[job.id] || []).map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{c.name}</p>
              <p className="text-[10px] text-slate-500">{c.discipline || c.trade || "General"} · ⭐ {c.rating?.toFixed(1) || "New"}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => onApproveApplicant(job.id, c.id)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                data-testid={`approve-${job.id}-${c.id}`}
              >
                Approve
              </button>
              <button
                onClick={() => onDeclineApplicant(job.id, c.id)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                data-testid={`decline-${job.id}-${c.id}`}
              >
                Decline
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
