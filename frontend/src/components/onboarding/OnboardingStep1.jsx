import React from "react";
import { Camera, ArrowRight, Upload } from "lucide-react";

export function OnboardingStep1({ profilePhoto, uploading, fileRef, onFileChange, onNext }) {
  return (
    <div className="text-center">
      <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
        STEP 1 — Upload Your Photo
      </h3>
      <p className="text-slate-500 text-sm mb-6">Contractors are more likely to hire crew with a profile photo.</p>

      <div className="relative inline-block mb-6">
        <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-4 border-[#7EC8E3]">
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-10 h-10 text-slate-400" />
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-0 right-0 w-9 h-9 bg-[#0000FF] rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700"
          data-testid="onboarding-upload-photo"
        >
          <Upload className="w-4 h-4 text-white" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      </div>

      {uploading && <p className="text-sm text-blue-500 mb-4">Uploading...</p>}

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
          data-testid="skip-step-1"
        >
          Skip for now
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0000FF] text-white rounded-xl text-sm font-bold hover:bg-blue-700"
          data-testid="next-step-1"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
