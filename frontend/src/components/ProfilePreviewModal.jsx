import React, { useState, useEffect } from "react";
import { X, Star, MapPin, Phone, Mail, Briefcase, Award, Image as ImageIcon } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/** Normalize image paths */
function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/uploads/") ? `/api${path}` : path;
  return `${process.env.REACT_APP_BACKEND_URL}${normalized}`;
}

export function ProfilePreviewModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    
    axios.get(`${API}/users/public/${userId}`)
      .then(r => {
        setProfile(r.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load profile preview");
        onClose();
      });
  }, [userId, onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="card p-8 max-w-2xl w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0000FF] mx-auto" />
          <p className="text-center mt-4 text-slate-500">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Close Button */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-extrabold text-[#050A30] dark:text-white text-xl" style={{ fontFamily: "Manrope, sans-serif" }}>
            Profile Preview
          </h2>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Notice Banner */}
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
              👁️ This is how others see your public profile
            </p>
          </div>

          {/* Profile Photo & Basic Info */}
          <div className="flex items-start gap-6 mb-6">
            {profile.profile_photo ? (
              <img 
                src={getImageUrl(profile.profile_photo)} 
                alt={profile.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {profile.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}

            <div className="flex-1">
              <h3 className="font-extrabold text-2xl text-[#050A30] dark:text-white mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>
                {profile.name || "Anonymous"}
              </h3>
              
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Briefcase className="w-4 h-4" />
                <span className="text-sm font-semibold capitalize">
                  {profile.role === "crew" ? "Crew Member" : "Contractor"}
                  {(profile.discipline || profile.trade) && ` • ${profile.discipline || profile.trade}`}
                </span>
              </div>

              {profile.rating_count > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 text-amber-400 fill-current" />
                    <span className="font-bold text-lg">{profile.rating?.toFixed(1)}</span>
                  </div>
                  <span className="text-sm text-slate-500">({profile.rating_count} reviews)</span>
                </div>
              )}

              {profile.jobs_completed > 0 && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Award className="w-4 h-4" />
                  <span>{profile.jobs_completed} jobs completed</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="mb-6 space-y-2">
            {!profile.contact_hidden && profile.phone && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Phone className="w-4 h-4" />
                <span className="text-sm">{profile.phone}</span>
                {profile.unlock_expires_at && (
                  <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                    Unlocked
                  </span>
                )}
              </div>
            )}
            
            {profile.contact_hidden && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center italic">
                  📞 Contact info hidden for privacy
                </p>
              </div>
            )}

            {profile.email && !profile.contact_hidden && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{profile.email}</span>
              </div>
            )}

            {profile.address && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{profile.address}</span>
              </div>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mb-6">
              <h4 className="font-bold text-sm text-[#050A30] dark:text-white mb-2">About</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Skills */}
          {profile.skills?.length > 0 && (
            <div className="mb-6">
              <h4 className="font-bold text-sm text-[#050A30] dark:text-white mb-2">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span 
                    key={skill}
                    className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio */}
          {profile.portfolio_images?.length > 0 && (
            <div className="mb-6">
              <h4 className="font-bold text-sm text-[#050A30] dark:text-white mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Portfolio ({profile.portfolio_images.length})
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {profile.portfolio_images.slice(0, 6).map((img) => (
                  <div key={img} className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img 
                      src={getImageUrl(img)} 
                      alt={`Portfolio ${idx + 1}`}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
              {profile.portfolio_images.length > 6 && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  +{profile.portfolio_images.length - 6} more images
                </p>
              )}
            </div>
          )}

          {/* Recent Reviews */}
          {profile.recent_ratings?.length > 0 && (
            <div>
              <h4 className="font-bold text-sm text-[#050A30] dark:text-white mb-3">Recent Reviews</h4>
              <div className="space-y-3">
                {profile.recent_ratings.slice(0, 3).map((rating) => (
                  <div key={rating.id || rating.created_at} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {[1,2,3,4,5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-3.5 h-3.5 ${star <= rating.stars ? 'text-amber-400 fill-current' : 'text-slate-300'}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {rating.review && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                        {rating.review}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              This is a read-only preview. To edit your profile, close this window and click the "Edit" button.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
