import React from "react";
import {
  Ban, BellOff, PauseCircle, MessageCircle, Navigation, Calendar,
  CheckCircle, Copy, Archive, Flag, Star, X, Loader2,
} from "lucide-react";

const PAST_STATUSES = ["completed", "past", "cancelled", "suspended"];

export function ItineraryActionBar({
  selectedJob,
  isContractor,
  isCrew,
  actionLoading,
  crewCompleteLoading,
  user,
  onAction,
  onCrewComplete,
  onApproveCrew,
  onOpenDispute,
  onOpenRating,
  onDeselect,
}) {
  return (
    <div
      data-testid="itinerary-footer-bar"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl transition-all duration-300
        ${selectedJob ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}`}
    >
      {selectedJob && (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">

            {/* Job title label */}
            <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:block truncate max-w-36">
              {selectedJob.title}
            </span>

            {/* Cancel — Contractor only */}
            {isContractor && (
              <button
                onClick={() => onAction("cancel")}
                disabled={!!actionLoading}
                data-testid="footer-cancel-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "cancel"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Ban className="w-3.5 h-3.5" />}
                Cancel
              </button>
            )}

            {/* Cancel Notify — Crew only */}
            {isCrew && (
              <button
                onClick={() => onAction("cancel-notify")}
                disabled={!!actionLoading}
                data-testid="footer-cancel-notify-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-orange-600 border border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "cancel-notify"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <BellOff className="w-3.5 h-3.5" />}
                Cancel Notify
              </button>
            )}

            {/* Suspend — Contractor only */}
            {isContractor && (
              <button
                onClick={() => onAction("suspend")}
                disabled={!!actionLoading}
                data-testid="footer-suspend-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-600 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "suspend"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <PauseCircle className="w-3.5 h-3.5" />}
                Suspend
              </button>
            )}

            {/* Request Suspend — Crew only */}
            {isCrew && (
              <button
                onClick={() => onAction("request-suspend")}
                disabled={!!actionLoading}
                data-testid="footer-request-suspend-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-600 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "request-suspend"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <PauseCircle className="w-3.5 h-3.5" />}
                Req. Suspend
              </button>
            )}

            {/* Message — all */}
            <button
              onClick={() => onAction("message")}
              disabled={!!actionLoading}
              data-testid="footer-message-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-[#0000FF] hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {actionLoading === "message"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <MessageCircle className="w-3.5 h-3.5" />}
              Message
            </button>

            {/* Directions — all */}
            <button
              onClick={() => onAction("directions")}
              disabled={!!actionLoading}
              data-testid="footer-directions-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Navigation className="w-3.5 h-3.5" /> Directions
            </button>

            {/* Add to Calendar — all */}
            <button
              onClick={() => onAction("calendar")}
              disabled={!!actionLoading}
              data-testid="footer-calendar-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5" /> Add to Calendar
            </button>

            {/* Submit Complete — Crew */}
            {isCrew && !PAST_STATUSES.includes(selectedJob.status) && (
              <button
                onClick={onCrewComplete}
                disabled={crewCompleteLoading || selectedJob.my_assignment_status === "pending_complete" || selectedJob.my_assignment_status === "approved_complete"}
                data-testid="footer-crew-complete-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {selectedJob.my_assignment_status === "pending_complete" ? "Awaiting Approval" :
                 selectedJob.my_assignment_status === "approved_complete" ? "Approved" : "Submit Complete"}
              </button>
            )}

            {/* Per-crew Approve buttons — Contractor */}
            {isContractor && selectedJob.status === "pending_complete" && (
              <div className="flex flex-wrap gap-1.5">
                {(selectedJob.crew_assignments || [])
                  .filter(a => a.status === "pending_complete")
                  .map(a => {
                    const cp = (selectedJob.crew_profiles || []).find(c => c.id === a.crew_id);
                    return (
                      <button key={a.crew_id}
                        onClick={() => onApproveCrew(a.crew_id)}
                        data-testid={`approve-crew-btn-${a.crew_id}`}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve {cp?.name || a.crew_id.slice(0, 6)}
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Copy+Repost — Contractor on past jobs */}
            {isContractor && PAST_STATUSES.includes(selectedJob.status) && (
              <button
                onClick={() => onAction("copy")}
                disabled={!!actionLoading}
                data-testid="footer-copy-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#0000FF] border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === "copy"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Copy className="w-3.5 h-3.5" />}
                Copy+Repost
              </button>
            )}

            {/* Archive — Contractor on past jobs */}
            {isContractor && PAST_STATUSES.includes(selectedJob.status) && (
              <button
                onClick={() => onAction("archive")}
                disabled={!!actionLoading}
                data-testid="footer-archive-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {actionLoading === "archive"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Archive className="w-3.5 h-3.5" />}
                Archive
              </button>
            )}

            {/* Archive — Crew on past jobs */}
            {isCrew && PAST_STATUSES.includes(selectedJob.status) && (
              <button
                onClick={() => onAction("archive")}
                disabled={!!actionLoading}
                data-testid="footer-crew-archive-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {actionLoading === "archive"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Archive className="w-3.5 h-3.5" />}
                Archive
              </button>
            )}

            {/* Report Issue */}
            <button
              onClick={onOpenDispute}
              data-testid="footer-dispute-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" /> Report Issue
            </button>

            {/* Rate — post completion (crew rates contractor) */}
            {isCrew
              && ["completed_pending_review", "completed", "past"].includes(selectedJob.status)
              && selectedJob.contractor_id
              && !selectedJob.rated_by_crew?.includes(user?.id) && (
              <button
                onClick={onOpenRating}
                data-testid="footer-rate-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-600 border border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <Star className="w-3.5 h-3.5" /> Rate Contractor
              </button>
            )}

            {/* Deselect */}
            <button
              onClick={onDeselect}
              data-testid="footer-deselect-btn"
              className="ml-auto flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Deselect
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
