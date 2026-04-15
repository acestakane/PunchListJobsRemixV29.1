import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import { CheckCircle, X } from "lucide-react";
import { OnboardingStep1 } from "./onboarding/OnboardingStep1";
import { OnboardingStep2 } from "./onboarding/OnboardingStep2";
import { OnboardingStep3 } from "./onboarding/OnboardingStep3";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "punchlistjobs_onboarding_done";

export default function OnboardingModal({ onClose }) {
  const { user, refreshUser, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState(user?.address || "");
  const [savingAddress, setSavingAddress] = useState(false);
  const [isOnline, setIsOnline] = useState(user?.is_online ?? false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const fileRef = useRef(null);
  // Address autofill state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const suggestionsRef = useRef(null);

  const markDone = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onClose();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    setFetchingSuggestions(true);
    try {
      const res = await axios.get(`${API}/utils/address/search`, { params: { q, limit: 5 } });
      setSuggestions(res.data.results || []);
      setShowSuggestions(true);
    } catch { setSuggestions([]); }
    finally { setFetchingSuggestions(false); }
  }, []);

  const handleAddressChange = (val) => {
    setAddress(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 380);
  };

  const selectSuggestion = (s) => {
    setAddress(s.full_address);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewPhoto(ev.target.result);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/users/upload-photo`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      updateUser({ profile_photo: res.data.url, logo: res.data.url });
      toast.success("Photo uploaded!");
      await refreshUser();
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const saveAddress = async () => {
    if (!address.trim()) { toast.error("Please enter your address"); return; }
    setSavingAddress(true);
    try {
      await axios.put(`${API}/users/profile`, { address: address.trim() });
      updateUser({ address: address.trim() });
      toast.success("Address saved and geocoded!");
      await refreshUser();
    } catch {
      toast.error("Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const saveOnlineStatus = async () => {
    try {
      await axios.put(`${API}/users/online-status`, { is_online: isOnline });
      updateUser({ is_online: isOnline, availability: isOnline });
      toast.success(isOnline ? "You're now visible on the map!" : "You're offline (hidden from map)");
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  const profilePhoto = previewPhoto || (user?.profile_photo || user?.logo
    ? `${process.env.REACT_APP_BACKEND_URL}${user.profile_photo || user.logo}`
    : null);

  const steps = [
    { num: 1, label: "Upload Photo" },
    { num: 2, label: "Add Address" },
    { num: 3, label: "Map Visibility" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Progress Header */}
        <div className="bg-[#050A30] px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-extrabold text-xl" style={{ fontFamily: "Manrope, sans-serif" }}>
                Welcome to PunchListJobs!
              </h2>
              <p className="text-[#7EC8E3] text-sm mt-0.5">Complete your profile to appear on the map</p>
            </div>
            <button onClick={markDone} className="text-slate-400 hover:text-white p-1" data-testid="skip-onboarding">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step > s.num ? "bg-emerald-500 text-white" :
                    step === s.num ? "bg-[#0000FF] text-white" :
                    "bg-white/20 text-white/50"
                  }`}>
                    {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-xs font-medium ${step === s.num ? "text-white" : "text-white/50"}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-px ${step > s.num ? "bg-emerald-500" : "bg-white/20"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {step === 1 && (
            <OnboardingStep1
              profilePhoto={profilePhoto}
              uploading={uploading}
              fileRef={fileRef}
              onFileChange={handlePhotoUpload}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <OnboardingStep2
              address={address}
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              fetchingSuggestions={fetchingSuggestions}
              suggestionsRef={suggestionsRef}
              savingAddress={savingAddress}
              onAddressChange={handleAddressChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onSuggestionSelect={selectSuggestion}
              onSkip={() => setStep(3)}
              onSaveAndNext={async () => { await saveAddress(); setStep(3); }}
            />
          )}
          {step === 3 && (
            <OnboardingStep3
              isOnline={isOnline}
              onToggle={() => setIsOnline(!isOnline)}
              onSkip={markDone}
              onFinish={async () => { await saveOnlineStatus(); markDone(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
