import React from "react";
import {
  Share2, Eye, Copy, PauseCircle, PlayCircle, Ban, Archive,
  MessageCircle, UserCheck, AlertCircle, CheckCircle,
} from "lucide-react";

export function JobActionBar({
  job,
  applicantsJob,
  cancelReqJob,
  onToggleApplicants,
  onToggleCancelReq,
  onShare,
  onPreview,
  onCopy,
  onSuspend,
  onReactivate,
  onMessageCrew,
  onCancelJob,
  onArchiveCancelled,
  onDelete,
}) {
  return (
    <div className="flex items-center gap-1 px-1 pb-1">
      {job.crew_pending?.length > 0 && (
        <button
          onClick={() => onToggleApplicants(job.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${applicantsJob === job.id ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
          data-testid={`applicants-btn-${job.id}`}
        >
          <UserCheck className="w-3 h-3" />
          {job.crew_pending.length} Pending
        </button>
      )}
      {job.status === "pending_complete" && (
        <button
          onClick={() => onToggleApplicants(job.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${applicantsJob === job.id ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
          data-testid={`approve-complete-btn-${job.id}`}
        >
          <CheckCircle className="w-3 h-3" />
          Approve Completion
        </button>
      )}
      {job.cancel_requests?.length > 0 && (
        <button
          onClick={() => onToggleCancelReq(job.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${cancelReqJob === job.id ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
          data-testid={`cancel-req-btn-${job.id}`}
        >
          <AlertCircle className="w-3 h-3" />
          {job.cancel_requests.length} Cancel Req
        </button>
      )}
      <button onClick={() => onShare(job)} title="Share job link"
        className="p-1.5 rounded text-slate-400 hover:text-[#0000FF] hover:bg-blue-50 transition-colors"
        data-testid={`share-job-${job.id}`}>
        <Share2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onPreview(job)} title="Preview"
        className="p-1.5 rounded text-slate-400 hover:text-[#0000FF] hover:bg-blue-50 transition-colors"
        data-testid={`preview-job-${job.id}`}>
        <Eye className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onCopy(job)} title="Copy & edit"
        className="p-1.5 rounded text-slate-400 hover:text-[#0000FF] hover:bg-blue-50 transition-colors"
        data-testid={`copy-job-${job.id}`}>
        <Copy className="w-3.5 h-3.5" />
      </button>
      {["open", "fulfilled"].includes(job.status) && (
        <button onClick={() => onSuspend(job.id)} title="Suspend"
          className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          data-testid={`suspend-job-${job.id}`}>
          <PauseCircle className="w-3.5 h-3.5" />
        </button>
      )}
      {job.status === "suspended" && (
        <button onClick={() => onReactivate(job.id)} title="Reactivate"
          className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
          data-testid={`reactivate-job-${job.id}`}>
          <PlayCircle className="w-3.5 h-3.5" />
        </button>
      )}
      {job.crew_accepted?.length > 0 && (
        <button onClick={() => onMessageCrew(job.id)} title="Message crew"
          className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          data-testid={`message-crew-${job.id}`}>
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
      )}
      {["open", "fulfilled", "suspended"].includes(job.status) && (
        <button onClick={() => onCancelJob(job.id)} title="Cancel job"
          className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          data-testid={`cancel-job-${job.id}`}>
          <Ban className="w-3.5 h-3.5" />
        </button>
      )}
      {job.status === "cancelled" && (
        <button onClick={() => onArchiveCancelled(job.id)} title="Archive"
          className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          data-testid={`archive-cancelled-${job.id}`}>
          <Archive className="w-3.5 h-3.5" />
        </button>
      )}
      {job.status !== "in_progress" && job.status !== "cancelled" && (
        <button onClick={() => onDelete(job.id)} title="Archive job"
          className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          data-testid={`delete-job-${job.id}`}>
          <Archive className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
