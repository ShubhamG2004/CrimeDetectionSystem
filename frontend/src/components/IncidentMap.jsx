"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
});

export default function IncidentMap({ incidents }) {
  if (!incidents) {
    return <p className="text-center">⏳ Loading incidents…</p>;
  }

  if (!Array.isArray(incidents) || incidents.length === 0) {
    return <p className="text-center">📭 No incidents found</p>;
  }

  const validIncidents = incidents
    .filter(
      (i) =>
        i.location?.lat != null &&
        i.location?.lng != null
    )
    .map((i) => ({
      ...i,
      location: {
        ...i.location,
        lat: Number(i.location.lat),
        lng: Number(i.location.lng),
      },
    }));

  if (validIncidents.length === 0) {
    return (
      <p className="text-center text-red-600">
        ❌ No incident location data available
      </p>
    );
  }

  return <LeafletMap incidents={validIncidents} />;
}
