import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PushContext = createContext(null);

export function PushProvider({ children }) {
  const [supported, setSupported]         = useState(false);
  const [permission, setPermission]       = useState("default");
  const [subscribed, setSubscribed]       = useState(false);
  const [swReady, setSwReady]             = useState(false);
  const [registration, setRegistration]   = useState(null);

  // ── Service Worker registration ────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setRegistration(reg);
        setSwReady(true);
        // Navigate to URL when service worker sends PUSH_NAV message
        navigator.serviceWorker.addEventListener("message", (e) => {
          if (e.data?.type === "PUSH_NAV" && e.data.url) {
            window.location.href = e.data.url;
          }
        });
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (sub) setSubscribed(true);
      })
      .catch((err) => console.warn("SW registration failed:", err));
  }, []);

  // ── Subscribe ──────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!swReady || !registration) return toast.error("Service worker not ready yet.");

    try {
      const keyRes = await axios.get(`${API}/push/vapid-public-key`);
      const publicKey = keyRes.data.public_key;
      if (!publicKey) return toast.error("VAPID key not configured on server.");

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return toast.error("Notification permission denied.");

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await axios.post(`${API}/push/subscribe`, { subscription: sub.toJSON() });
      setSubscribed(true);
      toast.success("Push notifications enabled!");
    } catch (err) {
      console.error("Subscribe failed:", err);
      toast.error("Failed to enable push notifications.");
    }
  }, [swReady, registration]);

  // ── Unsubscribe ────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await axios.delete(`${API}/push/unsubscribe`, { data: { subscription: sub.toJSON() } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Push notifications disabled.");
    } catch (err) {
      console.error("Unsubscribe failed:", err);
      toast.error("Failed to disable push notifications.");
    }
  }, [registration]);

  // ── Test ───────────────────────────────────────────────
  const sendTestPush = useCallback(async () => {
    try {
      const res = await axios.post(`${API}/push/test`);
      toast.success(`Test notification sent to ${res.data.delivered} device(s).`);
    } catch {
      toast.error("Test push failed.");
    }
  }, []);

  return (
    <PushContext.Provider value={{ supported, permission, subscribed, swReady, subscribe, unsubscribe, sendTestPush }}>
      {children}
    </PushContext.Provider>
  );
}

export function usePush() {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error("usePush must be used inside PushProvider");
  return ctx;
}

// ── Helpers ────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
