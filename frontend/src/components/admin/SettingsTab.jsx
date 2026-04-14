import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [editSettings, setEditSettings] = useState({});

  useEffect(() => {
    axios.get(`${API}/admin/settings`)
      .then(r => { setSettings(r.data); setEditSettings(r.data); })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    try {
      await axios.put(`${API}/admin/settings`, editSettings);
      toast.success("Settings saved");
      setSettings(editSettings);
    } catch { toast.error("Failed to save settings"); }
  };

  if (!settings) return <div className="text-slate-400 text-center py-12">Loading settings…</div>;

  return (
    <div className="card p-6 max-w-xl">
      <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-5" style={{ fontFamily: "Manrope, sans-serif" }}>Subscription Pricing</h3>
      <div className="space-y-4 mb-6">
        {[["daily_price", "Daily Pass Price ($)"], ["weekly_price", "Weekly Pass Price ($)"], ["monthly_price", "Monthly Pass Price ($)"], ["annual_price", "Annual Pass Price ($)"]].map(([key, label]) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">{label}</label>
            <input type="number" step="0.01" value={editSettings[key] || ""}
              onChange={e => setEditSettings(f => ({ ...f, [key]: parseFloat(e.target.value) }))}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 dark:bg-slate-800 dark:text-white" />
          </div>
        ))}
        <div>
          <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Job Visibility (hours after complete)</label>
          <input type="number" value={editSettings.job_visibility_hours || ""}
            onChange={e => setEditSettings(f => ({ ...f, job_visibility_hours: parseInt(e.target.value) }))}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 dark:bg-slate-800 dark:text-white" />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-[#050A30] dark:text-white mb-4 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Social Profile Sharing</h4>
        <div className="space-y-3">
          {[["social_linkedin_enabled", "LinkedIn"], ["social_twitter_enabled", "X (Twitter)"], ["social_facebook_enabled", "Facebook"], ["social_native_share_enabled", "Native Share / Copy Link"]].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <span className="text-sm font-semibold text-[#050A30] dark:text-white">{label}</span>
              <div onClick={() => setEditSettings(f => ({ ...f, [key]: !f[key] }))}
                className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors flex items-center px-0.5 ${editSettings[key] ? "bg-blue-600" : "bg-slate-300"}`}
                data-testid={`setting-${key}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editSettings[key] ? "translate-x-5" : ""}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-[#050A30] dark:text-white mb-4 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Crew Features</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-[#050A30] dark:text-white">Crew Transportation Type</p>
              <p className="text-xs text-slate-400">Require crew to specify their mode of transportation</p>
            </div>
            <div onClick={() => setEditSettings(f => ({ ...f, enable_crew_transportation_type: !f.enable_crew_transportation_type }))}
              className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors flex items-center px-0.5 ${editSettings.enable_crew_transportation_type ? "bg-blue-600" : "bg-slate-300"}`}
              data-testid="setting-enable_crew_transportation_type">
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editSettings.enable_crew_transportation_type ? "translate-x-5" : ""}`} />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-[#050A30] dark:text-white">Show Travel Distance on Crew Profiles</p>
              <p className="text-xs text-slate-400">Display crew travel willingness/transportation on profile cards</p>
            </div>
            <div onClick={() => setEditSettings(f => ({ ...f, show_travel_distance: !f.show_travel_distance }))}
              className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors flex items-center px-0.5 ${editSettings.show_travel_distance !== false ? "bg-blue-600" : "bg-slate-300"}`}
              data-testid="setting-show_travel_distance">
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editSettings.show_travel_distance !== false ? "translate-x-5" : ""}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-[#050A30] dark:text-white mb-4 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>UI Visibility</h4>
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-[#050A30] dark:text-white">Verification Sidebar</p>
            <p className="text-xs text-slate-400">Show profile completion panel to crew</p>
          </div>
          <div onClick={() => setEditSettings(f => ({ ...f, show_verification_sidebar: !f.show_verification_sidebar }))}
            className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors flex items-center px-0.5 ${editSettings.show_verification_sidebar !== false ? "bg-blue-600" : "bg-slate-300"}`}
            data-testid="setting-show_verification_sidebar">
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editSettings.show_verification_sidebar !== false ? "translate-x-5" : ""}`} />
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-[#050A30] dark:text-white mb-4 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Boost & Feature Pricing</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[["profile_boost_price", "Profile Boost (7-day)", "4.99"], ["job_boost_price", "Job Boost (7-day)", "9.99"], ["emergency_post_price", "Emergency Post", "2.99"]].map(([key, label, placeholder]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
              <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
                <span className="px-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 text-sm">$</span>
                <input type="number" step="0.01" min="0"
                  value={editSettings[key] ?? ""}
                  onChange={e => setEditSettings(f => ({ ...f, [key]: Number(e.target.value) }))}
                  placeholder={placeholder}
                  className="flex-1 px-2 py-2.5 text-sm focus:outline-none dark:bg-slate-900 dark:text-white"
                  data-testid={`setting-${key}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Site Branding */}
      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-[#050A30] dark:text-white mb-4 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Site Branding</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Site Name</label>
            <input type="text" value={editSettings.site_name ?? "PunchListJobs"}
              onChange={e => setEditSettings(f => ({ ...f, site_name: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none dark:bg-slate-900 dark:text-white"
              placeholder="PunchListJobs" data-testid="setting-site-name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tagline</label>
            <input type="text" value={editSettings.tagline ?? "A Blue Collar ME Company"}
              onChange={e => setEditSettings(f => ({ ...f, tagline: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none dark:bg-slate-900 dark:text-white"
              placeholder="A Blue Collar ME Company" data-testid="setting-tagline" />
          </div>
        </div>
      </div>

      <div className="mt-2 pt-6 border-t border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-[#050A30] dark:text-white mb-4 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Theme Colors</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[["accent_color", "Accent Color", "#38BDF8"], ["brand_color", "Brand / Button Color", "#2563EB"], ["nav_bg_color", "Nav Background", "#1D4ED8"]].map(([key, label, def]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900">
                <input type="color" value={editSettings[key] || def}
                  onChange={e => setEditSettings(f => ({ ...f, [key]: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                  data-testid={`setting-${key}`} />
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{editSettings[key] || def}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">Changes apply globally after Save.</p>

        <div className="mt-5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md" data-testid="theme-preview">
          <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-slate-400 ml-1 font-mono">live preview</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: editSettings.nav_bg_color || "#1D4ED8" }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: editSettings.brand_color || "#2563EB" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              </div>
              <div>
                <div className="text-white font-extrabold text-xs leading-none" style={{ fontFamily: "Manrope, sans-serif" }}>{editSettings.site_name || "PunchListJobs"}</div>
                <div className="text-xs leading-none mt-0.5" style={{ color: editSettings.accent_color || "#38BDF8", fontSize: 9 }}>{editSettings.tagline || "A Blue Collar ME Company"}</div>
              </div>
            </div>
            <span className="text-white text-xs font-bold px-2.5 py-1 rounded-md" style={{ backgroundColor: editSettings.brand_color || "#2563EB" }}>Sign Up</span>
          </div>
          <div className="px-4 py-4" style={{ background: "linear-gradient(135deg, #0d1117 0%, #050a30 100%)" }}>
            <p className="text-white font-extrabold text-sm mb-0.5" style={{ fontFamily: "Manrope, sans-serif" }}>Find Work Today.</p>
            <p className="font-extrabold text-sm" style={{ color: editSettings.accent_color || "#38BDF8", fontFamily: "Manrope, sans-serif" }}>Find Workers Now.</p>
            <div className="mt-3">
              <span className="text-white text-xs font-bold px-3 py-1.5 rounded-lg inline-block" style={{ backgroundColor: editSettings.brand_color || "#2563EB" }}>Get Started</span>
            </div>
          </div>
        </div>
      </div>

      <button onClick={saveSettings} className="mt-6 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors" data-testid="save-settings-btn">
        Save Settings
      </button>
    </div>
  );
}
