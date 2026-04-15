import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle, Clock, ChevronLeft, Loader2, Inbox,
  AlertTriangle, RefreshCw
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  pending:  { label: "Under Review",  cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: Clock },
  resolved: { label: "Resolved",      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle },
  rejected: { label: "Closed",        cls: "bg-slate-100 text-slate-500 dark:bg-slate-800",                              icon: AlertTriangle },
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ResolveIssue() {
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchConcerns(signal) {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/concerns/mine`);
      if (!signal?.aborted) setConcerns(data);
    } catch {
      if (!signal?.aborted) toast.error("Failed to load concerns");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const ac = new AbortController();
    fetchConcerns(ac.signal);
    return () => ac.abort();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Back link */}
        <Link to="/help" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0000FF] mb-6 transition-colors"
          data-testid="back-to-help-resolve">
          <ChevronLeft className="w-4 h-4" /> Back to Help
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
                My Concerns
              </h1>
              <p className="text-sm text-slate-500">{concerns.length} concern{concerns.length !== 1 ? "s" : ""} submitted</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchConcerns}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              data-testid="refresh-concerns-btn">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link to="/help/report-a-concern"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0000FF] text-white text-xs font-bold hover:bg-blue-700 transition-colors"
              data-testid="new-concern-btn">
              + New Concern
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#0000FF]" />
          </div>
        ) : concerns.length === 0 ? (
          <div className="card p-12 text-center">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-500 mb-1">No concerns submitted yet</p>
            <p className="text-xs text-slate-400 mb-5">If you have an issue, we're here to help</p>
            <Link to="/help/report-a-concern"
              className="inline-block px-5 py-2.5 bg-[#0000FF] text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors"
              data-testid="report-first-concern-btn">
              Report a Concern
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {concerns.map(c => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <div key={c.id} className="card p-5" data-testid={`concern-row-${c.id}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#050A30] dark:text-white text-sm truncate">{c.subject}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">{c.category}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.cls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">{c.description}</p>

                  {c.resolution && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3 mb-3">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">Resolution</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">{c.resolution}</p>
                    </div>
                  )}

                  {c.status === "pending" && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      We will review in 5 business days · Submitted {fmtDate(c.created_at)}
                    </div>
                  )}
                  {c.status === "resolved" && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Resolved on {fmtDate(c.updated_at)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
