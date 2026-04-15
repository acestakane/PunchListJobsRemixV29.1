import React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

export function ForgotPasswordPanel({
  brand, loading, forgotEmail, setForgotEmail,
  handleForgotPassword, onBack, forgotDone,
}) {
  const inputCls = "w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none dark:bg-slate-800 dark:text-white text-slate-800 bg-white";

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center">
          <Mail className="w-5 h-5" style={{ color: brand }} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>Forgot Password</h1>
          <p className="text-xs text-slate-400">Enter your email to receive a reset link</p>
        </div>
      </div>

      {!forgotDone ? (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Email Address *</label>
            <input type="email" required value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              className={inputCls} style={{ borderColor: "transparent" }}
              placeholder="you@example.com" data-testid="forgot-email-input" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 transition-colors disabled:opacity-60"
            style={{ backgroundColor: brand }}
            data-testid="forgot-submit-btn">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
          <button type="button" onClick={onBack}
            className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            data-testid="back-to-login-btn">
            Back to Log In
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Check your email</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">A reset link has been sent if this email is registered.</p>
          </div>
          {forgotDone.demo_token && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2">Demo Mode — Reset Token</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-mono break-all mb-3">{forgotDone.demo_token}</p>
              <Link to={forgotDone.reset_url} className="text-xs font-semibold hover:underline" style={{ color: brand }}
                data-testid="go-to-reset-link">
                Go to reset form →
              </Link>
            </div>
          )}
          <button onClick={() => { onBack(); }}
            className="w-full py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold hover:border-slate-300 transition-colors"
            data-testid="back-to-login-btn">
            Back to Log In
          </button>
        </div>
      )}
    </div>
  );
}
