"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default Leaflet marker icons (Next.js / webpack issue)
const pinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/* ── Click handler inner component ── */
function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({
        lat: parseFloat(e.latlng.lat.toFixed(6)),
        lng: parseFloat(e.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

/* ── Fly to new value when it changes externally (e.g. manual input) ── */
function FlyToMarker({ value }) {
  const map = useMap();
  const prevRef = useRef(null);

  useEffect(() => {
    if (!value) return;
    const prev = prevRef.current;
    const changed =
      !prev || prev.lat !== value.lat || prev.lng !== value.lng;
    if (changed) {
      map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 13), {
        animate: true,
        duration: 0.8,
      });
      prevRef.current = value;
    }
  }, [value, map]);

  return null;
}

/**
 * LocationPickerMap
 * Props:
 *   value    – { lat, lng } | null  — current pin position
 *   onChange – fn({ lat, lng })     — called on map click
 *   height   – CSS string (default "300px")
 */
export default function LocationPickerMap({
  value,
  onChange,
  height = "300px",
}) {
  const center = value
    ? [value.lat, value.lng]
    : [20.5937, 78.9629]; // Default: centre of India

  return (
    <div
      className="rounded-xl overflow-hidden border border-slate-200 shadow-sm"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={value ? 14 : 5}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ClickHandler onPick={onChange} />
        <FlyToMarker value={value} />
        {value && (
          <Marker position={[value.lat, value.lng]} icon={pinIcon} />
        )}
      </MapContainer>
    </div>
  );
}
