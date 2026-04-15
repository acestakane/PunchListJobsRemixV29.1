import React from "react";
import { Eye } from "lucide-react";
import JobCard from "../JobCard";

export function JobPreviewModal({ job, onClose }) {
  if (!job) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[11] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="card p-3 mb-3 bg-blue-50 dark:bg-blue-950 flex items-center justify-center gap-2">
          <Eye className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Crew Preview</p>
        </div>
        <JobCard
          job={{ ...job, id: job.id || "preview", status: job.status || "open", crew_accepted: [] }}
          currentUser={{ role: "crew" }}
        />
        <button
          onClick={onClose}
          className="mt-3 w-full py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
          data-testid="close-preview-btn"
        >
          Close Preview
        </button>
      </div>
    </div>
  );
}
