import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Manages GPS watch, enable/disable, and auto-resume on permission-granted state.
 * @param {object} options
 * @param {function} options.sendLocation - WebSocket sendLocation function
 * @returns {{ locationEnabled: boolean, userLocation: object|null, toggleLocation: function }}
 */
export function useGpsLocation({ sendLocation }) {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const watchIdRef = useRef(null);

  const enableLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        sendLocation(loc.lat, loc.lng);
        axios.post(`${API}/users/location`, { lat: loc.lat, lng: loc.lng }).catch(() => {});
      },
      (err) => {
        if (err.code === 1) toast.error("Location access denied. Please allow in browser settings.");
        else toast.error("Could not get your location. Please try again.");
        setLocationEnabled(false);
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
    watchIdRef.current = id;
    setLocationEnabled(true);
    sessionStorage.setItem("gps_enabled", "1");
    toast.success("GPS enabled — showing nearest jobs first.");
  };

  const disableLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLocationEnabled(false);
    setUserLocation(null);
    sessionStorage.removeItem("gps_enabled");
    toast.info("GPS tracking disabled.");
  };

  const toggleLocation = () => {
    if (!locationEnabled) {
      enableLocation();
    } else {
      disableLocation();
    }
  };

  // Auto-enable GPS if browser already granted permission (no re-prompt needed)
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") enableLocation();
      });
    } else if (sessionStorage.getItem("gps_enabled") === "1") {
      enableLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return { locationEnabled, userLocation, toggleLocation };
}
