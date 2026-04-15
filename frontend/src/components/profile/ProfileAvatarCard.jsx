import React from "react";
import { Star, Eye, Camera } from "lucide-react";

export function ProfileAvatarCard({ user, profilePhoto, getImageUrl, profileCompletion, missingFields, fileRef, onPhotoUpload, onToggleAvailability }) {
  return (
    <div className="card p-6 text-center">
      <div className="relative w-fit mx-auto mb-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-[#050A30] flex items-center justify-center border-4 border-[#7EC8E3]">
          {profilePhoto ? (
            <img src={getImageUrl(profilePhoto)} alt="Profile"
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
            />
          ) : null}
          <span className="text-white text-3xl font-extrabold" style={{ display: profilePhoto ? "none" : "flex" }}>
            {user?.name?.[0]?.toUpperCase()}
          </span>
        </div>
        <button onClick={() => fileRef.current?.click()}
          className="absolute bottom-0 right-0 w-8 h-8 bg-[#0000FF] rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700"
          data-testid="upload-photo-btn">
          <Camera className="w-4 h-4 text-white" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoUpload} />
      </div>

      <h2 className="font-extrabold text-[#050A30] dark:text-white text-xl" style={{ fontFamily: "Manrope, sans-serif" }}>{user?.name}</h2>
      <p className="text-slate-500 text-sm capitalize">{user?.role}{user?.trade ? ` · ${user.trade}` : ""}</p>

      <div className="flex items-center justify-center gap-1 mt-2">
        {[1,2,3,4,5].map(s => (
          <Star key={s} className={`w-4 h-4 ${s <= Math.round(user?.rating || 0) ? "text-amber-400 fill-current" : "text-slate-300"}`} />
        ))}
        <span className="text-sm text-slate-500 ml-1">({user?.rating_count || 0})</span>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Profile Completion</span>
          <span className="font-semibold text-[#0000FF]">{profileCompletion}%</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-3">
          <div className="bg-[#0000FF] h-2 rounded-full transition-all" style={{ width: `${profileCompletion}%` }} />
        </div>
        {profileCompletion < 100 && missingFields.length > 0 && (
          <div className="text-left mt-1">
            <p className="text-[10px] text-slate-400 mb-1.5">Missing:</p>
            <div className="flex flex-wrap gap-1">
              {missingFields.map(f => (
                <span key={f.key} className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-500 px-1.5 py-0.5 rounded font-semibold">{f.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2">
          <div className="text-xl font-extrabold text-[#0000FF]">{user?.jobs_completed || 0}</div>
          <div className="text-xs text-slate-500">Jobs Done</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-2">
          <div className="text-xl font-extrabold text-amber-500">{user?.points || 0}</div>
          <div className="text-xs text-slate-500">Points</div>
        </div>
      </div>

      {(user?.profile_views > 0) && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-slate-400 text-xs">
          <Eye className="w-3.5 h-3.5" />
          <span>{user.profile_views} profile view{user.profile_views !== 1 ? "s" : ""}</span>
        </div>
      )}

      {user?.availability !== undefined && (
        <div className="mt-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <span className="text-sm font-semibold text-[#050A30] dark:text-white">
            {user.availability ? "Visible on Map" : "Hidden from Map"}
          </span>
          <div
            className={`w-12 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${user.availability ? "bg-emerald-500" : "bg-slate-300"}`}
            onClick={onToggleAvailability}
            data-testid="availability-toggle">
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${user.availability ? "translate-x-6" : ""}`} />
          </div>
        </div>
      )}
    </div>
  );
}
