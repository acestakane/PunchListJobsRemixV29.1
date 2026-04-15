import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import axios from "axios";
import { toast } from "sonner";
import { getErr } from "../utils/errorUtils";
import { CalendarDays, Search, ChevronRight, Loader2 } from "lucide-react";
import { ItineraryCard, EmptyPane, fmtDate, fmtTime, downloadCalendar, openDirections } from "../components/itinerary/ItineraryCard";
import { ItineraryRatingModal } from "../components/itinerary/ItineraryRatingModal";
import { DisputeModal } from "../components/itinerary/DisputeModal";
import { ItineraryActionBar } from "../components/itinerary/ItineraryActionBar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function JobsItinerary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [activePane, setActivePane] = useState(null); // "upcoming" | "past"
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState("");
  const [disputeJobId, setDisputeJobId] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [ratingData, setRatingData] = useState(null); // {jobId, ratedId, ratedName}

  const role = user?.role;
  const isContractor = ["contractor", "admin", "superadmin"].includes(role);
  const isCrew = role === "crew";

  const fetchItinerary = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/jobs/itinerary`);
      setJobs(data);
    } catch {
      toast.error("Failed to load itinerary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItinerary(); }, [fetchItinerary]);

  const now = new Date();

  const filtered = search
    ? jobs.filter(j =>
        [j.title, j.contractor_name, j.trade, j.address, j.location?.city]
          .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : jobs;

  const PAST_STATUSES = ["completed", "past", "cancelled", "suspended"];

  const upcoming = filtered
    .filter(j => {
      if (PAST_STATUSES.includes(j.status)) return false;
      // For crew: a job moves to past when their own assignment is approved_complete
      if (isCrew && j.my_assignment_status === "approved_complete") return false;
      return true;
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const past = filtered
    .filter(j => {
      if (isCrew) {
        // Spec §Past Jobs: show if assignment ≠ removed AND (approved_complete OR terminal job)
        if (j.my_assignment_status === "removed") return false;
        return j.my_assignment_status === "approved_complete" || PAST_STATUSES.includes(j.status);
      }
      return PAST_STATUSES.includes(j.status);
    })
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

  function selectCard(jobId, pane) {
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
      setActivePane(null);
    } else {
      setSelectedJobId(jobId);
      setActivePane(pane);
    }
  }

  async function handleAction(action) {
    if (!selectedJob) return;
    setActionLoading(action);
    try {
      switch (action) {
        case "cancel":
          await axios.post(`${API}/jobs/${selectedJob.id}/cancel`);
          toast.success("Job cancelled");
          setSelectedJobId(null);
          setActivePane(null);
          fetchItinerary();
          break;
        case "cancel-notify":
          await axios.post(`${API}/jobs/${selectedJob.id}/cancel-notify`);
          toast.success("Contractor notified of your cancellation intent");
          break;
        case "suspend":
          await axios.post(`${API}/jobs/${selectedJob.id}/suspend`);
          toast.success("Job suspended");
          fetchItinerary();
          break;
        case "request-suspend":
          await axios.post(`${API}/jobs/${selectedJob.id}/request-suspend`);
          toast.success("Suspension request sent to contractor");
          break;
        case "message": {
          const { data: thread } = await axios.post(`${API}/messages/threads/job/${selectedJob.id}`);
          navigate(`/messages?thread=${thread.id}`);
          break;
        }
        case "directions":
          openDirections(selectedJob);
          break;
        case "calendar":
          downloadCalendar(selectedJob);
          toast.success("Calendar event downloaded");
          break;
        case "archive":
          await axios.post(`${API}/jobs/${selectedJob.id}/archive`);
          toast.success("Job archived");
          setSelectedJobId(null);
          setActivePane(null);
          fetchItinerary();
          break;
        case "copy":
          await axios.post(`${API}/jobs/${selectedJob.id}/duplicate`);
          toast.success("Job duplicated — find it in your dashboard to edit and repost");
          break;
        case "skip-contractor-rating":
          await axios.post(`${API}/jobs/${selectedJob.id}/rate/skip`, {
            contractor_id: selectedJob.contractor_id,
          });
          toast.success("Rating skipped");
          setRatingData(null);
          break;
        default:
          break;
      }
    } catch (e) {
      const detail = getErr(e, "Action failed");
      if (detail.includes("UPGRADE_REQUIRED")) {
        toast.error("Upgrade your plan to use messaging");
      } else {
        toast.error(detail);
      }
    } finally {
      setActionLoading(null);
    }
  }

  const handleTaskCheck = async (jobId, taskIdx, checked) => {
    try {
      await axios.put(`${API}/jobs/${jobId}/task-check`, { task_idx: taskIdx, checked });
      setJobs(prev => prev.map(j => {
        if (j.id !== jobId) return j;
        const actorKey = isContractor ? "contractor" : user?.id;
        const existing = j.task_completions || {};
        return { ...j, task_completions: { ...existing, [actorKey]: { ...(existing[actorKey] || {}), [taskIdx]: checked } } };
      }));
    } catch { toast.error("Failed to update task"); }
  };

  const [crewCompleteLoading, setCrewCompleteLoading] = useState(false);

  const handleCrewComplete = async () => {
    if (!selectedJob || crewCompleteLoading) return;
    const myStatus = selectedJob.my_assignment_status;
    if (myStatus === "pending_complete" || myStatus === "approved_complete") {
      toast("Completion already submitted");
      return;
    }
    setCrewCompleteLoading(true);
    try {
      await axios.post(`${API}/jobs/${selectedJob.id}/crew-complete`);
      toast.success("Completion submitted! Awaiting contractor approval.");
      fetchItinerary();
      // Rating prompt deferred — only shown when job reaches completed/cancelled/suspended
    } catch (e) { toast.error(getErr(e, "Failed to submit")); }
    finally { setCrewCompleteLoading(false); }
  };

  const handleApproveCrew = async (crewId) => {
    if (!selectedJob) return;
    try {
      const { data } = await axios.post(`${API}/jobs/${selectedJob.id}/crew/${crewId}/approve-complete`);
      toast.success(data.job_completed ? "All crew approved — Job completed!" : "Crew completion approved");
      fetchItinerary();
      // Prompt rating when job completes via all-crew approval
      if (data.job_completed && isCrew) {
        const alreadyHandled = selectedJob.rated_by_crew?.includes(user?.id);
        if (!alreadyHandled && selectedJob.contractor_id) {
          setRatingData({ jobId: selectedJob.id, ratedId: selectedJob.contractor_id, ratedName: selectedJob.contractor_name || "Contractor" });
        }
      }
    } catch (e) { toast.error(getErr(e, "Failed to approve")); }
  };

  const submitDispute = async () => {
    if (!disputeJobId || !disputeReason.trim()) { toast.error("Please enter a dispute reason"); return; }
    try {
      await axios.post(`${API}/jobs/${disputeJobId}/dispute`, { reason: disputeReason });
      toast.success("Dispute submitted for admin review");
      setDisputeJobId(null); setDisputeReason("");
    } catch (e) { toast.error(getErr(e, "Failed to submit dispute")); }
  };

  const submitRating = async (stars, review) => {
    if (!ratingData) return;
    try {
      await axios.post(`${API}/jobs/${ratingData.jobId}/rate`, {
        rated_id: ratingData.ratedId,
        job_id: ratingData.jobId,
        stars,
        review: review || "",
      });
      toast.success("Rating submitted!");
      setRatingData(null);
      fetchItinerary(); // persist state — hides button on re-render
    } catch (e) { toast.error(getErr(e, "Failed to submit rating")); }
  };

  const skipRating = async () => {
    if (!ratingData) return;
    try {
      await axios.post(`${API}/jobs/${ratingData.jobId}/rate/skip`, {
        contractor_id: ratingData.ratedId,
      });
      toast.success("Rating skipped");
      setRatingData(null);
      fetchItinerary(); // persist state — hides button on re-render
    } catch (e) { toast.error(getErr(e, "Failed to skip rating")); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "var(--theme-nav-bg)" }}>
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white"
                style={{ fontFamily: "Manrope, sans-serif" }}>
                Jobs Itinerary
              </h1>
              <p className="text-sm text-slate-500">
                {jobs.length} scheduled job{jobs.length !== 1 ? "s" : ""} · {upcoming.length} upcoming · {past.length} past
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs…"
              data-testid="itinerary-search"
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0000FF]/30 w-52"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#0000FF]" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-600 dark:text-slate-300 font-semibold text-lg">No Jobs Available!</p>
            <p className="text-xs text-slate-400 mt-1">Jobs with confirmed crew agreements will appear here</p>
          </div>
        ) : (
          <>
            {/* Split Pane */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

              {/* Upcoming Pane */}
              <div
                data-testid="upcoming-pane"
                className={`rounded-2xl border overflow-hidden transition-opacity duration-200
                  ${activePane === "past" ? "opacity-50" : ""}
                  border-slate-200 dark:border-slate-700`}
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                  <h2 className="font-extrabold text-[#050A30] dark:text-white text-sm flex items-center gap-2"
                    style={{ fontFamily: "Manrope, sans-serif" }}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Upcoming Jobs
                  </h2>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {upcoming.length}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto bg-slate-50 dark:bg-slate-900/50"
                  style={{ maxHeight: "calc(100vh - 380px)", minHeight: "200px" }}>
                  {upcoming.length === 0
                    ? <EmptyPane label="No upcoming scheduled jobs" />
                    : upcoming.map(job => (
                        <ItineraryCard
                          key={job.id}
                          job={job}
                          role={role}
                          userId={user?.id}
                          isSelected={selectedJobId === job.id}
                          dimmed={activePane === "past" && selectedJobId !== null}
                          onSelect={(id) => selectCard(id, "upcoming")}
                          onTaskCheck={handleTaskCheck}
                        />
                      ))
                  }
                </div>
              </div>

              {/* Past Pane */}
              <div
                data-testid="past-pane"
                className={`rounded-2xl border overflow-hidden transition-opacity duration-200
                  ${activePane === "upcoming" ? "opacity-50" : ""}
                  border-slate-200 dark:border-slate-700`}
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                  <h2 className="font-extrabold text-[#050A30] dark:text-white text-sm flex items-center gap-2"
                    style={{ fontFamily: "Manrope, sans-serif" }}>
                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                    Past Jobs
                  </h2>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {past.length}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto bg-slate-50 dark:bg-slate-900/50"
                  style={{ maxHeight: "calc(100vh - 380px)", minHeight: "200px" }}>
                  {past.length === 0
                    ? <EmptyPane label="No past scheduled jobs" />
                    : past.map(job => (
                        <ItineraryCard
                          key={job.id}
                          job={job}
                          role={role}
                          userId={user?.id}
                          isSelected={selectedJobId === job.id}
                          dimmed={activePane === "upcoming" && selectedJobId !== null}
                          onSelect={(id) => selectCard(id, "past")}
                          onTaskCheck={handleTaskCheck}
                        />
                      ))
                  }
                </div>
              </div>
            </div>

            {/* Spacer when footer bar is visible */}
            {selectedJob && <div className="h-28" />}
          </>
        )}
      </div>

      {/* Floating Action Bar */}
      <ItineraryActionBar
        selectedJob={selectedJob}
        isContractor={isContractor}
        isCrew={isCrew}
        actionLoading={actionLoading}
        crewCompleteLoading={crewCompleteLoading}
        user={user}
        onAction={handleAction}
        onCrewComplete={handleCrewComplete}
        onApproveCrew={(crewId) => handleApproveCrew(crewId)}
        onOpenDispute={() => setDisputeJobId(selectedJob?.id)}
        onOpenRating={() => selectedJob && setRatingData({
          jobId: selectedJob.id,
          ratedId: selectedJob.contractor_id,
          ratedName: selectedJob.contractor_name || "Contractor",
        })}
        onDeselect={() => { setSelectedJobId(null); setActivePane(null); }}
      />

      {/* Dispute Modal */}
      {disputeJobId && (
        <DisputeModal
          reason={disputeReason}
          onReasonChange={setDisputeReason}
          onSubmit={submitDispute}
          onClose={() => setDisputeJobId(null)}
        />
      )}

      {/* Rating Modal */}
      {ratingData && (
        <ItineraryRatingModal
          data={ratingData}
          onSubmit={submitRating}
          onSkip={skipRating}
          onClose={() => setRatingData(null)}
        />
      )}
    </div>
  );
}
