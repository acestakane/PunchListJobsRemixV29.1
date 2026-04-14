import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import Navbar from "../components/Navbar";
import { isFreeUser, UPGRADE_MSG } from "../utils/subscription";
import { getErr } from "../utils/errorUtils";
import JobCard from "../components/JobCard";
import JobMap from "../components/JobMap";
import JobFormModal from "../components/JobFormModal";
import { RatingModal } from "../components/contractor/RatingModal";
import { CrewProfileModal } from "../components/contractor/CrewProfileModal";
import { CrewCard } from "../components/contractor/CrewCard";
import { CrewRequestModal } from "../components/contractor/CrewRequestModal";
import { ConfirmArchiveModal } from "../components/contractor/ConfirmArchiveModal";
import { ProfileCompletionPopup } from "../components/ProfileCompletionPopup";
import { toast } from "sonner";
import axios from "axios";
import {
  Search, Plus, Zap, Users, ClipboardList, Star, MapPin, X, AlertTriangle,
  AlertCircle, Eye, Share2, UserCheck, Clock, PauseCircle, PlayCircle,
  Ban, Trash2, Archive, MessageCircle, Copy,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_LABELS = {
  open: "Posted", fulfilled: "Accepted", in_progress: "In Progress",
  completed_pending_review: "Completed", completed: "Verified",
  suspended: "Suspended", cancelled: "Cancelled", draft: "Draft",
};

export default function ContractorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addListener, connected, pushAlert } = useWebSocket();
  const [jobs, setJobs] = useState([]);
  const [crew, setCrew] = useState([]);
  const [crewSearch, setCrewSearch] = useState({ name: "", trade: "", address: "", min_travel_radius: "" });
  const [crewSmartMatch, setCrewSmartMatch] = useState(false);
  const [grouped, setGrouped] = useState([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [ratingJob, setRatingJob] = useState(null);
  const [ratingCrewNames, setRatingCrewNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState(null);
  const [viewingCrewId, setViewingCrewId] = useState(null);
  const [requestingCrew, setRequestingCrew] = useState(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [crewRequests, setCrewRequests] = useState([]);
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [showCompleteProfilePopup, setShowCompleteProfilePopup] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: "", description: "", trade: "", discipline: "", skill: "",
    crew_needed: 1, start_time: "", pay_rate: "", address: "",
    is_emergency: false, is_boosted: false, tasks: [],
  });
  const [copyEditMode, setCopyEditMode] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [jobSort, setJobSort] = useState("date");
  const [applicantsJob, setApplicantsJob] = useState(null);
  const [applicantDetails, setApplicantDetails] = useState({});
  const [cancelReqJob, setCancelReqJob] = useState(null);
  const [pubSettings, setPubSettings] = useState({});
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // ─── Data fetchers ──────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/jobs/`);
      setJobs(res.data);
    } catch (e) { console.error(e); }
  }, []);

  const fetchCrew = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (crewSearch.name) params.append("name", crewSearch.name);
      if (crewSearch.trade) {
        if (crewSearch.trade.startsWith("__cat__:")) {
          params.append("category", crewSearch.trade.replace("__cat__:", ""));
        } else {
          params.append("trade", crewSearch.trade);
        }
      }
      if (crewSearch.address) params.append("address", crewSearch.address);
      if (crewSearch.min_travel_radius) params.append("min_travel_radius", crewSearch.min_travel_radius);
      if (crewSmartMatch) params.append("smart_match", "true");
      const res = await axios.get(`${API}/users/crew?${params}`);
      setCrew(res.data);
    } catch (e) { console.error(e); }
  }, [crewSearch, crewSmartMatch]);

  const fetchSubStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/payments/subscription/status`);
      setSubStatus(res.data);
    } catch (e) { console.error("fetchSubStatus failed", e); }
  }, []);

  const fetchCrewRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users/requests`);
      setCrewRequests(res.data);
    } catch (e) { console.error("fetchCrewRequests failed", e); }
  }, []);

  const fetchProfileCompletion = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users/profile-completion`);
      setProfileCompletion(res.data);
      if (!res.data.is_complete) setShowCompleteProfilePopup(true);
    } catch (e) { console.error("fetchProfileCompletion failed", e); }
  }, []);

  const fetchApplicants = useCallback(async (jobId) => {
    try {
      const res = await axios.get(`${API}/jobs/${jobId}/applicants`);
      setApplicantDetails(prev => ({ ...prev, [jobId]: res.data }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchCrew(), fetchSubStatus(), fetchCrewRequests(), fetchProfileCompletion()]);
      setLoading(false);
    };
    init();
    axios.get(`${API}/trades`).then(r => setGrouped(r.data.categories || [])).catch(() => {});
    axios.get(`${API}/settings/public`).then(r => setPubSettings(r.data)).catch(() => {});
  }, [fetchJobs, fetchCrew, fetchSubStatus, fetchCrewRequests, fetchProfileCompletion]);

  useEffect(() => {
    if (!ratingJob?.crew_accepted?.length) { setRatingCrewNames({}); return; }
    Promise.all(
      ratingJob.crew_accepted.map(id =>
        axios.get(`${API}/users/public/${id}`)
          .then(r => [id, r.data?.name || `Worker ${id.slice(0, 6)}`])
          .catch(() => [id, `Worker ${id.slice(0, 6)}`])
      )
    ).then(pairs => setRatingCrewNames(Object.fromEntries(pairs)));
  }, [ratingJob]);

  useEffect(() => {
    const remove = addListener(msg => {
      if (msg.type === "crew_cancel_request") {
        toast.warning(`${msg.crew_name} wants to cancel from "${msg.job_title}"`);
        pushAlert(`${msg.crew_name} requested to cancel from "${msg.job_title}"`, "warning");
        fetchJobs();
      }
      if (msg.type === "new_applicant") {
        toast.info(`${msg.crew_name} applied for "${msg.job_title}"`);
        pushAlert(`${msg.crew_name} applied for "${msg.job_title}"`, "info");
        fetchJobs();
        if (msg.job_id) fetchApplicants(msg.job_id);
      }
      if (msg.type === "job_accepted") {
        toast.success(`Worker accepted your job! (${msg.crew_count}/${msg.crew_needed} filled)`);
        pushAlert(`Worker accepted job (${msg.crew_count}/${msg.crew_needed} filled)`, "success");
        fetchJobs();
      }
      if (msg.type === "job_completed") {
        toast.info(`Job "${msg.job_title}" marked complete. Please verify.`);
        pushAlert(`"${msg.job_title}" completed — verify now`, "warning");
        fetchJobs();
      }
      if (msg.type === "crew_request_accepted") {
        toast.success(`${msg.crew_name} accepted your crew request!`);
        pushAlert(`${msg.crew_name} accepted your crew request`, "success");
        fetchCrewRequests();
      }
      if (msg.type === "crew_request_declined") {
        toast.info(`${msg.crew_name} declined your crew request.`);
        pushAlert(`${msg.crew_name} declined your crew request`, "info");
        fetchCrewRequests();
      }
    });
    return remove;
  }, [addListener, fetchJobs, fetchCrewRequests, fetchApplicants, pushAlert]);

  // ─── Job actions ────────────────────────────────────────────────────────────

  const normalizeTrade = (trade) =>
    trade?.startsWith("__cat__:") ? trade.replace("__cat__:", "") : trade;

  const createJob = async (e, images) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/jobs/`, {
        ...jobForm,
        trade: jobForm.trade,
        discipline: jobForm.discipline,
        skill: jobForm.skill,
        crew_needed: Number(jobForm.crew_needed),
        pay_rate: Number(jobForm.pay_rate),
      });
      if (images?.length > 0) {
        try {
          const fd = new FormData();
          images.forEach(f => fd.append("files", f));
          await axios.post(`${API}/jobs/${res.data.id}/images`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        } catch { /* image upload failure is non-fatal */ }
      }
      const msg = jobForm.is_emergency ? "Emergency alert sent! Crew will be notified." : "Job posted! Workers will be notified instantly.";
      toast.success(msg);
      closeJobForm();
      fetchJobs();
    } catch (e) {
      const detail = getErr(e, "Failed to post job");
      if (detail.includes("SUBSCRIPTION_EXPIRED") || detail.includes("FREE_LIMIT_REACHED")) {
        toast.error("Free plan limit reached. Upgrade to post more jobs.");
      } else {
        toast.error(detail);
      }
    }
  };

  const duplicateJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/duplicate`);
      toast.success("Job duplicated and reposted!");
      fetchJobs();
    } catch (e) { toast.error(getErr(e, "Failed to duplicate")); }
  };

  // ─── Job status transition helper ──────────────────────────────────────────
  const jobAction = useCallback(async (method, path, successMsg, errMsg, onSuccess) => {
    try {
      method === "delete" ? await axios.delete(path) : await axios.post(path);
      toast.success(successMsg);
      fetchJobs();
      onSuccess?.();
    } catch (e) { toast.error(getErr(e, errMsg)); }
  }, [fetchJobs]);

  const startJob      = (id) => jobAction("post",   `${API}/jobs/${id}/start`,      "Job started!",                           "Failed");
  const verifyJob     = (id) => jobAction("post",   `${API}/jobs/${id}/verify`,     "Job verified and completed!",            "Failed");
  const cancelJob     = (id) => jobAction("post",   `${API}/jobs/${id}/cancel`,     "Job cancelled. Crew has been notified.", "Failed to cancel");
  const suspendJob    = (id) => jobAction("post",   `${API}/jobs/${id}/suspend`,    "Job suspended. Crew has been notified.", "Failed to suspend");
  const reactivateJob = (id) => jobAction("post",   `${API}/jobs/${id}/reactivate`, "Job reactivated. Crew has been notified.", "Failed to reactivate");
  const archiveCancelledJob = (id) => jobAction("post", `${API}/jobs/${id}/archive`, "Job archived.", "Failed to archive");
  const deleteJobConfirmed = () => confirmDeleteId && jobAction(
    "delete", `${API}/jobs/${confirmDeleteId}`,
    "Job archived — find it in Job Archive.", "Failed to archive",
    () => setConfirmDeleteId(null)
  );

  const submitRatings = async (job, ratings, reviews, skippedSet = new Set()) => {
    if (!job?.id) {
      toast.error("Invalid job data");
      return;
    }

    // Prevent double submission
    if (ratingSubmitting) {
      toast.warning("Rating submission in progress...");
      return;
    }

    // Validation: Ensure at least one action (rate or skip) for each crew member
    const crewAccepted = job.crew_accepted || [];
    if (crewAccepted.length === 0) {
      toast.error("No crew members to rate");
      return;
    }

    // Check if at least one crew member has been handled (rated or skipped)
    const hasRating = crewAccepted.some(crewId => (ratings[crewId] || 0) > 0);
    const hasSkip = skippedSet.size > 0;
    const allHandled = crewAccepted.every(crewId => 
      (ratings[crewId] || 0) > 0 || skippedSet.has(crewId)
    );

    if (!hasRating && !hasSkip) {
      toast.error("Please rate or skip at least one crew member");
      return;
    }

    setRatingSubmitting(true);

    try {
      let ratedCount = 0;
      let skippedCount = 0;
      const errors = [];

      // Rate crew members with a star selection that aren't marked as skipped
      for (const crewId of crewAccepted) {
        if (!crewId) continue;
        const stars = ratings[crewId] || 0;
        
        if (stars > 0 && !skippedSet.has(crewId)) {
          // Validate stars range before sending
          if (stars < 1 || stars > 5) {
            errors.push(`Invalid rating (${stars} stars) for crew member`);
            continue;
          }

          try {
            await axios.post(`${API}/jobs/${job.id}/rate`, {
              rated_id: crewId, 
              job_id: job.id, 
              stars, 
              review: reviews[crewId] || "",
            });
            ratedCount++;
          } catch (e) {
            // Already rated = idempotent — ignore; other errors capture
            const errorMsg = e?.response?.data?.detail || "";
            if (errorMsg.includes("Already rated") || errorMsg.includes("Already handled")) {
              ratedCount++; // Count as success (idempotent)
            } else if (errorMsg.includes("not pending review") || errorMsg.includes("not completed")) {
              errors.push("Job must be completed before rating");
              throw e; // Stop processing
            } else {
              errors.push(`Failed to rate crew member: ${errorMsg}`);
            }
          }
        }
      }

      // Skip all crew that were not rated (either explicitly skipped or left unstarred)
      for (const crewId of crewAccepted) {
        if (!crewId) continue;
        const stars = ratings[crewId] || 0;
        
        if (stars === 0 || skippedSet.has(crewId)) {
          try {
            await axios.post(`${API}/jobs/${job.id}/rate/skip`, { crew_id: crewId });
            skippedCount++;
          } catch (e) {
            const errorMsg = e?.response?.data?.detail || "";
            // Already skipped/rated — ignore
            if (errorMsg.includes("Already") || errorMsg.includes("cannot skip")) {
              skippedCount++; // Count as success (idempotent)
            } else {
              // Non-critical error, log but continue
              console.warn(`Skip failed for ${crewId}:`, errorMsg);
            }
          }
        }
      }

      // Final validation
      if (errors.length > 0) {
        toast.error(`Rating errors: ${errors.join(", ")}`);
        return;
      }

      if (ratedCount === 0 && skippedCount === 0) {
        toast.warning("No ratings were submitted. Please try again.");
        return;
      }

      // Success feedback
      const feedback = [];
      if (ratedCount > 0) feedback.push(`${ratedCount} rated`);
      if (skippedCount > 0) feedback.push(`${skippedCount} skipped`);
      
      toast.success(`Ratings submitted! (${feedback.join(", ")})`);
      setRatingJob(null);
      setRatingCrewNames({});
      fetchJobs();
    } catch (e) {
      const errorDetail = getErr(e, "Failed to submit ratings");
      
      // Provide specific error guidance
      if (errorDetail.includes("not completed") || errorDetail.includes("pending review")) {
        toast.error("Job must be verified complete before rating crew");
      } else if (errorDetail.includes("Not part of this job")) {
        toast.error("You are not authorized to rate this job");
      } else if (errorDetail.includes("network") || errorDetail.includes("timeout")) {
        toast.error("Network error. Please check your connection and retry.");
      } else {
        toast.error(errorDetail);
      }
    } finally {
      setRatingSubmitting(false);
    }
  };

  // (cancelJob, suspendJob, reactivateJob, deleteJobConfirmed, archiveCancelledJob consolidated above via jobAction)

  const copyJobToForm = (job) => {
    setJobForm({
      title: job.title, description: job.description || "",
      trade: job.trade || "", crew_needed: job.crew_needed,
      start_time: job.start_time || "", pay_rate: job.pay_rate,
      address: job.address || job.location?.full_address || job.location?.address || "",
      is_emergency: false, is_boosted: false, tasks: [],
    });
    setCopyEditMode(true);
    setShowJobForm(true);
  };

  const shareJob = (job) => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    if (navigator.share) {
      navigator.share({ title: job.title, text: `$${job.pay_rate}/hr · ${job.trade}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Job link copied!"));
    }
  };

  const closeJobForm = () => {
    setShowJobForm(false);
    setCopyEditMode(false);
    setJobForm({ title: "", description: "", trade: "", crew_needed: 1, start_time: "", pay_rate: "", address: "", is_emergency: false, is_boosted: false, tasks: [] });
  };

  const messageAdmin = async () => {
    try {
      const { data } = await axios.post(`${API}/messages/threads/admin`);
      navigate(`/messages?thread=${data.id}`);
    } catch (e) { toast.error(getErr(e, "Failed to open support chat")); }
  };

  const messageJobCrew = async (jobId) => {
    try {
      const { data } = await axios.post(`${API}/messages/threads/job/${jobId}`);
      navigate(`/messages?thread=${data.id}`);
    } catch (e) {
      const d = getErr(e, "Failed to open chat");
      if (d.includes("UPGRADE_REQUIRED")) toast.error("Upgrade your plan to message crew");
      else toast.error(d);
    }
  };

  const sendCrewRequest = async () => {
    if (!requestingCrew) return;
    if (isFreeUser(user)) { toast.error(UPGRADE_MSG); return; }
    try {
      await axios.post(`${API}/users/request/${requestingCrew.id}`, {
        crew_id: requestingCrew.id, message: requestMessage,
        job_context: { trade: requestingCrew.trade || "General Labor" },
      });
      toast.success(`Request sent to ${requestingCrew.name}!`);
      setRequestingCrew(null);
      setRequestMessage("");
      fetchCrewRequests();
    } catch (e) { toast.error(getErr(e, "Failed to send request")); }
  };

  const requestCrew = (member) => {
    if (isFreeUser(user)) { toast.error(UPGRADE_MSG); return; }
    setRequestingCrew(member);
    setRequestMessage("");
  };

  const acceptCancelRequest = async (jobId, crewId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/cancel-requests/${crewId}/accept`);
      toast.success("Cancel accepted — job re-listed.");
      fetchJobs(); setCancelReqJob(null);
    } catch (e) { toast.error(getErr(e, "Failed")); }
  };

  const denyCancelRequest = async (jobId, crewId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/cancel-requests/${crewId}/deny`);
      toast.info("Cancel request denied.");
      fetchJobs(); setCancelReqJob(null);
    } catch (e) { toast.error(getErr(e, "Failed")); }
  };

  const approveApplicant = async (jobId, crewId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/applicants/${crewId}/approve`);
      toast.success("Applicant approved!");
      fetchJobs(); fetchApplicants(jobId);
    } catch (e) { toast.error(getErr(e, "Failed to approve")); }
  };

  const declineApplicant = async (jobId, crewId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/applicants/${crewId}/decline`);
      toast.info("Applicant declined.");
      fetchApplicants(jobId);
    } catch (e) { toast.error(getErr(e, "Failed to decline")); }
  };

  const isExpired = subStatus?.status === "free" && subStatus?.usage_remaining === 0;
  const sortedJobs = [...jobs].sort((a, b) =>
    jobSort === "name" ? (a.title || "").localeCompare(b.title || "") : new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  const statusCount = (s) => jobs.filter(j => j.status === s).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Free limit banner */}
        {isExpired && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-3" data-testid="contractor-expired-banner">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Free plan limit reached</p>
              <p className="text-xs text-amber-600">Upgrade to post unlimited jobs this month</p>
            </div>
            <a href="/subscription" className="bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-700">Upgrade</a>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
              {user?.company_name || user?.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full" data-testid="user-role-badge">
                Contractor
              </span>
              <span className="text-slate-400 text-xs">·</span>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
                {connected ? "Live updates active" : "Connecting..."}
              </p>
            </div>
          </div>
          <button onClick={() => setShowJobForm(true)}
            className="flex items-center gap-2 bg-[#0000FF] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            data-testid="post-job-btn">
            <Plus className="w-4 h-4" /> Post Job
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT SIDEBAR - Crew Search */}
          <div className="lg:col-span-2 space-y-3">
            <div className="card p-4">
              <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>Search Crew</h3>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Name..." value={crewSearch.name}
                    onChange={e => setCrewSearch(s => ({ ...s, name: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid="crew-search-name" />
                </div>
                <select value={crewSearch.trade} onChange={e => setCrewSearch(s => ({ ...s, trade: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  data-testid="crew-search-trade">
                  <option value="">All Trades</option>
                  {grouped.map(cat => (
                    <optgroup key={cat.id} label={cat.name}>
                      {(cat.trades || []).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Location (city, zip)..." value={crewSearch.address}
                    onChange={e => setCrewSearch(s => ({ ...s, address: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid="crew-search-location" />
                </div>
                <select
                  value={crewSearch.min_travel_radius}
                  onChange={e => setCrewSearch(s => ({ ...s, min_travel_radius: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  data-testid="crew-search-travel-radius">
                  <option value="">Any Travel Range</option>
                  {[10, 25, 50, 100, 200].map(m => (
                    <option key={m} value={m}>Travels {m}+ miles</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={fetchCrew}
                    className="flex-1 bg-[#0000FF] text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    data-testid="crew-search-btn">Search</button>
                  <button onClick={() => setCrewSmartMatch(s => !s)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${crewSmartMatch ? "border-transparent text-[#050A30]" : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-[#0000FF]"}`}
                    style={crewSmartMatch ? { backgroundColor: "var(--theme-accent)" } : {}}
                    data-testid="crew-smart-match-btn">
                    <Zap className="w-4 h-4" /> Smart
                  </button>
                </div>
              </div>
            </div>

            {/* Crew Cards */}
            <div className="space-y-3">
              <h3 className="font-bold text-[#050A30] dark:text-white text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>
                Available Crew ({crew.length})
              </h3>
              {crew.length === 0 ? (
                <div className="card p-6 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No crew found</p>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-350px)] overflow-y-auto grid grid-cols-1 gap-2">
                  {crew.map(member => (
                    <div key={member.id} className="relative">
                      {crewSmartMatch && member.match_score !== undefined && (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow"
                          style={{
                            backgroundColor: member.match_score >= 0.7 ? "var(--theme-accent)" : member.match_score >= 0.45 ? "#fbbf24" : "#94a3b8",
                            color: "#050A30",
                          }}
                          data-testid={`crew-score-${member.id}`}>
                          <Zap className="w-3 h-3" />
                          {Math.round(member.match_score * 100)}%
                        </div>
                      )}
                      <CrewCard member={member} onRequest={requestCrew} onViewProfile={setViewingCrewId}
                        isViewerFree={isFreeUser(user)} showTransportType={!!pubSettings.enable_crew_transportation_type} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER - Map */}
          <div className="lg:col-span-5">
            <JobMap
              jobs={jobs.filter(j => ["open", "fulfilled", "in_progress"].includes(j.status))}
              crew={crew}
              profileAddress={user?.address}
              contractorId={user?.id}
              onRefresh={fetchJobs}
              onCrewProfile={setViewingCrewId}
              height="580px"
            />
          </div>

          {/* RIGHT SIDEBAR - Jobs */}
          <div className="lg:col-span-3 space-y-3">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[#050A30] dark:text-white text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>
                  My Jobs ({jobs.length})
                </h3>
                <button onClick={messageAdmin}
                  className="text-xs flex items-center gap-1 text-[#0000FF] dark:text-blue-400 hover:underline font-semibold"
                  data-testid="contractor-message-admin-btn">
                  <MessageCircle className="w-3 h-3" /> Admin
                </button>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Sort:</span>
                <button onClick={() => setJobSort("date")}
                  className={`text-xs font-bold px-2 py-0.5 rounded-md transition-colors ${jobSort === "date" ? "bg-[#0000FF] text-white" : "text-slate-500 dark:text-slate-400 hover:text-[#0000FF]"}`}
                  data-testid="sort-by-date">Date</button>
                <button onClick={() => setJobSort("name")}
                  className={`text-xs font-bold px-2 py-0.5 rounded-md transition-colors ${jobSort === "name" ? "bg-[#0000FF] text-white" : "text-slate-500 dark:text-slate-400 hover:text-[#0000FF]"}`}
                  data-testid="sort-by-name">Name</button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {[["open", "emerald", "Posted"], ["in_progress", "blue", "Active"], ["completed", "gray", "Done"]].map(([s, c, label]) => (
                  <div key={s} className={`text-center bg-${c}-50 dark:bg-${c}-950 rounded-lg p-2`}>
                    <div className={`font-extrabold text-${c}-600 text-lg`}>{statusCount(s)}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {jobs.length === 0 ? (
                <div className="card p-6 text-center">
                  <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-semibold text-sm">No jobs yet</p>
                  <button onClick={() => setShowJobForm(true)} className="mt-3 text-[#0000FF] text-sm font-semibold">Post your first job</button>
                </div>
              ) : sortedJobs.map(job => (
                <div key={job.id} className="space-y-1">
                  <JobCard job={job} onStart={startJob} onVerify={verifyJob} onRate={setRatingJob} currentUser={user} />
                  {/* Job action bar */}
                  <div className="flex items-center gap-1 px-1 pb-1">
                    {job.crew_pending?.length > 0 && (
                      <button onClick={() => { setApplicantsJob(applicantsJob === job.id ? null : job.id); if (applicantsJob !== job.id) fetchApplicants(job.id); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${applicantsJob === job.id ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                        data-testid={`applicants-btn-${job.id}`}>
                        <UserCheck className="w-3 h-3" />
                        {job.crew_pending.length} Pending
                      </button>
                    )}
                    {job.cancel_requests?.length > 0 && (
                      <button onClick={() => setCancelReqJob(cancelReqJob === job.id ? null : job.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${cancelReqJob === job.id ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                        data-testid={`cancel-req-btn-${job.id}`}>
                        <AlertCircle className="w-3 h-3" />
                        {job.cancel_requests.length} Cancel Req
                      </button>
                    )}
                    <button onClick={() => shareJob(job)} title="Share job link"
                      className="p-1.5 rounded text-slate-400 hover:text-[#0000FF] hover:bg-blue-50 transition-colors" data-testid={`share-job-${job.id}`}>
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPreviewData(job)} title="Preview"
                      className="p-1.5 rounded text-slate-400 hover:text-[#0000FF] hover:bg-blue-50 transition-colors" data-testid={`preview-job-${job.id}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => copyJobToForm(job)} title="Copy & edit"
                      className="p-1.5 rounded text-slate-400 hover:text-[#0000FF] hover:bg-blue-50 transition-colors" data-testid={`copy-job-${job.id}`}>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {["open", "fulfilled"].includes(job.status) && (
                      <button onClick={() => suspendJob(job.id)} title="Suspend"
                        className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" data-testid={`suspend-job-${job.id}`}>
                        <PauseCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {job.status === "suspended" && (
                      <button onClick={() => reactivateJob(job.id)} title="Reactivate"
                        className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" data-testid={`reactivate-job-${job.id}`}>
                        <PlayCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {job.crew_accepted?.length > 0 && (
                      <button onClick={() => messageJobCrew(job.id)} title="Message crew"
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" data-testid={`message-crew-${job.id}`}>
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {["open", "fulfilled", "suspended"].includes(job.status) && (
                      <button onClick={() => cancelJob(job.id)} title="Cancel job"
                        className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-testid={`cancel-job-${job.id}`}>
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {job.status === "cancelled" && (
                      <button onClick={() => archiveCancelledJob(job.id)} title="Archive"
                        className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" data-testid={`archive-cancelled-${job.id}`}>
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {job.status !== "in_progress" && job.status !== "cancelled" && (
                      <button onClick={() => setConfirmDeleteId(job.id)} title="Archive job"
                        className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" data-testid={`delete-job-${job.id}`}>
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Applicants panel */}
                  {applicantsJob === job.id && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 space-y-2 border border-amber-200 dark:border-amber-700" data-testid={`applicants-panel-${job.id}`}>
                      {!applicantDetails[job.id]?.length ? (
                        <p className="text-xs text-slate-400 text-center py-1">Loading applicants…</p>
                      ) : applicantDetails[job.id].map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-500">{c.trade || "General"} · ⭐ {c.rating?.toFixed(1) || "New"}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => approveApplicant(job.id, c.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                              data-testid={`approve-${job.id}-${c.id}`}>Approve</button>
                            <button onClick={() => declineApplicant(job.id, c.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              data-testid={`decline-${job.id}-${c.id}`}>Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cancel requests panel */}
                  {cancelReqJob === job.id && job.cancel_requests?.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 space-y-2 border border-red-200 dark:border-red-700" data-testid={`cancel-req-panel-${job.id}`}>
                      {job.cancel_requests.map(req => (
                        <div key={req.crew_id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{req.crew_name}</p>
                            <p className="text-[10px] text-slate-500">Wants to cancel</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => acceptCancelRequest(job.id, req.crew_id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                              data-testid={`accept-cancel-${job.id}-${req.crew_id}`}>Accept</button>
                            <button onClick={() => denyCancelRequest(job.id, req.crew_id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              data-testid={`deny-cancel-${job.id}-${req.crew_id}`}>Deny</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <JobFormModal
        show={showJobForm}
        onClose={closeJobForm}
        onSubmit={createJob}
        copyEditMode={copyEditMode}
        jobForm={jobForm}
        onChange={(k, v) => setJobForm(f => ({ ...f, [k]: v }))}
        grouped={grouped}
        user={user}
        onPreview={setPreviewData}
      />

      {requestingCrew && (
        <CrewRequestModal
          crew={requestingCrew}
          message={requestMessage}
          onMessageChange={setRequestMessage}
          onSend={sendCrewRequest}
          onClose={() => setRequestingCrew(null)}
        />
      )}

      {ratingJob && (
        <RatingModal job={ratingJob} onClose={() => { setRatingJob(null); setRatingCrewNames({}); }} onSubmit={submitRatings} crewNames={ratingCrewNames} isSubmitting={ratingSubmitting} />
      )}

      {viewingCrewId && (
        <CrewProfileModal userId={viewingCrewId} onClose={() => setViewingCrewId(null)} />
      )}

      {/* Job Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/60 z-[11] flex items-center justify-center p-4" onClick={() => setPreviewData(null)}>
          <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="card p-3 mb-3 bg-blue-50 dark:bg-blue-950 flex items-center justify-center gap-2">
              <Eye className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Crew Preview</p>
            </div>
            <JobCard
              job={{ ...previewData, id: previewData.id || "preview", status: previewData.status || "open", crew_accepted: [] }}
              currentUser={{ role: "crew" }}
            />
            <button onClick={() => setPreviewData(null)}
              className="mt-3 w-full py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
              data-testid="close-preview-btn">
              Close Preview
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmArchiveModal
          onConfirm={deleteJobConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {showCompleteProfilePopup && (
        <ProfileCompletionPopup
          profileCompletion={profileCompletion}
          onClose={() => setShowCompleteProfilePopup(false)}
        />
      )}
    </div>
  );
}
