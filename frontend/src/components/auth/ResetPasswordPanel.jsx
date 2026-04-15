import React from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";

export function ResetPasswordPanel({
  brand, loading, resetToken, setResetToken,
  newPassword, setNewPassword, showPass, setShowPass,
  handleResetPassword, onBack,
}) {
  const inputCls = "w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none dark:bg-slate-800 dark:text-white text-slate-800 bg-white";

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center">
          <KeyRound className="w-5 h-5" style={{ color: brand }} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>Reset Password</h1>
          <p className="text-xs text-slate-400">Enter your reset token and a new password</p>
        </div>
      </div>
      <form onSubmit={handleResetPassword} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Reset Token *</label>
          <input type="text" required value={resetToken}
            onChange={e => setResetToken(e.target.value)}
            className={inputCls + " font-mono"}
            placeholder="Paste your reset token" data-testid="reset-token-input" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">New Password *</label>
          <div className="relative">
            <input type={showPass ? "text" : "password"} required value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputCls + " pr-10"}
              placeholder="Min 6 characters" data-testid="reset-new-password-input" />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-60"
          style={{ backgroundColor: brand }}
          data-testid="reset-submit-btn">
          {loading ? "Resetting..." : "Set New Password"}
        </button>
        <button type="button" onClick={onBack}
          className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          Back to Log In
        </button>
      </form>
    </div>
  );
}
