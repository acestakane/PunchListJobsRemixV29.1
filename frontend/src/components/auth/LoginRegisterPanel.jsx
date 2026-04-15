import React from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, ClipboardList, Users } from "lucide-react";
import TradeSelect from "../TradeSelect";

export function LoginRegisterPanel({
  brand, siteName, loading, mode, setMode, role, setRole,
  form, update, showPass, setShowPass,
  addrSuggestions, showAddrSugg, setShowAddrSugg, setAddrSuggestions,
  searchAddr, agreed, setAgreed, handleSubmit, grouped,
}) {
  const inputCls = "w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none dark:bg-slate-800 dark:text-white text-slate-800 bg-white";

  return (
    <>
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-8">
        <button onClick={() => setMode("login")}
          className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === "login" ? "text-white shadow-md" : "text-slate-500 dark:text-slate-400"}`}
          style={mode === "login" ? { backgroundColor: brand } : {}}
          data-testid="auth-login-tab">
          Log In
        </button>
        <button onClick={() => setMode("register")}
          className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === "register" ? "text-white shadow-md" : "text-slate-500 dark:text-slate-400"}`}
          style={mode === "register" ? { backgroundColor: brand } : {}}
          data-testid="auth-register-tab">
          Sign Up
        </button>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
        {mode === "login" ? `Sign in to your ${siteName} account` : "Join thousands of workers and contractors"}
      </p>

      {mode === "register" && (
        <div className="flex gap-3 mb-6">
          <button onClick={() => setRole("crew")}
            className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-bold text-sm transition-all"
            style={role === "crew" ? { borderColor: brand, backgroundColor: "#EFF6FF", color: brand } : { borderColor: "#E2E8F0", color: "#94A3B8" }}
            data-testid="role-crew-btn">
            <Users className="w-5 h-5" />
            Crew Member
          </button>
          <button onClick={() => setRole("contractor")}
            className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-bold text-sm transition-all"
            style={role === "contractor" ? { borderColor: brand, backgroundColor: "#EFF6FF", color: brand } : { borderColor: "#E2E8F0", color: "#94A3B8" }}
            data-testid="role-contractor-btn">
            <ClipboardList className="w-5 h-5" />
            Contractor
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">First Name *</label>
              <input type="text" value={form.first_name}
                onChange={e => update("first_name", e.target.value)}
                className={inputCls} placeholder="John" required
                data-testid="reg-first-name-input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Last Name *</label>
              <input type="text" value={form.last_name}
                onChange={e => update("last_name", e.target.value)}
                className={inputCls} placeholder="Smith" required
                data-testid="reg-last-name-input" />
            </div>
          </div>
        )}

        {mode === "register" && role === "contractor" && (
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Company Name</label>
            <input type="text" value={form.company_name}
              onChange={e => update("company_name", e.target.value)}
              className={inputCls} placeholder="Smith Construction LLC"
              data-testid="reg-company-input" />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Email Address *</label>
          <input type="email" value={form.email}
            onChange={e => update("email", e.target.value)}
            className={inputCls} placeholder="john@example.com" required
            data-testid="auth-email-input" />
        </div>

        {mode === "register" && (
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Phone Number</label>
            <input type="tel" value={form.phone}
              onChange={e => update("phone", e.target.value)}
              className={inputCls} placeholder="+1 (555) 000-0000"
              data-testid="reg-phone-input" />
          </div>
        )}

        {mode === "register" && (
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Address</label>
            <input type="text" value={form.address}
              onChange={e => { update("address", e.target.value); searchAddr(e.target.value); }}
              onFocus={() => addrSuggestions.length > 0 && setShowAddrSugg(true)}
              onBlur={() => setTimeout(() => setShowAddrSugg(false), 200)}
              className={inputCls} placeholder="123 Main St, City, State"
              data-testid="reg-address-input" autoComplete="off" />
            {showAddrSugg && addrSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl mt-1 overflow-hidden">
                {addrSuggestions.map((s, i) => (
                  <button key={s.full_address || s || i} type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    onMouseDown={() => { update("address", s.full_address || s); setShowAddrSugg(false); setAddrSuggestions([]); }}>
                    <span className="font-semibold text-slate-800 dark:text-white text-xs">{s.full_address || s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "register" && role === "crew" && (
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Primary Trade</label>
            <TradeSelect grouped={grouped} value={form.trade}
              onChange={v => update("trade", v)} placeholder="Select a trade"
              data-testid="reg-trade-select" />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Password *</label>
          <div className="relative">
            <input type={showPass ? "text" : "password"} value={form.password}
              onChange={e => update("password", e.target.value)}
              className={inputCls + " pr-10"} placeholder="Min 6 characters" required
              data-testid="auth-password-input" />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {mode === "login" && (
            <button type="button" onClick={() => setMode("forgot")}
              className="mt-1.5 text-xs font-semibold hover:underline float-right"
              style={{ color: brand }} data-testid="forgot-password-link">
              Forgot password?
            </button>
          )}
        </div>

        {mode === "register" && (
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-white mb-1.5">Referral Code (optional)</label>
            <input type="text" value={form.referral_code_used}
              onChange={e => update("referral_code_used", e.target.value.toUpperCase())}
              className={inputCls} placeholder="ABC12345"
              data-testid="reg-referral-input" />
          </div>
        )}

        {mode === "register" && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
            {[
              { key: "terms",     label: "Terms & Conditions",   slug: "terms" },
              { key: "privacy",   label: "Privacy Policy",       slug: "privacy" },
              { key: "community", label: "Community Guidelines", slug: "community-guidelines" },
            ].map(({ key, label, slug }) => (
              <label key={key} className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={agreed[key]}
                  onChange={e => setAgreed(a => ({ ...a, [key]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 flex-shrink-0"
                  data-testid={`agree-${key}`} />
                <span className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  I agree to the{" "}
                  <Link to={`/pages/${slug}`} target="_blank" rel="noopener noreferrer"
                    className="font-semibold hover:underline" style={{ color: brand }}
                    data-testid={`cms-link-${slug}`}>
                    {label}
                  </Link>
                </span>
              </label>
            ))}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full text-white py-3 rounded-xl font-bold text-base hover:opacity-90 transition-colors disabled:opacity-60 mt-2"
          style={{ backgroundColor: brand }}
          data-testid="auth-submit-btn">
          {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
        </button>
      </form>

      {mode === "login" && (
        <p className="text-center text-xs text-slate-400 mt-4">
          Admin? Use your admin credentials to access the platform.
        </p>
      )}

      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
        {mode === "login" ? (
          <>Don&apos;t have an account? <button onClick={() => setMode("register")} className="font-semibold hover:underline" style={{ color: brand }} data-testid="switch-to-register">Sign up free</button></>
        ) : (
          <>Already have an account? <button onClick={() => setMode("login")} className="font-semibold hover:underline" style={{ color: brand }} data-testid="switch-to-login">Log in</button></>
        )}
      </p>
    </>
  );
}
