import DOMPurify from "dompurify";
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { HelpCircle, ChevronDown, ChevronUp, Search, AlertCircle, Mail, MessageCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_FAQS = [
  {
    q: "How do I sign up?",
    a: "Click 'Sign Up' on the landing page and choose your role — Crew Member or Contractor. Fill in your details and you're ready to go. New accounts start on the free plan.",
  },
  {
    q: "What is the difference between the free plan and paid plans?",
    a: "Free plan users have limited responses (crew) and job posts (contractors) per month. Paid plans unlock unlimited access, the live job map, messaging, and more.",
  },
  {
    q: "How does the live job map work?",
    a: "Contractors post jobs with an address and the system geocodes it to a map pin. Crew members can see nearby open jobs on the map and apply in real time.",
  },
  {
    q: "How do I get paid?",
    a: "PunchListJobs facilitates introductions between contractors and crew. Payment is arranged directly between the parties. The Pay History section logs completed work records.",
  },
  {
    q: "What are subscription plans?",
    a: "We offer Daily ($1.99), Weekly ($9.99), Monthly ($29.99) and Annual ($179.94) plans. Each unlocks premium features including unlimited job access and crew discovery.",
  },
  {
    q: "How do I contact support?",
    a: "Use the Report a Concern feature in the app, or message the support team through the Messages section. Admins respond within 1 business day.",
  },
];

function FAQItem({ q, a, brand }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        data-testid="faq-item-toggle">
        <span className="font-semibold text-slate-800 dark:text-white text-sm pr-4">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-slate-400" />
          : <ChevronDown className="w-4 h-4 flex-shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function Help() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const brand = colors.brand_color || "#2563EB";
  const [faqs, setFaqs] = useState(DEFAULT_FAQS);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cmsContent, setCmsContent] = useState(null);

  useEffect(() => {
    // Fetch admin-managed FAQs and help content from CMS
    axios.get(`${API}/cms/pages/faqs`)
      .then(res => {
        setCmsContent(res.data);
        if (res.data?.content) {
          try {
            const parsed = JSON.parse(res.data.content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Normalise: CMS uses {question,answer}, internal uses {q,a}
              setFaqs(parsed.map(f => ({ q: f.q || f.question || "", a: f.a || f.answer || "" })));
            }
          } catch (e) {
            console.warn("Help.jsx: CMS content is not JSON, using default FAQs", e);
            // Content is HTML/text, keep default FAQs
          }
        }
      })
      .catch((e) => console.warn("Help.jsx: Failed to load CMS content", e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = faqs.filter(f =>
    !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: brand + "20" }}>
            <HelpCircle className="w-7 h-7" style={{ color: brand }} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            {cmsContent?.header_text || "Help Center"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {cmsContent?.title || "Answers to common questions about PunchListJobs"}
          </p>
        </div>

        {/* CMS HTML Content (if provided by admin) */}
        {cmsContent?.content && (() => {
          try {
            JSON.parse(cmsContent.content);
            return null; // it's JSON FAQs, render below
          } catch {
            return (
              <div className="card p-6 mb-8 prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 text-sm"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cmsContent.content) }} />
            );
          }
        })()}

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2"
            style={{ focusRingColor: brand }}
            placeholder="Search for answers..."
            data-testid="help-search-input"
          />
        </div>

        {/* FAQ List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-14 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No results found</p>
            <p className="text-slate-400 text-sm mt-1">Try different keywords or browse all topics</p>
            {search && (
              <button onClick={() => setSearch("")} className="mt-3 text-sm font-semibold hover:underline" style={{ color: brand }}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2" data-testid="faq-list">
            {filtered.map((f, i) => (
              <FAQItem key={f.q} q={f.q} a={f.a} brand={brand} />
            ))}
          </div>
        )}

        {/* Contact section */}
        <div className="mt-12 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center">
          <h2 className="font-bold text-slate-800 dark:text-white text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            Still need help?
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            Our support team is here to assist you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {user && (
              <Link to="/messages"
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: brand }}
                data-testid="help-messages-link">
                <MessageCircle className="w-4 h-4" /> Send a Message
              </Link>
            )}
            <Link to="/help/report-a-concern"
              className="flex items-center justify-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              data-testid="help-report-link">
              <Mail className="w-4 h-4" /> Report a Concern
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
