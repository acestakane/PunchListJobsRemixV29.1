import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Star, MapPin, Phone, Copy, ExternalLink, Unlock, Lock, Car } from "lucide-react";
import axios from "axios";
import { getErr } from "../../utils/errorUtils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function CrewProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [showTravel, setShowTravel] = useState(true);

  useEffect(() => {
    axios.get(`${API}/settings/public`).then(r => {
      setShowTravel(r.data.show_travel_distance !== false);
    }).catch(() => {});
  }, []);

  const fetchProfile = () => {
    axios.get(`${API}/users/public/${userId}`)
      .then(r => { setProfile(r.data); setLoading(false); })
      .catch(() => { toast.error("Failed to load profile"); onClose(); });
  };

  useEffect(() => {
    fetchProfile();
  }, [userId, onClose]);

  const handleUnlockContact = async () => {
    setUnlocking(true);
    try {
      const response = await axios.post(`${API}/users/${userId}/unlock-contact`);
      const expiresAt = new Date(response.data.expires_at).toLocaleDateString();
      
      if (response.data.already_unlocked) {
        toast.info(`Contact already unlocked until ${expiresAt}`);
      } else {
        toast.success(`Contact unlocked! Valid until ${expiresAt}`);
      }
      
      // Refresh profile to show contact info
      fetchProfile();
    } catch (e) {
      toast.error(getErr(e, "Failed to unlock contact"));
    } finally {
      setUnlocking(false);
    }
  };

  const shareProfile = () => {
    const url = `${window.location.origin}/profile/${userId}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Profile link copied!"));
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="card p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0000FF] mx-auto" />
      </div>
    </div>
  );

  if (!profile) return null;

  const contactIsHidden = profile.contact_hidden === true;
  const hasUnlockExpiry = profile.unlock_expires_at;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-sm w-full p-6 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-4 mb-4">
          {profile.profile_photo ? (
            <img src={`${process.env.REACT_APP_BACKEND_URL}${profile.profile_photo}`} alt={profile.name}
              className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 bg-[#050A30] rounded-full flex items-center justify-center text-white text-xl font-bold">
              {profile.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-extrabold text-[#050A30] dark:text-white text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>
              {profile.name}
            </h3>
            <p className="text-slate-500 text-sm capitalize">
              {(profile.trade?.startsWith("__cat__:") ? profile.trade.replace("__cat__:", "") : profile.trade) || "General Labor"}
            </p>
            {profile.rating_count > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                <span className="text-sm font-semibold">{profile.rating?.toFixed(1)}</span>
                <span className="text-xs text-slate-400">({profile.rating_count})</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Jobs Completed</span>
            <span className="font-bold">{profile.jobs_completed || 0}</span>
          </div>
          {profile.address && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs">{profile.address}</span>
            </div>
          )}
          
          {/* Contact Info Section */}
          {contactIsHidden ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  Contact Hidden
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-3 italic">
                Phone and email are hidden until unlocked
              </p>
              <button
                onClick={handleUnlockContact}
                disabled={unlocking}
                className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="unlock-contact-btn"
              >
                {unlocking ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Unlocking...
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    Unlock Contact (7 days)
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {profile.phone && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{profile.phone}</span>
                  {hasUnlockExpiry && (
                    <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                      Unlocked
                    </span>
                  )}
                </div>
              )}
              {hasUnlockExpiry && (
                <p className="text-xs text-slate-500 italic">
                  Access until {new Date(hasUnlockExpiry).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </div>

        {profile.bio && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">{profile.bio}</p>
        )}

        {/* Travel / Transportation — admin-controlled visibility */}
        {showTravel && (profile.transportation_type || profile.travel_radius_miles != null || profile.availability !== undefined) && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg" data-testid="travel-distance-section">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Car className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Travel Info</span>
            </div>
            {profile.transportation_type && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Transport:</span> {profile.transportation_type}
              </p>
            )}
            {profile.travel_radius_miles != null && profile.travel_radius_miles !== "" && (
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5" data-testid="crew-travel-radius">
                <span className="font-medium">Travel Range:</span>{" "}
                <span className="text-blue-600 dark:text-blue-400 font-semibold">Up to {profile.travel_radius_miles} miles</span>
              </p>
            )}
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
              <span className="font-medium">Availability:</span>{" "}
              <span className={profile.availability ? "text-green-600 dark:text-green-400" : "text-slate-400"}>
                {profile.availability ? "Available" : "Unavailable"}
              </span>
            </p>
          </div>
        )}
        {profile.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {profile.skills.map(s => (
              <span key={s} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={shareProfile}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:border-slate-300 transition-colors">
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </button>
          <a href={`/profile/${userId}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#0000FF] text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> View Full
          </a>
        </div>
      </div>
    </div>
  );
}
