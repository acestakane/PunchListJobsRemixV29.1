"""
email_utils.py — Unified email delivery with Resend, SMTP, and mock-log fallback.

Priority order:
  1. Resend  — set RESEND_API_KEY + SENDER_EMAIL
  2. SMTP    — set SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASSWORD + SENDER_EMAIL
  3. Mock    — logs to console + in-memory store (no keys needed)

All public helpers are async and fire-and-forget safe.
"""
import asyncio
import logging
import os
import smtplib
from collections import deque
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
RESEND_API_KEY  = os.environ.get("RESEND_API_KEY", "")
SMTP_HOST       = os.environ.get("SMTP_HOST", "")
SMTP_PORT       = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER       = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD   = os.environ.get("SMTP_PASSWORD", "")
SENDER_EMAIL    = os.environ.get("SENDER_EMAIL", "noreply@punchlistjobs.com")
SENDER_NAME     = os.environ.get("SENDER_NAME", "PunchListJobs")

# In-memory mock log — last 50 emails (visible via admin API)
mock_email_log: deque = deque(maxlen=50)

# ── Delivery mode ─────────────────────────────────────────────────────────────
def _active_mode() -> str:
    if RESEND_API_KEY:
        return "resend"
    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        return "smtp"
    return "mock"


# ── Free-tier guard ───────────────────────────────────────────────────────────
def is_free_tier(user: dict | None) -> bool:
    if not user:
        return True
    return user.get("subscription_status") in ("free", "expired", None)


# ── Core send ─────────────────────────────────────────────────────────────────
async def send_email(to: str, subject: str, html: str, sender_user: dict | None = None) -> bool:
    if sender_user and is_free_tier(sender_user):
        logger.info(f"[EMAIL BLOCKED – free tier] to={to} subject={subject}")
        return False

    mode = _active_mode()

    if mode == "resend":
        return await _send_via_resend(to, subject, html)
    if mode == "smtp":
        return await _send_via_smtp(to, subject, html)

    # ── Mock mode ──
    entry = {
        "to": to,
        "subject": subject,
        "html": html,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "mode": "mock",
    }
    mock_email_log.appendleft(entry)
    logger.info(f"[EMAIL MOCK] to={to} | subject={subject}")
    return True


async def _send_via_resend(to: str, subject: str, html: str) -> bool:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        params = {
            "from": f"{SENDER_NAME} <{SENDER_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": html,
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"[EMAIL RESEND OK] to={to} | subject={subject}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL RESEND FAIL] {e}")
        return False


async def _send_via_smtp(to: str, subject: str, html: str) -> bool:
    def _blocking_send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{SENDER_NAME} <{SENDER_EMAIL}>"
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SENDER_EMAIL, [to], msg.as_string())
    try:
        await asyncio.to_thread(_blocking_send)
        logger.info(f"[EMAIL SMTP OK] to={to} | subject={subject}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL SMTP FAIL] {e}")
        return False


