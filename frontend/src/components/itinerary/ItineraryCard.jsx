import React from "react";
import { toast } from "sonner";
import {
  CalendarDays, Clock, DollarSign, MapPin, Building2, Briefcase,
  User, Phone, Mail, CheckCircle2, Square, CheckSquare, Inbox,
} from "lucide-react";

export function fmtDate(iso) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export function fmtTime(iso) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function downloadCalendar(job) {
  const start = job.start_time ? new Date(job.start_time) : new Date();
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const loc = job.address || job.location?.city || "";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${(job.title || "").replace(/[,;]/g, " ")}`,
    `DESCRIPTION:${(job.description || "").replace(/\n/g, "\\n")}`,
    `LOCATION:${loc}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(job.title || "job").replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function openDirections(job) {
  const addr = job.address || (job.location?.lat ? `${job.location.lat},${job.location.lng}` : null);
  if (addr) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, "_blank");
  } else {
    toast.error("No location available for this job");
  }
}

export function ItineraryCard({ job, isSelected, dimmed, onSelect, role, onTaskCheck, userId }) {
  const loc = job.location || {};
  const street = (job.address || loc.address || "").split(",")[0].trim();
  const city = loc.city || "";
  const state = loc.state || "";
  const zip = loc.zip || "";
  const cityLine = [city, state, zip].filter(Boolean).join(", ");

  const statusClass = {
    fulfilled: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    in_progress: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    suspended: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    completed_pending_review: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  }[job.status] || "bg-slate-100 text-slate-600";

  const isContractorRole = ["contractor", "admin", "superadmin"].includes(role);

  return (
    <div
      onClick={() => onSelect(job.id)}
      data-testid={`itinerary-card-${job.id}`}
      className={`rounded-xl border cursor-pointer transition-all duration-200 p-4 mb-3 select-none
        ${isSelected
          ? "border-[#0000FF] shadow-lg ring-2 ring-[#0000FF]/20 bg-white dark:bg-slate-800"
          : dimmed
          ? "border-slate-200 dark:border-slate-700 opacity-40 bg-white dark:bg-slate-900"
          : "border-slate-200 dark:border-slate-700 hover:border-[#0000FF]/50 hover:shadow-md bg-white dark:bg-slate-900"
        }`}
    >
      {/* Date row */}
      <div className={`text-center py-1.5 rounded-lg mb-3 text-xs font-bold
        ${isSelected ? "bg-[#0000FF] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
        <CalendarDays className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
        {fmtDate(job.start_time)}
      </div>

      {/* Time + Pay */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-[#0000FF]" />
          <span className="font-semibold">{fmtTime(job.start_time)}</span>
        </div>
        <div className="flex items-center gap-0.5 text-[#0000FF] font-extrabold text-base">
          <DollarSign className="w-3.5 h-3.5" />{job.pay_rate}/hr
        </div>
      </div>

      {/* Company Name */}
      <div className="flex items-center gap-1.5 mb-1">
        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="font-semibold text-[#050A30] dark:text-white text-sm truncate">
          {job.contractor_profile?.company_name || job.contractor_name || "—"}
        </span>
      </div>

      {/* Job Role / Title */}
      <div className="flex items-center gap-1.5 mb-2">
        <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-slate-700 dark:text-slate-300 text-sm truncate">{job.title}</span>
      </div>

      {/* Address */}
      <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
        <MapPin className="w-3 h-3 text-[#0000FF] mt-0.5 flex-shrink-0" />
        <div>
          {street && <div>{street}</div>}
          {cityLine && <div>{cityLine}</div>}
          {!street && !cityLine && <span className="italic">No address set</span>}
        </div>
      </div>

      {/* Status */}
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusClass}`}>
        {job.status?.replace(/_/g, " ")}
      </span>

      {/* Role-specific contact info (only when selected) */}
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          {role === "crew" && job.contractor_profile?.name && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Contractor</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <User className="w-3 h-3 text-[#0000FF]" /> {job.contractor_profile.name}
              </div>
              {job.contractor_profile.phone && (
                <a href={`tel:${job.contractor_profile.phone}`}
                  className="flex items-center gap-1.5 text-xs text-[#0000FF] hover:underline"
                  onClick={e => e.stopPropagation()}>
                  <Phone className="w-3 h-3" /> {job.contractor_profile.phone}
                </a>
              )}
              {job.contractor_profile.email && (
                <a href={`mailto:${job.contractor_profile.email}`}
                  className="flex items-center gap-1.5 text-xs text-[#0000FF] hover:underline"
                  onClick={e => e.stopPropagation()}>
                  <Mail className="w-3 h-3" /> {job.contractor_profile.email}
                </a>
              )}
            </div>
          )}
          {isContractorRole && job.crew_profiles?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                Crew ({job.crew_profiles.length})
              </p>
              <div className="space-y-1">
                {job.crew_profiles.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className="font-medium">{c.name}</span>
                    {c.trade && <span className="text-slate-400">· {c.trade}</span>}
                    {c.phone && <span className="text-slate-400">· {c.phone}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PunchList Task Checklist */}
          {job.tasks?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">PunchList</p>
              <ul className="space-y-1.5">
                {job.tasks.map((task, idx) => {
                  const actorKey = isContractorRole ? "contractor" : userId;
                  const checked = !!(job.task_completions?.[actorKey]?.[idx]);
                  return (
                    <li key={idx} className="flex items-center gap-2 cursor-pointer group"
                      onClick={e => { e.stopPropagation(); onTaskCheck && onTaskCheck(job.id, idx, !checked); }}
                      data-testid={`task-check-${job.id}-${idx}`}>
                      {checked
                        ? <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <Square className="w-4 h-4 text-slate-300 group-hover:text-[#0000FF] flex-shrink-0 transition-colors" />}
                      <span className={`text-xs ${checked ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>{task}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {isSelected && (
        <p className="mt-2 text-center text-xs text-[#0000FF] font-semibold">
          Selected — use actions below
        </p>
      )}
    </div>
  );
}

export function EmptyPane({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
      <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">{label}</p>
      <p className="text-xs text-slate-400 mt-1">Jobs with confirmed crew appear here</p>
    </div>
  );
}
