import React from "react";

export function CancelRequestsPanel({ job, onAccept, onDeny }) {
  if (!job.cancel_requests?.length) return null;

  return (
    <div
      className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 space-y-2 border border-red-200 dark:border-red-700"
      data-testid={`cancel-req-panel-${job.id}`}
    >
      {job.cancel_requests.map(req => (
        <div key={req.crew_id} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{req.crew_name}</p>
            <p className="text-[10px] text-slate-500">Wants to cancel</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onAccept(job.id, req.crew_id)}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              data-testid={`accept-cancel-${job.id}-${req.crew_id}`}
            >
              Accept
            </button>
            <button
              onClick={() => onDeny(job.id, req.crew_id)}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              data-testid={`deny-cancel-${job.id}-${req.crew_id}`}
            >
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
