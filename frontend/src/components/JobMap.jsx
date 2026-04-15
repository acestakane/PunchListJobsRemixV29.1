import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { jobIcon, emergencyJobIcon, pendingJobIcon, crewIcon, userIcon, US_STATES } from "./map/mapConstants";
import { FlyTo, ZoomController, RecenterMap, AutoLocate, RadiusCircle, crewImageIcon, haversineKm } from "./map/MapHelpers";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function JobMap({
  jobs = [],
  crew = [],
  userLocation,
  profileAddress,
  onLocate,
  onJobClick,
  contractorId,
  onRefresh,
  onCrewProfile,
  onRadiusChange,
  height = "500px",
  pendingJobIds = [],
}) {
  const [bearing, setBearing]             = useState(0);
  const [flyTarget, setFlyTarget]         = useState(null);
  const [selectedState, setSelectedState] = useState("");
  const [locating, setLocating]           = useState(false);
  const [radiusMi, setRadiusMi]           = useState(null);
  const mapRef                            = useRef(null);
  const radiusKm = radiusMi ? radiusMi * 1.609 : null;

  // Segmented control: "current" = GPS, "profile" = Profile Address
  const [mapMode, setMapMode]         = useState("current");
  const [profileCoords, setProfileCoords] = useState(null);
  const [geocoding, setGeocoding]     = useState(false);

  const defaultCenter = (mapMode === "profile" && profileCoords)
    ? [profileCoords.lat, profileCoords.lng]
    : userLocation
      ? [userLocation.lat, userLocation.lng]
      : [37.0902, -95.7129];
  const defaultZoom = (mapMode === "profile" && profileCoords) ? 13 : userLocation ? 12 : 4;

  const activeCenter = (mapMode === "profile" && profileCoords)
    ? profileCoords
    : userLocation || null;

  const filteredJobs = jobs
    .filter(j => !contractorId || j.contractor_id === contractorId)
    .filter(j => {
      if (!radiusKm || !activeCenter || !j.location?.lat || !j.location?.lng) return true;
      return haversineKm(activeCenter.lat, activeCenter.lng, j.location.lat, j.location.lng) <= radiusKm;
    });

  const filteredCrew = crew.filter(m => {
    if (!radiusKm || !activeCenter || !m.location?.lat || !m.location?.lng) return true;
    return haversineKm(activeCenter.lat, activeCenter.lng, m.location.lat, m.location.lng) <= radiusKm;
  });

  // Geocode profileAddress when switching to profile mode
  const handleProfileMode = async () => {
    if (profileCoords) {
      // coords already cached — switch mode and fly immediately
      setMapMode("profile");
      setFlyTarget({ ...profileCoords, zoom: 13 });
      return;
    }
    if (!profileAddress) {
      setMapMode("profile");
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(profileAddress)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en-US,en" } }
      );
      const data = await res.json();
      if (data[0]?.lat && data[0]?.lon) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setProfileCoords(coords);
        setMapMode("profile");
        setFlyTarget({ ...coords, zoom: 13 });
      }
    } catch { /* silently fail */ }
    setGeocoding(false);
  };

  const handleCurrentMode = () => {
    setMapMode("current");
    if (userLocation) {
      setFlyTarget({ ...userLocation, zoom: 13 });
    } else {
      handleLocate(); // trigger GPS if no location yet
    }
  };

  // Locate button handler
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setFlyTarget({ lat, lng, zoom: 14 });
        onLocate?.({ lat, lng });
        setLocating(false);
        setMapMode("current");
      },
      () => setLocating(false)
    );
  };

  // State selector handler
  const handleStateSelect = (e) => {
    const state = US_STATES.find(s => s.name === e.target.value);
    setSelectedState(e.target.value);
    if (state) setFlyTarget({ lat: state.lat, lng: state.lng, zoom: 7 });
  };

  const rotateCW  = () => setBearing(b => (b + 45) % 360);
  const rotateCCW = () => setBearing(b => (b - 45 + 360) % 360);
  const resetNorth = () => setBearing(0);

  const zoomIn  = () => { try { mapRef.current?.zoomIn(); } catch {} };
  const zoomOut = () => { try { mapRef.current?.zoomOut(); } catch {} };

  return (
    <div
      style={{ height, width: "100%" }}
      className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner z-[2]"
    >
      {/* Rotatable map layer */}
      <div
        style={{
          height: "100%",
          width: "100%",
          transform: `rotate(${bearing}deg)`,
          transition: "transform 0.35s ease",
          transformOrigin: "center center",
        }}
      >
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Wire up mapRef for programmatic zoom */}
          <ZoomController zoomRef={mapRef} />

          {/* Auto-locate on mount when parent hasn't supplied a position (current mode only) */}
          {!userLocation && mapMode === "current" && <AutoLocate onLocate={onLocate} />}

          {/* Fly to programmatic target (state select / locate button / profile mode) */}
          {flyTarget && <FlyTo target={flyTarget} />}

          {/* Radius circle around active center */}
          {radiusKm && activeCenter && <RadiusCircle center={activeCenter} radiusKm={radiusKm} />}

          {/* Keep centred when userLocation prop updates (current mode) */}
          {userLocation && mapMode === "current" && <RecenterMap center={[userLocation.lat, userLocation.lng]} />}

          {/* Current Location marker (GPS) */}
          {userLocation && mapMode === "current" && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>
                <div className="font-semibold text-green-700">Your Location</div>
              </Popup>
            </Marker>
          )}

          {/* Profile Address marker */}
          {profileCoords && mapMode === "profile" && (
            <Marker position={[profileCoords.lat, profileCoords.lng]} icon={userIcon}>
              <Popup>
                <div style={{ fontFamily: "Inter, sans-serif" }}>
                  <div className="font-semibold text-blue-700">Profile Address</div>
                  <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{profileAddress}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {filteredJobs.map(job =>
            job.location?.lat && job.location?.lng ? (
              <Marker
                key={job.id}
                position={[job.location.lat, job.location.lng]}
                icon={job.is_emergency ? emergencyJobIcon : pendingJobIds.includes(job.id) ? pendingJobIcon : jobIcon}
                eventHandlers={{ click: () => onJobClick?.(job) }}
              >
                <Popup>
                  <div style={{ fontFamily: "Inter, sans-serif", minWidth: 200 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong>{job.title}</strong>
                      <span style={{ color: "#2563EB", fontWeight: "bold" }}>${job.pay_rate}/hr</span>
                    </div>
                    <p style={{ color: "#666", fontSize: 12, margin: "4px 0" }}>{job.contractor_name}</p>
                    <p style={{ fontSize: 12 }}>Trade: {job.trade}</p>
                    <p style={{ fontSize: 12 }}>Crew: {job.crew_accepted?.length || 0}/{job.crew_needed}</p>
                    {pendingJobIds.includes(job.id) && (
                      <span style={{ background: "#FEF3C7", color: "#D97706", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: "bold", display: "inline-block", marginTop: 4 }}>
                        PENDING APPROVAL
                      </span>
                    )}
                    {job.is_emergency && (
                      <span style={{ background: "#FEE2E2", color: "#DC2626", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: "bold" }}>
                        EMERGENCY
                      </span>
                    )}
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}

          {filteredCrew.map(member =>
            member.location?.lat && member.location?.lng ? (
              <Marker
                key={member.id}
                position={[member.location.lat, member.location.lng]}
                icon={crewImageIcon(member)}
              >
                <Popup>
                  <div style={{ fontFamily: "Inter, sans-serif", minWidth: 140 }}>
                    <strong>{member.name}</strong>
                    <p style={{ fontSize: 12, color: "#666" }}>{member.discipline || member.trade || "General Labor"}</p>
                    <p style={{ fontSize: 12 }}>Rating: {member.rating?.toFixed(1) || "New"} ⭐</p>
                    {onCrewProfile && (
                      <button
                        onClick={() => onCrewProfile(member.id)}
                        style={{ marginTop: 6, width: "100%", background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        data-testid={`map-view-profile-${member.id}`}
                      >
                        View Profile
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>
      </div>

      {/* ── Non-rotating control overlay ──────────────────────────────────── */}
      <div className="absolute inset-0 z-[5] pointer-events-none">

        {/* Left controls — stacked column */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-auto">

          {/* Segmented control — only when profileAddress is available */}
          {profileAddress && (
            <div data-testid="map-mode-control">
              <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md overflow-hidden text-xs font-bold">
                <button
                  onClick={handleCurrentMode}
                  className={`px-3 py-1.5 transition-colors whitespace-nowrap ${mapMode === "current" ? "bg-blue-700 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                  data-testid="map-mode-current"
                >
                  Current Location
                </button>
                <button
                  onClick={handleProfileMode}
                  disabled={geocoding}
                  className={`px-3 py-1.5 transition-colors whitespace-nowrap border-l border-slate-200 dark:border-slate-700 ${mapMode === "profile" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"} disabled:opacity-60`}
                  data-testid="map-mode-profile"
                >
                  {geocoding ? "Locating…" : "Profile Address"}
                </button>
              </div>
            </div>
          )}

          {/* State selector */}
          <select
            value={selectedState}
            onChange={handleStateSelect}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-md focus:outline-none focus:border-blue-500 cursor-pointer max-w-[140px]"
            data-testid="state-selector"
          >
            <option value="">Jump to state...</option>
            {US_STATES.map(s => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>

          {/* Radius filter */}
          <select
            value={radiusMi || ""}
            onChange={e => {
              const mi = e.target.value ? Number(e.target.value) : null;
              setRadiusMi(mi);
              onRadiusChange?.(mi);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-md focus:outline-none focus:border-blue-500 cursor-pointer max-w-[140px]"
            data-testid="radius-select"
          >
            <option value="">All distances...</option>
            <option value="5">Within 5 mi</option>
            <option value="10">Within 10 mi</option>
            <option value="25">Within 25 mi</option>
            <option value="50">Within 50 mi</option>
            <option value="100">Within 100 mi</option>
          </select>
        </div>

        {/* Locate + Rotation — top-right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 pointer-events-auto">

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh markers"
              className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              data-testid="refresh-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              Refresh
            </button>
          )}

          {/* Locate button */}
          <button
            onClick={handleLocate}
            disabled={locating}
            title="Go to my location"
            className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-600 shadow-md hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
            data-testid="locate-btn"
          >
            {locating ? (
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>
              </svg>
            )}
            {locating ? "Locating…" : "Locate"}
          </button>

          {/* Rotation control */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md overflow-hidden flex items-center">
            <button
              onClick={rotateCCW}
              title="Rotate counterclockwise 45°"
              className="px-2.5 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              data-testid="rotate-ccw-btn"
            >
              ↺
            </button>
            <button
              onClick={resetNorth}
              title={bearing === 0 ? "North up" : `${bearing}° — click to reset`}
              className="px-2 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors border-x border-slate-200 dark:border-slate-700 min-w-[38px] text-center tabular-nums"
              data-testid="reset-north-btn"
            >
              {bearing === 0 ? "N" : `${bearing}°`}
            </button>
            <button
              onClick={rotateCW}
              title="Rotate clockwise 45°"
              className="px-2.5 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              data-testid="rotate-cw-btn"
            >
              ↻
            </button>
          </div>

          {/* Zoom control */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md overflow-hidden flex items-center">
            <button
              onClick={zoomIn}
              title="Zoom in"
              className="w-8 h-8 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              data-testid="zoom-in-btn"
            >
              +
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={zoomOut}
              title="Zoom out"
              className="w-8 h-8 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              data-testid="zoom-out-btn"
            >
              −
            </button>
          </div>
        </div>

        {/* North indicator — visible when bearing ≠ 0 */}
        {bearing !== 0 && (
          <div className="absolute bottom-12 left-3 pointer-events-none">
            <div
              className="w-8 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full shadow-md flex items-center justify-center"
              title={`Map rotated ${bearing}°`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5"
                style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.35s ease" }}
              >
                <path d="M12 2L8 10h8L12 2z" fill="#EF4444" />
                <path d="M12 22L16 14H8l4 8z" fill="#94a3b8" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
