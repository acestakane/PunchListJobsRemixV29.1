import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/** Flies the map to a target {lat, lng, zoom} */
export function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    try { map.flyTo([target.lat, target.lng], target.zoom ?? map.getZoom(), { duration: 1.2 }); } catch {}
  }, [target, map]);
  return null;
}

/** Exposes the Leaflet map instance through a ref (must be inside MapContainer) */
export function ZoomController({ zoomRef }) {
  const map = useMap();
  if (zoomRef) zoomRef.current = map;
  return null;
}

/** Re-centres the map when the center prop changes */
export function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    try { map.setView(center, map.getZoom()); } catch {}
  }, [center, map]);
  return null;
}

/** Auto-locates via GPS on mount (only when parent has no location yet) */
export function AutoLocate({ onLocate }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        try { map.flyTo([lat, lng], 12, { duration: 1.4 }); } catch {}
        onLocate?.({ lat, lng });
      },
      () => {}
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Draws a dashed radius circle around a centre point */
export function RadiusCircle({ center, radiusKm }) {
  const map = useMap();
  const circleRef = useRef(null);
  useEffect(() => {
    if (!map) return;
    try {
      if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }
      if (!center || !radiusKm) return;
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: "#2563EB",
        fillColor: "#2563EB",
        fillOpacity: 0.06,
        weight: 1.5,
        dashArray: "6 4",
      }).addTo(map);
    } catch { /* map not ready */ }
    return () => {
      if (circleRef.current) { try { circleRef.current.remove(); } catch {} circleRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, radiusKm, map]);
  return null;
}

/** Builds a Leaflet divIcon showing the crew member's photo or initial */
export function crewImageIcon(member) {
  const photo = member.profile_photo;
  const src = photo ? `${process.env.REACT_APP_BACKEND_URL}${photo}` : null;
  const initial = (member.name || "?")[0].toUpperCase();
  const inner = src
    ? `<img src="${src}" style="width:28px;height:28px;object-fit:cover;border-radius:50%;" alt="" />`
    : `<span style="color:#fff;font-size:12px;font-weight:700;line-height:28px;">${initial}</span>`;
  return L.divIcon({
    html: `<div style="width:32px;height:32px;background:#1E293B;border-radius:50%;border:2.5px solid #38BDF8;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;overflow:hidden">${inner}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

/** Haversine distance in kilometres */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
