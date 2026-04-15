import React from "react";
import { Flag } from "lucide-react";

export function DisputeModal({ reason, onReasonChange, onSubmit, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-6 bg-black/50"
      data-testid="dispute-modal"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-[#050A30] dark:text-white mb-3 flex items-center gap-2">
          <Flag className="w-4 h-4 text-red-500" /> Report an Issue
        </h3>
        <textarea
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
          rows={4}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white mb-3 resize-none"
          placeholder="Describe the issue…"
          data-testid="dispute-reason-input"
        />
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors text-sm"
            data-testid="dispute-submit-btn"
          >
            Submit
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
