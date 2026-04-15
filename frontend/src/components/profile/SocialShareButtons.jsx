import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Check, Linkedin, Twitter, Facebook, Share2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function SocialShareButtons({ userId, userName }) {
  const [socialConfig, setSocialConfig] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings/public`)
      .then(r => setSocialConfig(r.data))
      .catch(() => setSocialConfig({
        social_linkedin_enabled: true,
        social_twitter_enabled: true,
        social_facebook_enabled: true,
        social_native_share_enabled: true,
      }));
  }, []);

  const profileUrl = `${window.location.origin}/profile/${userId}`;
  const shareText = `Check out ${userName}'s profile on PunchListJobs!`;

  const shareLinkedIn = () =>
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`, "_blank", "width=600,height=500");

  const shareTwitter = () =>
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`, "_blank", "width=600,height=400");

  const shareFacebook = () =>
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`, "_blank", "width=600,height=400");

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${userName} — PunchListJobs`, text: shareText, url: profileUrl });
      } catch (e) { console.warn("navigator.share cancelled or failed", e); }
    } else {
      navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Profile link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!socialConfig) return null;

  return (
    <div className="card p-4">
      <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
        Share Your Profile
      </h3>
      <div className="flex flex-wrap gap-2">
        {socialConfig.social_linkedin_enabled && (
          <button onClick={shareLinkedIn}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0077B5] text-white rounded-lg text-xs font-bold hover:bg-[#006097] transition-colors"
            data-testid="share-linkedin-btn">
            <Linkedin className="w-3.5 h-3.5" /> LinkedIn
          </button>
        )}
        {socialConfig.social_twitter_enabled && (
          <button onClick={shareTwitter}
            className="flex items-center gap-1.5 px-3 py-2 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
            data-testid="share-twitter-btn">
            <Twitter className="w-3.5 h-3.5" /> X
          </button>
        )}
        {socialConfig.social_facebook_enabled && (
          <button onClick={shareFacebook}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1877F2] text-white rounded-lg text-xs font-bold hover:bg-[#1465d5] transition-colors"
            data-testid="share-facebook-btn">
            <Facebook className="w-3.5 h-3.5" /> Facebook
          </button>
        )}
        {socialConfig.social_native_share_enabled && (
          <button onClick={shareNative}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-600 transition-colors"
            data-testid="share-native-btn">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Share Link"}
          </button>
        )}
      </div>
    </div>
  );
}
