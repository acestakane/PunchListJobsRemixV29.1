import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { toast } from "sonner";
import { getErr } from "../utils/errorUtils";
import axios from "axios";
import { ClipboardList, CheckCircle, ArrowLeft } from "lucide-react";
import { ForgotPasswordPanel } from "../components/auth/ForgotPasswordPanel";
import { ResetPasswordPanel } from "../components/auth/ResetPasswordPanel";
import { LoginRegisterPanel } from "../components/auth/LoginRegisterPanel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const HERO_BG = "https://images.unsplash.com/photo-1693478501743-799eefbc0ecd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwdGVhbSUyMHdvcmtpbmd8ZW58MHx8fHwxNzczMzk4OTM5fDA&ixlib=rb-4.1.0&q=85";

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { siteName, tagline, colors } = useTheme();
  const brand = colors.brand_color || "#2563EB";

  const [mode, setMode] = useState(params.get("mode") || "login");
  const [role, setRole] = useState(params.get("role") || "crew");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [grouped, setGrouped] = useState([]);

  useEffect(() => {
    axios.get(`${API}/trades`).then(r => setGrouped(r.data.categories || [])).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", password: "",
    phone: "", address: "", company_name: "", referral_code_used: "", trade: ""
  });

  const [addrSuggestions, setAddrSuggestions] = useState([]);
  const [showAddrSugg, setShowAddrSugg] = useState(false);
  const addrTimer = useRef(null);

  const searchAddr = (q) => {
    clearTimeout(addrTimer.current);
    if (!q || q.length < 3) { setAddrSuggestions([]); return; }
    addrTimer.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/utils/address/search`, { params: { q, limit: 5 } });
        setAddrSuggestions(res.data.results || res.data || []);
        setShowAddrSugg(true);
      } catch { setAddrSuggestions([]); }
    }, 350);
  };

  const [agreed, setAgreed] = useState({ terms: false, privacy: false, community: false });
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDone, setForgotDone] = useState(null);
  const [resetToken, setResetToken] = useState(params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(form.email, form.password);
        toast.success(`Welcome back, ${user.name}!`);
        if (user.role === "crew") navigate("/crew/dashboard");
        else if (user.role === "contractor") navigate("/contractor/dashboard");
        else navigate("/admin/dashboard");
      } else {
        if (!form.first_name.trim()) { toast.error("First name is required"); setLoading(false); return; }
        if (!form.last_name.trim()) { toast.error("Last name is required"); setLoading(false); return; }
        if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); setLoading(false); return; }
        if (!agreed.terms || !agreed.privacy || !agreed.community) {
          toast.error("Please accept all required agreements to continue.");
          setLoading(false); return;
        }
        const payload = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          name: `${form.first_name.trim()} ${form.last_name.trim()}`,
          email: form.email,
          password: form.password,
          phone: form.phone,
          address: form.address,
          referral_code_used: form.referral_code_used,
          role,
        };
        if (role === "contractor") payload.company_name = form.company_name;
        if (role === "crew") payload.trade = form.trade;
        const user = await register(payload);
        toast.success(`Welcome to ${siteName}, ${user.name}! You're on the free plan.`);
        if (user.role === "crew") navigate("/crew/dashboard");
        else navigate("/contractor/dashboard");
      }
    } catch (err) {
      toast.error(getErr(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/forgot-password`, { email: forgotEmail });
      setForgotDone(res.data);
      toast.success("Reset link generated.");
    } catch (err) {
      toast.error(getErr(err, "Failed to send reset link"));
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { token: resetToken, new_password: newPassword });
      toast.success("Password reset! You can now log in.");
      setMode("login"); setResetToken(""); setNewPassword("");
    } catch (err) {
      toast.error(getErr(err, "Invalid or expired token"));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Left Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(29,78,216,0.92) 0%, rgba(37,99,235,0.4) 100%), url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brand }}>
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-white font-extrabold text-xl" style={{ fontFamily: "Manrope, sans-serif" }}>{siteName}</div>
              <div className="text-blue-200 text-xs">{tagline}</div>
            </div>
          </Link>
          <div>
            <h2 className="text-4xl font-extrabold text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
              Your work.<br />Your terms.
            </h2>
            <p className="text-slate-300 text-lg mb-8">Real-time workforce marketplace for blue collar professionals.</p>
            <div className="space-y-3">
              {["Free plan included", "Live job map", "Instant payouts", "AI job matching"].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-300" />
                  <span className="text-slate-200">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Content Panel */}
      <div className="flex-1 lg:w-1/2 bg-white dark:bg-[#020617] flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          {mode === "forgot" && (
            <ForgotPasswordPanel
              brand={brand} loading={loading}
              forgotEmail={forgotEmail} setForgotEmail={setForgotEmail}
              handleForgotPassword={handleForgotPassword}
              onBack={() => { setMode("login"); setForgotDone(null); setForgotEmail(""); }}
              forgotDone={forgotDone}
            />
          )}

          {mode === "reset" && (
            <ResetPasswordPanel
              brand={brand} loading={loading}
              resetToken={resetToken} setResetToken={setResetToken}
              newPassword={newPassword} setNewPassword={setNewPassword}
              showPass={showPass} setShowPass={setShowPass}
              handleResetPassword={handleResetPassword}
              onBack={() => setMode("login")}
            />
          )}

          {(mode === "login" || mode === "register") && (
            <LoginRegisterPanel
              brand={brand} siteName={siteName} loading={loading}
              mode={mode} setMode={setMode}
              role={role} setRole={setRole}
              form={form} update={update}
              showPass={showPass} setShowPass={setShowPass}
              addrSuggestions={addrSuggestions}
              showAddrSugg={showAddrSugg} setShowAddrSugg={setShowAddrSugg}
              setAddrSuggestions={setAddrSuggestions}
              searchAddr={searchAddr}
              agreed={agreed} setAgreed={setAgreed}
              handleSubmit={handleSubmit}
              grouped={grouped}
            />
          )}
        </div>
      </div>
    </div>
  );
}
