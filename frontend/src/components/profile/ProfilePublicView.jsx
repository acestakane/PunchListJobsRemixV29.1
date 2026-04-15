import React from "react";
import { Star } from "lucide-react";
import { SocialShareButtons } from "./SocialShareButtons";

/**
 * Read-only public profile view when viewing another user's profile.
 * Extracted from ProfilePage.jsx to reduce component size.
 */
export function ProfilePublicView({ viewingUser, getImageUrl, onBack }) {
  const vu = viewingUser;
  const vuPhoto = vu.profile_photo || vu.logo;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0000FF] mb-4 font-semibold transition-colors"
        data-testid="profile-back-btn">
        ← Back
      </button>
      <div className="card p-8 text-center">
        <div className="relative w-fit mx-auto mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#050A30] flex items-center justify-center border-4 border-[#7EC8E3]">
            {vuPhoto ? (
              <img
                src={getImageUrl(vuPhoto)}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
              />
            ) : null}
            <span
              className="text-white text-3xl font-extrabold"
              style={{ display: vuPhoto ? "none" : "flex" }}>
              {vu.name?.[0]?.toUpperCase()}
            </span>
          </div>
        </div>
        <h2 className="font-extrabold text-[#050A30] dark:text-white text-2xl mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>{vu.name}</h2>
        <p className="text-slate-500 capitalize">
          {vu.role}{(vu.discipline || vu.trade) ? ` · ${vu.discipline || vu.trade}` : ""}
          {(vu.location?.city || vu.address) && (
            <span className="ml-1 text-slate-400">
              · {vu.location?.city
                ? [vu.location.city, vu.location.state].filter(Boolean).join(", ")
                : vu.address}
            </span>
          )}
        </p>
        <div className="flex items-center justify-center gap-1 mt-2 mb-4">
          {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(vu.rating || 0) ? "text-amber-400 fill-current" : "text-slate-300"}`} />)}
          <span className="text-sm text-slate-500 ml-1">({vu.rating_count || 0} reviews)</span>
        </div>
        {vu.bio && <p className="text-slate-600 dark:text-slate-400 mb-4">{vu.bio}</p>}
        {vu.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mb-4">
            {vu.skills.map(s => <span key={s} className="bg-blue-100 dark:bg-blue-900/50 text-[#0000FF] px-2 py-1 rounded-full text-xs font-semibold">{s}</span>)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-4">
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
            <div className="text-2xl font-extrabold text-[#0000FF]">{vu.jobs_completed || 0}</div>
            <div className="text-xs text-slate-500">Jobs Done</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3">
            <div className="text-2xl font-extrabold text-amber-500">{vu.rating_count > 0 ? vu.rating?.toFixed(1) : "—"}</div>
            <div className="text-xs text-slate-500">Rating</div>
          </div>
        </div>
        {/* Public portfolio grid */}
        {vu.portfolio_images?.length > 0 && (
          <div className="text-left mt-4">
            <p className="text-sm font-semibold text-[#050A30] dark:text-white mb-2">Portfolio</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {vu.portfolio_images.map((url, i) => (
                <div key={url || i} className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={getImageUrl(url)}
                    alt={`Portfolio ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.style.display = "none"; }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4">
        <SocialShareButtons userId={vu.id} userName={vu.name} />
      </div>
    </div>
  );
}
