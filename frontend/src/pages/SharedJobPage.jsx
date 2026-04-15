import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import axios from "axios";
import {
  MapPin, Clock, DollarSign, Users, AlertTriangle,
  CheckCircle, LogIn, ArrowLeft
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_LABELS = {
  open: "Open",
  fulfilled: "Slots Filled",
  in_progress: "In Progress",
  completed_pending_review: "Completed",
  completed: "Verified Complete",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

const STATUS_COLORS = {
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  fulfilled: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  in_progress: "bg-emerald-100 text-emerald-700",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  suspended: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
};

function formatTime(str) {
  if (!str) return "TBD";
  try {
    return new Date(str).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return str; }
}

export default function SharedJobPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    axios.get(`${API}/jobs/${jobId}/share`)
      .then(r => setJob(r.data))
      .catch(() => setJob(null))
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleApply = async () => {
    if (!user) {
      // Preserve destination and redirect to auth
      navigate(`/auth?redirect=/j/${jobId}`);
      return;
    }
    if (user.role !== "crew") return;
    setApplying(true);
    try {
      // axios default Authorization header is already set by AuthContext
      await axios.post(`${API}/jobs/${jobId}/accept`, {});
      navigate("/crew/dashboard");
    } catch (e) {
      // On error still send to dashboard where they can see the job
      navigate("/crew/dashboard");
    } finally {
      setApplying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#020617]">
      <div className="w-8 h-8 border-2 border-[#0000FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!job) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white dark:bg-[#020617]">
      <p className="text-slate-500">This job is no longer available.</p>
      <Link to="/" className="text-[#0000FF] hover:underline text-sm">Go to PunchListJobs</Link>
    </div>
  );

  const isCrew = user?.role === "crew";
  const isAcceptable = job.status === "open" && !job.is_full;
  const crewPct = Math.min((job.crew_accepted_count / job.crew_needed) * 100, 100);

  const ogTitle = `${job.title} — $${job.pay_rate}/hr in ${[job.city, job.state].filter(Boolean).join(", ") || "your area"}`;
  const ogDesc  = `${job.description ? job.description.slice(0, 120) + " | " : ""}${job.trade ? job.trade + " | " : ""}${job.crew_accepted_count}/${job.crew_needed} slots filled`;
  const ogUrl   = `${window.location.origin}/j/${jobId}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]">
      <Helmet>
        <title>{ogTitle} | PunchListJobs</title>
        <meta property="og:type"        content="website" />
        <meta property="og:site_name"   content="PunchListJobs" />
        <meta property="og:url"         content={ogUrl} />
        <meta property="og:title"       content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta name="twitter:card"        content="summary" />
        <meta name="twitter:title"       content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
      </Helmet>
      {user ? (
        <Navbar />
      ) : (
        <header className="sticky top-0 z-40 bg-white dark:bg-[#050A30] border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-extrabold text-[#050A30] dark:text-white text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>
            PunchListJobs
          </Link>
          <Link
            to={`/auth?redirect=/j/${jobId}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0000FF] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="shared-page-login-btn"
          >
            <LogIn className="w-4 h-4" /> Sign In
          </Link>
        </header>
      )}

      <main className="max-w-xl mx-auto px-4 py-8">
        {/* Back link for logged-in users */}
        {user && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}

        <div className="card p-6 space-y-4">
          {/* Emergency badge */}
          {job.is_emergency && (
            <div className="inline-flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold px-3 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> EMERGENCY JOB
            </div>
          )}

          {/* Title + status */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-extrabold text-[#050A30] dark:text-white text-xl leading-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              {job.title}
            </h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 capitalize ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[job.status] || job.status}
            </span>
          </div>

          {/* Pay rate */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#0000FF]" />
            <span className="text-2xl font-extrabold text-[#0000FF]">${job.pay_rate}</span>
            <span className="text-slate-500 text-sm">/hr</span>
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <MapPin className="w-4 h-4 text-[#0000FF] flex-shrink-0" />
              <div>
                <p className="font-semibold text-[#050A30] dark:text-white">
                  {[job.city, job.state].filter(Boolean).join(", ") || "Location TBD"}
                </p>
                <p className="text-[10px] text-slate-400">Approximate area</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4 text-[#0000FF] flex-shrink-0" />
              <div>
                <p className="font-semibold text-[#050A30] dark:text-white">{formatTime(job.start_time)}</p>
                <p className="text-[10px] text-slate-400">Start time</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Users className="w-4 h-4 text-[#0000FF] flex-shrink-0" />
              <div>
                <p className="font-semibold text-[#050A30] dark:text-white">{job.crew_accepted_count}/{job.crew_needed} filled</p>
                <p className="text-[10px] text-slate-400">Crew slots</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full capitalize bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                {job.trade?.startsWith("__cat__:") ? job.trade.replace("__cat__:", "") : job.trade}
              </span>
            </div>
          </div>

          {/* Fulfillment progress bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Slots filled</span>
              <span>{job.crew_accepted_count}/{job.crew_needed}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-[#0000FF] h-2 rounded-full transition-all"
                style={{ width: `${crewPct}%` }}
              />
            </div>
            {job.is_full && (
              <p className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> All slots filled
              </p>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Description</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{job.description}</p>
            </div>
          )}

          {/* CTA */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            {!user && (
              <div className="space-y-2">
                <Link
                  to={`/auth?redirect=/j/${jobId}`}
                  className="block w-full text-center py-3 rounded-xl font-bold bg-[#0000FF] text-white hover:bg-blue-700 transition-colors"
                  data-testid="shared-page-signup-cta"
                >
                  Sign in to Apply
                </Link>
                <p className="text-center text-xs text-slate-400">
                  Need an account?{" "}
                  <Link to={`/auth?redirect=/j/${jobId}`} className="text-[#0000FF] hover:underline">
                    Register free
                  </Link>
                </p>
              </div>
            )}
            {user && isCrew && isAcceptable && (
              <button
                onClick={handleApply}
                disabled={applying}
                className={`w-full py-3 rounded-xl font-bold transition-colors ${
                  job.is_emergency ? "bg-red-600 hover:bg-red-700 text-white" : "bg-[#0000FF] hover:bg-blue-700 text-white"
                } disabled:opacity-60`}
                data-testid="shared-page-apply-btn"
              >
                {applying ? "Applying..." : job.is_emergency ? "Accept Emergency Job" : "Apply for This Job"}
              </button>
            )}
            {user && isCrew && !isAcceptable && (
              <p className="text-center text-sm text-slate-500">
                {job.is_full ? "This job is fully staffed." : "This job is no longer accepting applications."}
              </p>
            )}
            {user && !isCrew && (
              <Link
                to="/"
                className="block w-full text-center py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Shared via{" "}
          <Link to="/" className="text-[#0000FF] hover:underline">PunchListJobs</Link>
        </p>
      </main>
    </div>
  );
}