# ── HTML template helper ──────────────────────────────────────────────────────
def _wrap_template(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:#1D4ED8;padding:28px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">PunchListJobs</h1>
          <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">A Blue Collar ME Company</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px 28px;">
          {body_html}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
            &copy; 2025 PunchListJobs · A Blue Collar ME Company<br>
            <a href="#" style="color:#94a3b8;">Unsubscribe</a> &nbsp;|&nbsp;
            <a href="#" style="color:#94a3b8;">Privacy Policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Typed email helpers ───────────────────────────────────────────────────────

async def send_welcome_email(name: str, email: str, role: str):
    role_label = role.title()
    body = f"""
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">Welcome aboard, {name}!</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Your <strong>{role_label}</strong> account on PunchListJobs is ready to go.
        {'Browse open jobs and apply with one tap.' if role == 'crew' else 'Post your first job and start finding qualified crew today.'}
      </p>
      <a href="https://punchlistjobs.com" style="display:inline-block;background:#1D4ED8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        {'Find Jobs' if role == 'crew' else 'Post a Job'}
      </a>"""
    await send_email(email, "Welcome to PunchListJobs!", _wrap_template("Welcome", body))


async def send_job_notification_email(crew_email: str, crew_name: str, job_title: str,
                                       pay_rate: float, location: str,
                                       sender_user: dict | None = None):
    body = f"""
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">New Job Match: {job_title}</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 20px;">Hi <strong>{crew_name}</strong>, a job matching your skills just posted:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 24px;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:110px;">Job Title</td>
            <td style="padding:6px 0;color:#0f172a;font-weight:600;font-size:13px;">{job_title}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Pay Rate</td>
            <td style="padding:6px 0;color:#16a34a;font-weight:700;font-size:14px;">${pay_rate}/hr</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Location</td>
            <td style="padding:6px 0;color:#0f172a;font-size:13px;">{location}</td></tr>
      </table>
      <a href="https://punchlistjobs.com" style="display:inline-block;background:#1D4ED8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View &amp; Apply</a>"""
    await send_email(crew_email, f"New Job Match: {job_title}",
                     _wrap_template("New Job", body), sender_user=sender_user)


async def send_job_completion_email(contractor_email: str, contractor_name: str,
                                     job_title: str, sender_user: dict | None = None):
    body = f"""
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">Job Completed</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Hi <strong>{contractor_name}</strong>, your job <strong>"{job_title}"</strong> has been marked as complete.
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
        Head to your dashboard to leave a rating for your crew and view your job history.
      </p>
      <a href="https://punchlistjobs.com" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Rate Your Crew</a>"""
    await send_email(contractor_email, f"Job Completed: {job_title}",
                     _wrap_template("Job Completed", body), sender_user=sender_user)


async def send_application_email(contractor_email: str, contractor_name: str,
                                  job_title: str, crew_name: str,
                                  sender_user: dict | None = None):
    body = f"""
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">New Application Received</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Hi <strong>{contractor_name}</strong>, <strong>{crew_name}</strong> has applied for your job <strong>"{job_title}"</strong>.
      </p>
      <a href="https://punchlistjobs.com" style="display:inline-block;background:#1D4ED8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Review Application</a>"""
    await send_email(contractor_email, f"New Application: {job_title}",
                     _wrap_template("New Application", body), sender_user=sender_user)


async def send_subscription_email(email: str, name: str, plan: str, end_date: str,
                                   is_reminder: bool = False):
    if is_reminder:
        subject = "Subscription Expiring Soon — PunchListJobs"
        headline = "Your subscription is expiring soon"
        detail   = f"Your <strong>{plan}</strong> plan expires on <strong>{end_date}</strong>. Renew now to keep uninterrupted access."
        cta_text = "Renew Now"
        cta_color = "#dc2626"
    else:
        subject = "Subscription Activated — PunchListJobs"
        headline = "Subscription activated!"
        detail   = f"Your <strong>{plan}</strong> plan is active until <strong>{end_date}</strong>. Enjoy full access to all features."
        cta_text = "Go to Dashboard"
        cta_color = "#1D4ED8"

    body = f"""
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">{headline}</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px;">Hi <strong>{name}</strong>, {detail}</p>
      <a href="https://punchlistjobs.com" style="display:inline-block;background:{cta_color};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">{cta_text}</a>"""
    await send_email(email, subject, _wrap_template(subject, body))


async def send_password_reset_email(email: str, name: str, reset_token: str):
    reset_url = f"https://punchlistjobs.com/reset-password?token={reset_token}"
    body = f"""
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">Reset Your Password</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">Hi <strong>{name}</strong>, click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="{reset_url}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Reset Password</a>
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;">If you didn't request this, you can safely ignore this email.</p>"""
    await send_email(email, "Reset Your PunchListJobs Password", _wrap_template("Reset Password", body))
