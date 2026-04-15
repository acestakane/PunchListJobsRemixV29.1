import React, { useState, useEffect, useCallback } from "react";
import { getErr } from "../utils/errorUtils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import Navbar from "../components/Navbar";
import JobMap from "../components/JobMap";
import JobCard from "../components/JobCard";
import { JobDetailModal } from "../components/crew/JobDetailModal";
import { CrewSidebar } from "../components/crew/CrewSidebar";
import { CrewDashboardHeader } from "../components/crew/CrewDashboardHeader";
import { SubscriptionBanners } from "../components/crew/SubscriptionBanners";
import { JobFiltersRow } from "../components/crew/JobFiltersRow";
import { ProfileCompletionPopup } from "../components/ProfileCompletionPopup";
import { toast } from "sonner";
import axios from "axios";
import { MapPin, Zap } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const REVEAL_CONTACT_PRICE = 2.99;

export default function CrewDashboard() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { addListener, sendLocation, connected, pushAlert } = useWebSocket();
  const [view, setView] = useState("map");
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(user?.is_online ?? user?.availability ?? false);
  const [loading, setLoading] = useState(true);
  const [tradeFilter, setTradeFilter] = useState("");
  const [grouped, setGrouped] = useState([]);
  const [radius, setRadius] = useState(25);
  const [smartMatch, setSmartMatch] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [contractorInfo, setContractorInfo] = useState(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [crewRequests, setCrewRequests] = useState([]);
  const [profileBoost, setProfileBoost] = useState(null);
  const [boostLoading, setBoostLoading] = useState(false);
  const [showCompleteProfilePopup, setShowCompleteProfilePopup] = useState(false);
  const watchIdRef = React.useRef(null);

  // ─── Data fetchers ──────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tradeFilter) {
        if (tradeFilter.startsWith("__cat__:")) {
          params.append("category", tradeFilter.replace("__cat__:", ""));
        } else {
          params.append("trade", tradeFilter.toLowerCase());
        }
      }
      if (userLocation && locationEnabled) {
        params.append("lat", userLocation.lat);
        params.append("lng", userLocation.lng);
        params.append("radius", radius);
      }
      if (smartMatch) params.append("smart_match", "true");
      const res = await axios.get(`${API}/jobs/?${params}`);
      setJobs(res.data);
    } catch (e) { console.error("Failed to fetch jobs", e); }
  }, [tradeFilter, userLocation, radius, smartMatch, locationEnabled]);

  const fetchMyJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/jobs/my-jobs`);
      setMyJobs(res.data);
    } catch (e) { console.error("fetchMyJobs failed", e); }
  }, []);

  const fetchSubStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/payments/subscription/status`);
      setSubStatus(res.data);
    } catch (e) { console.error("fetchSubStatus failed", e); }
  }, []);

  const fetchProfileCompletion = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users/profile-completion`);
      setProfileCompletion(res.data);
      if (!res.data.is_complete) setShowCompleteProfilePopup(true);
    } catch (e) { console.error("fetchProfileCompletion failed", e); }
  }, []);

  const fetchCrewRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users/requests`);
      setCrewRequests(res.data);
    } catch (e) { console.error("fetchCrewRequests failed", e); }
  }, []);

  const fetchProfileBoost = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/boost/profile/status`);
      setProfileBoost(res.data);
    } catch (e) { console.error("fetchProfileBoost failed", e); }
  }, []);

  const activateProfileBoost = async () => {
    setBoostLoading(true);
    try {
      const res = await axios.post(`${API}/boost/profile`);
      toast.success(`Profile boosted for 7 days! ($${res.data.amount_charged} demo charge)`);
      fetchProfileBoost();
    } catch (e) { toast.error(getErr(e, "Boost failed")); }
    finally { setBoostLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchMyJobs(), fetchSubStatus(), fetchProfileCompletion(), fetchCrewRequests(), fetchProfileBoost()]);
      setLoading(false);
    };
    init();
    axios.get(`${API}/trades`).then(r => setGrouped(r.data.categories || [])).catch(() => {});
  }, [fetchJobs, fetchMyJobs, fetchSubStatus, fetchProfileCompletion, fetchCrewRequests, fetchProfileBoost]);

  // WebSocket: new job notifications + crew requests + job workflow
  useEffect(() => {
    const remove = addListener((msg) => {
      if (msg.type === "job_completed_final") {
        const text = `"${msg.job_title}" is now complete! Head to Itinerary to rate the contractor.`;
        toast.success(text, {
          action: { label: "Rate Now", onClick: () => navigate("/itinerary") },
          duration: 8000,
        });
        fetchMyJobs();
      }
      if (msg.type === "new_job") {
        setJobs(prev => [msg.job, ...prev.filter(j => j.id !== msg.job.id)]);
        const prefix = msg.job.is_emergency ? "EMERGENCY: " : "New job: ";
        const text = `${prefix}${msg.job.title} - $${msg.job.pay_rate}/hr`;
        toast.info(text, { action: { label: "View", onClick: () => setSelectedJob(msg.job) } });
        pushAlert(text, msg.job.is_emergency ? "warning" : "info");
      }
      if (msg.type === "crew_request") {
        const text = `${msg.contractor_name} wants to hire you!`;
        toast.info(text, { action: { label: "View", onClick: () => fetchCrewRequests() } });
        pushAlert(text, "info");
        fetchCrewRequests();
      }
      if (msg.type === "cancel_accepted") {
        const text = `Your cancel request for "${msg.job_title}" was approved.`;
        toast.success(text); pushAlert(text, "success");
        fetchMyJobs(); fetchJobs();
      }
      if (msg.type === "cancel_denied") {
        const text = `Your cancel request for "${msg.job_title}" was denied.`;
        toast.info(text); pushAlert(text, "info");
      }
      if (msg.type === "application_approved") {
        const text = `Your application for "${msg.job_title}" was approved!`;
        toast.success(text); pushAlert(text, "success");
        fetchMyJobs(); fetchJobs();
      }
      if (msg.type === "application_declined") {
        const text = `Your application for "${msg.job_title}" was not selected.`;
        toast.info(text); pushAlert(text, "info");
        fetchMyJobs();
      }
      if (msg.type === "job_started") {
        const text = `"${msg.job_title}" has started! Proceed to site.`;
        toast.success(text); pushAlert(text, "success");
        fetchMyJobs();
      }
    });
    return remove;
  }, [addListener, fetchCrewRequests, fetchMyJobs, fetchJobs, pushAlert]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const toggleLocation = () => {
    if (!locationEnabled) {
      if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser.");
        return;
      }
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          sendLocation(loc.lat, loc.lng);
          axios.post(`${API}/users/location`, { lat: loc.lat, lng: loc.lng }).catch(() => {});
        },
        (err) => {
          if (err.code === 1) toast.error("Location access denied. Please allow in browser settings.");
          else toast.error("Could not get your location. Please try again.");
          setLocationEnabled(false);
          watchIdRef.current = null;
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
      watchIdRef.current = id;
      setLocationEnabled(true);
      sessionStorage.setItem("gps_enabled", "1");
      toast.success("GPS enabled — showing nearest jobs first.");
    } else {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      setLocationEnabled(false); setUserLocation(null);
      sessionStorage.removeItem("gps_enabled");
      toast.info("GPS tracking disabled.");
    }
  };

  // Auto-enable GPS if browser already granted permission (no re-prompt needed)
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") toggleLocation();
      });
    } else if (sessionStorage.getItem("gps_enabled") === "1") {
      toggleLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }; }, []);

  const toggleOnlineStatus = async () => {
    const newStatus = !isOnline;
    try {
      await axios.put(`${API}/users/online-status`, { is_online: newStatus });
      setIsOnline(newStatus);
      toast.success(newStatus ? "You are now Online — visible to contractors" : "You are now Offline");
    } catch { toast.error("Failed to update status"); }
  };

  const acceptJob = async (jobId) => {
    if (subStatus?.status === "expired") { toast.error("Subscription expired. Please renew to accept jobs."); return; }
    try {
      await axios.post(`${API}/jobs/${jobId}/accept`);
      toast.success(selectedJob?.is_emergency ? "Emergency job accepted!" : "Application submitted! Awaiting contractor approval.");
      fetchJobs(); fetchMyJobs();
    } catch (e) {
      const detail = getErr(e, "Failed to accept job");
      if (detail.includes("SUBSCRIPTION_EXPIRED")) toast.error("Your subscription has expired. Please renew.");
      else if (detail.includes("already claimed")) toast.warning("Someone else got this emergency job first!");
      else toast.error(detail);
    }
  };

  const completeJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/complete`);
      toast.success("Job marked as complete. Awaiting contractor verification.");
      fetchMyJobs(); refreshUser();
    } catch (e) { toast.error(getErr(e, "Failed")); }
  };

  const withdrawJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/withdraw`);
      toast.success("Withdrawn from job.");
      fetchMyJobs(); fetchJobs();
    } catch (e) { toast.error(getErr(e, "Failed to withdraw")); }
  };

  const messageContractor = async (jobId) => {
    try {
      const { data } = await axios.post(`${API}/messages/threads/job/${jobId}`);
      navigate(`/messages?thread=${data.id}`);
    } catch (e) {
      const detail = getErr(e, "Failed to open chat");
      if (detail.includes("UPGRADE_REQUIRED")) toast.error("Upgrade your plan to message contractors");
      else toast.error(detail);
    }
  };

  const messageAdmin = async () => {
    try {
      const { data } = await axios.post(`${API}/messages/threads/admin`);
      navigate(`/messages?thread=${data.id}`);
    } catch (e) { toast.error(getErr(e, "Failed to open support chat")); }
  };

  useEffect(() => {
    if (selectedJob?.contractor_id) {
      axios.get(`${API}/users/public/${selectedJob.contractor_id}?job_id=${selectedJob.id}`)
        .then(r => setContractorInfo(r.data))
        .catch(() => setContractorInfo(null));
    } else {
      setContractorInfo(null);
    }
  }, [selectedJob]);

  const revealContactInfo = async () => {
    setRevealLoading(true);
    try {
      const res = await axios.post(`${API}/jobs/${selectedJob.id}/reveal-contact`);
      toast.success(`Contact info unlocked! ($${res.data.amount || REVEAL_CONTACT_PRICE} demo charge)`);
      const updated = await axios.get(`${API}/users/public/${selectedJob.contractor_id}?job_id=${selectedJob.id}`);
      setContractorInfo(updated.data);
    } catch (e) { toast.error(getErr(e, "Failed to unlock contact info")); }
    finally { setRevealLoading(false); }
  };

  const shareJob = async (job) => {
    const shareUrl = `${window.location.origin}/api/j/${job.id}`;
    const shareText = `${job.title} — $${job.pay_rate}/hr in ${job.location?.city || "your area"}`;
    if (navigator.share) {
      try { await navigator.share({ title: job.title, text: shareText, url: shareUrl }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Job link copied to clipboard!");
    }
  };

  const acceptCrewRequest = async (requestId) => {
    try {
      await axios.put(`${API}/users/requests/${requestId}/accept`);
      toast.success("Request accepted!"); fetchCrewRequests();
    } catch (e) { toast.error(getErr(e, "Failed to accept")); }
  };

  const declineCrewRequest = async (requestId) => {
    try {
      await axios.put(`${API}/users/requests/${requestId}/decline`);
      toast.info("Request declined."); fetchCrewRequests();
    } catch (e) { toast.error(getErr(e, "Failed to decline")); }
  };

  // ─── Derived state ───────────────────────────────────────────────────────────
  const acceptedIds = myJobs.filter(j => j.my_status === "accepted").map(j => j.id);
  const pendingIds  = myJobs.filter(j => j.my_status === "pending").map(j => j.id);

  const isExpired = subStatus?.status === "expired";
  // Exclude fully-staffed (fulfilled) jobs — those belong in the Itinerary
  const mapJobs = [
    ...jobs,
    ...myJobs.filter(j =>
      j.my_status === "pending" &&
      j.status === "open" &&
      !jobs.some(jb => jb.id === j.id)
    ),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Subscription banners */}
        <SubscriptionBanners isExpired={isExpired} subStatus={subStatus} />

        {/* Header row */}
        <CrewDashboardHeader
          user={user}
          connected={connected}
          isOnline={isOnline}
          locationEnabled={locationEnabled}
          view={view}
          smartMatch={smartMatch}
          onToggleOnline={toggleOnlineStatus}
          onToggleLocation={toggleLocation}
          onViewChange={setView}
          onToggleSmartMatch={() => setSmartMatch(!smartMatch)}
        />

        {/* Smart Match Banner */}
        {smartMatch && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-2"
            style={{ backgroundColor: "var(--theme-accent)" + "22", border: "1px solid var(--theme-accent)", color: "var(--theme-accent)" }}
            data-testid="smart-match-banner">
            <Zap className="w-4 h-4 flex-shrink-0" />
            Smart Match active — jobs ranked by trade fit (40%) + proximity (30%) + skill overlap (30%)
          </div>
        )}

        {/* Filters row */}
        <JobFiltersRow
          grouped={grouped}
          tradeFilter={tradeFilter}
          radius={radius}
          onTradeChange={setTradeFilter}
          onRadiusChange={setRadius}
          onRefresh={fetchJobs}
        />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Map / Job List */}
          <div className="lg:col-span-2">
            {view === "map" ? (
              <JobMap jobs={mapJobs} pendingJobIds={pendingIds} userLocation={locationEnabled ? userLocation : null}
                onLocate={v => setUserLocation(v)} profileAddress={user?.address} onJobClick={setSelectedJob}
                onRefresh={fetchJobs} onRadiusChange={setRadius} height="500px" />
            ) : (
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
                  Array(3).fill(0).map((_, i) => <div key={i} className="card p-4 animate-pulse h-32 bg-slate-200 dark:bg-slate-800" />)
                ) : jobs.length === 0 ? (
                  <div className="card p-10 text-center">
                    <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-semibold">No jobs found</p>
                    <p className="text-slate-400 text-sm mt-1">Try enabling GPS or expanding radius</p>
                  </div>
                ) : jobs.map(job => (
                  <div key={job.id} className="relative">
                    {smartMatch && job.match_score !== undefined && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow"
                        style={{
                          backgroundColor: job.match_score >= 0.7 ? "var(--theme-accent)" : job.match_score >= 0.45 ? "#fbbf24" : "#94a3b8",
                          color: "#050A30",
                        }}
                        data-testid={`match-score-${job.id}`}>
                        <Zap className="w-3 h-3" />
                        {Math.round(job.match_score * 100)}%
                      </div>
                    )}
                    {pendingIds.includes(job.id) && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300" data-testid={`pending-badge-${job.id}`}>
                        Pending
                      </div>
                    )}
                    <JobCard job={job} onAccept={acceptJob} onComplete={completeJob} onPreview={setSelectedJob}
                      onShare={acceptedIds.includes(job.id) && !pendingIds.includes(job.id) ? shareJob : undefined}
                      currentUser={user} isAccepted={acceptedIds.includes(job.id) || pendingIds.includes(job.id)}
                      isPending={pendingIds.includes(job.id)} isExpired={isExpired}
                      userLocation={locationEnabled ? userLocation : null} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <CrewSidebar
              user={user}
              profileCompletion={profileCompletion}
              profileBoost={profileBoost}
              boostLoading={boostLoading}
              myJobs={myJobs}
              crewRequests={crewRequests}
              pendingIds={pendingIds}
              acceptedIds={acceptedIds}
              onBoost={activateProfileBoost}
              onWithdraw={withdrawJob}
              onMessageAdmin={messageAdmin}
              onAcceptRequest={acceptCrewRequest}
              onDeclineRequest={declineCrewRequest}
              onSelectJob={setSelectedJob}
            />
          </div>
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          contractorInfo={contractorInfo}
          acceptedIds={acceptedIds}
          pendingIds={pendingIds}
          isExpired={isExpired}
          revealLoading={revealLoading}
          revealPrice={REVEAL_CONTACT_PRICE}
          onClose={() => setSelectedJob(null)}
          onAccept={acceptJob}
          onReveal={revealContactInfo}
          onMessage={messageContractor}
          onShare={shareJob}
        />
      )}

      {/* Profile Completion Popup */}
      {showCompleteProfilePopup && (
        <ProfileCompletionPopup
          profileCompletion={profileCompletion}
          onClose={() => setShowCompleteProfilePopup(false)}
        />
      )}
    </div>
  );
}
