import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock, DollarSign, Users, AlertTriangle, Bookmark, CheckCircle, Eye, MessageCircle, Share2, Navigation } from "lucide-react";

const STATUS_COLORS = {
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  fulfilled: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  in_progress: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  completed_pending_review: "bg-orange-100 text-orange-700",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  suspended: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  draft: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

// Left-border accent per status
const CARD_ACCENTS = {
  fulfilled:   "border-l-4 border-yellow-400",
  in_progress: "border-l-4 border-emerald-500",
};

const STATUS_LABELS = {
  open: "Posted",
  fulfilled: "Accepted",
  in_progress: "In Progress",
  completed_pending_review: "Completed",
  completed: "Verified",
  suspended: "Suspended",
  cancelled: "Cancelled",
  draft: "Draft",
};

const TRADE_COLORS = {
  carpentry: "bg-amber-100 text-amber-800",
  electrical: "bg-yellow-100 text-yellow-800",
  plumbing: "bg-blue-100 text-blue-800",
  painting: "bg-purple-100 text-purple-800",
  landscaping: "bg-green-100 text-green-800",
  general: "bg-gray-100 text-gray-800",
};

function formatTime(timeStr) {
  if (!timeStr) return "TBD";
  try {
    return new Date(timeStr).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
  } catch { return timeStr; }
}

export default function JobCard({ job, onAccept, onStart, onComplete, onVerify, onRate, onPreview, onShare, currentUser, isAccepted, onRemoveRating, isPending, userLocation }) {
  const navigate = useNavigate();
  const isCrew = currentUser?.role === "crew";
  const isContractor = currentUser?.role === "contractor";
  const isAdmin = ["admin", "superadmin"].includes(currentUser?.role);
  const crewCount = job.crew_accepted?.length || 0;
  const isFull = crewCount >= job.crew_needed;
  // Strip internal __cat__: prefix so categories render cleanly
  const tradeDisplay = (job.trade?.startsWith("__cat__:") ? job.trade.replace("__cat__:", "") : job.trade) + (job.skill ? ` (${job.skill})` : "");

  return (
    <div
      className={`card overflow-hidden p-3 sm:p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
        job.is_emergency
          ? "border-l-4 border-red-500"
          : CARD_ACCENTS[job.status] || ""
      }`}
      data-testid={`job-card-${job.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {job.is_emergency && (
              <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                <AlertTriangle className="w-3 h-3" /> EMERGENCY
              </span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[job.status] || job.status?.replace(/_/g, " ")}
            </span>
          </div>
          <h3 className="font-bold text-[#050A30] dark:text-white text-sm sm:text-base leading-tight truncate" style={{ fontFamily: "Manrope, sans-serif" }}>
            {job.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{job.contractor_name}</p>
        </div>
        <div className="text-right flex-shrink-0 ml-1">
          <div className="text-lg sm:text-xl font-extrabold text-[#0000FF]">${job.pay_rate}</div>
          <div className="text-xs text-slate-500">/hr</div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mb-3 text-sm">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-[#0000FF] flex-shrink-0" />
          <span className="truncate text-xs sm:text-sm">{job.location?.city || job.location?.address?.split(",")[0] || "N/A"}</span>
          {job.distance_miles != null && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0">
              <Navigation className="w-2.5 h-2.5" />
              {job.distance_miles} mi
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 min-w-0">
          <Clock className="w-3.5 h-3.5 text-[#0000FF] flex-shrink-0" />
          <span className="truncate text-xs sm:text-sm">{formatTime(job.start_time)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <Users className="w-3.5 h-3.5 text-[#0000FF] flex-shrink-0" />
          <span className="text-xs sm:text-sm whitespace-nowrap">{crewCount}/{job.crew_needed} crew</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize truncate ${TRADE_COLORS[tradeDisplay?.toLowerCase()] || "bg-gray-100 text-gray-700"}`}>
            {tradeDisplay}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-3">
        <div
          className="bg-[#0000FF] h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min((crewCount / job.crew_needed) * 100, 100)}%` }}
        />
      </div>

      {/* Description */}
      {job.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{job.description}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {/* Crew: share approved job */}
        {isCrew && isAccepted && !isPending && onShare && (
          <button
            onClick={() => onShare(job)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-1"
            data-testid={`share-job-${job.id}`}
          >
            <Share2 className="w-3 h-3" /> Share
          </button>
        )}
        {/* Message link — always visible for accepted crew and contractor */}
        {(isCrew && isAccepted) || isContractor ? (
          <button
            onClick={() => navigate("/messages")}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-1"
            data-testid={`message-job-${job.id}`}
          >
            <MessageCircle className="w-3 h-3" /> Message
          </button>
        ) : null}
        {isCrew && onPreview && (
          <button
            onClick={() => onPreview(job)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-1"
            data-testid={`preview-job-${job.id}`}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
        )}
        {isCrew && job.status === "open" && !isAccepted && (
          <button
            onClick={() => onAccept?.(job.id)}
            className="flex-1 bg-[#0000FF] text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            data-testid={`accept-job-${job.id}`}
          >
            Accept Job
          </button>
        )}
        {isCrew && isAccepted && job.status === "in_progress" && (
          <button
            onClick={() => onComplete?.(job.id)}
            className="flex-1 bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-emerald-700 transition-colors"
            data-testid={`complete-job-${job.id}`}
          >
            Mark Complete
          </button>
        )}
        {isCrew && isAccepted && !isPending && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold px-2">
            <CheckCircle className="w-4 h-4" /> Accepted
          </span>
        )}
        {isCrew && isPending && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold px-2" data-testid={`pending-status-${job.id}`}>
            <Clock className="w-4 h-4" /> Pending Approval
          </span>
        )}
        {isContractor && ["open", "fulfilled"].includes(job.status) && crewCount >= 1 && (
          <button
            onClick={() => onStart?.(job.id)}
            className="flex-1 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            data-testid={`start-job-${job.id}`}
          >
            Start Job
          </button>
        )}
        {isContractor && job.status === "completed_pending_review" && (
          <button
            onClick={() => onVerify?.(job.id)}
            className="flex-1 bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-emerald-700 transition-colors"
            data-testid={`verify-job-${job.id}`}
          >
            Verify Complete
          </button>
        )}
        {isContractor && ["completed", "completed_pending_review", "past"].includes(job.status) && !job.rating_completed && (
          (() => {
            const handled = new Set([...(job.rated_crew || []), ...(job.skipped_ratings || [])]);
            const allHandled = (job.crew_accepted || []).length > 0 && (job.crew_accepted || []).every(id => handled.has(id));
            return !allHandled ? (
              <button
                onClick={() => onRate?.(job)}
                className="flex-1 bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-yellow-600 transition-colors"
                data-testid={`rate-job-${job.id}`}
              >
                Rate Workers
              </button>
            ) : null;
          })()
        )}
        {/* Crew: rate the contractor after verified completion */}
        {isCrew && isAccepted && ["completed", "completed_pending_review", "past"].includes(job.status)
          && !(job.rated_by_crew || []).includes(currentUser?.id) && !job.rating_completed && (
          <button
            onClick={() => onRate?.(job)}
            className="flex-1 bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-yellow-600 transition-colors"
            data-testid={`crew-rate-job-${job.id}`}
          >
            Rate Contractor
          </button>
        )}
        {/* Admin: remove ratings from a completed job */}
        {isAdmin && job.status === "completed" && onRemoveRating && (
          <button
            onClick={() => onRemoveRating(job)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 transition-colors"
            data-testid={`remove-rating-${job.id}`}
          >
            Remove Rating
          </button>
        )}
      </div>
    </div>
  );
}
