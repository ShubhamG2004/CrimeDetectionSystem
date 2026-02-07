"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { getIncidentIcon } from "@/lib/leafletIcons";

// Auto-fit map to all incidents with animation
function FitBounds({ incidents }) {
  const map = useMap();

  useEffect(() => {
    if (!incidents.length) return;

    const bounds = L.latLngBounds(
      incidents.map((i) => [
        i.location.lat,
        i.location.lng,
      ])
    );

    // Add padding to bounds
    map.fitBounds(bounds, { 
      padding: [50, 50],
      animate: true,
      duration: 1
    });
  }, [incidents, map]);

  return null;
}

// Map controls component
function MapControls() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom());
    map.on('zoom', updateZoom);
    return () => {
      map.off('zoom', updateZoom);
    };
  }, [map]);

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar bg-white p-2 rounded-lg shadow-md">
        <div className="text-sm font-medium text-gray-700">
          Zoom: {zoom}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => map.zoomIn()}
            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            +
          </button>
          <button
            onClick={() => map.zoomOut()}
            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            -
          </button>
          <button
            onClick={() => map.locate({setView: true, maxZoom: 16})}
            className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            title="Locate Me"
          >
            📍
          </button>
        </div>
      </div>
    </div>
  );
}

// Heatmap-like circles for threat levels
function ThreatCircles({ incidents }) {
  const map = useMap();
  
  return (
    <>
      {incidents.map((incident) => {
        const threatScore = incident.threat_score || 50;
        const radius = threatScore * 2; // Scale radius based on threat score
        
        let color = '#10B981'; // green for low
        if (threatScore > 70) color = '#EF4444'; // red for high
        else if (threatScore > 40) color = '#F59E0B'; // yellow for medium
        
        return (
          <Circle
            key={`circle-${incident.id}`}
            center={[incident.location.lat, incident.location.lng]}
            radius={radius}
            pathOptions={{
              fillColor: color,
              color: color,
              weight: 1,
              opacity: 0.3,
              fillOpacity: 0.1,
            }}
          >
            <Tooltip permanent={false} direction="top">
              <div className="font-medium">{incident.crime_type}</div>
              <div>Threat Score: {threatScore}</div>
            </Tooltip>
          </Circle>
        );
      })}
    </>
  );
}

// Cluster groups for better performance with many markers
function IncidentMarkers({ incidents, showCircles }) {
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Group incidents by proximity for clustering
  const groupedIncidents = useMemo(() => {
    if (incidents.length < 10) return incidents.map(inc => ({...inc, cluster: false}));
    
    const clusters = [];
    const processed = new Set();
    
    incidents.forEach((incident, i) => {
      if (processed.has(i)) return;
      
      const nearby = [incident];
      processed.add(i);
      
      // Find nearby incidents (within 0.01 degrees ~ 1km)
      incidents.forEach((other, j) => {
        if (i === j || processed.has(j)) return;
        
        const latDiff = Math.abs(incident.location.lat - other.location.lat);
        const lngDiff = Math.abs(incident.location.lng - other.location.lng);
        
        if (latDiff < 0.01 && lngDiff < 0.01) {
          nearby.push(other);
          processed.add(j);
        }
      });
      
      if (nearby.length > 3) {
        // Create a cluster marker
        const avgLat = nearby.reduce((sum, inc) => sum + inc.location.lat, 0) / nearby.length;
        const avgLng = nearby.reduce((sum, inc) => sum + inc.location.lng, 0) / nearby.length;
        
        clusters.push({
          id: `cluster-${i}`,
          location: { lat: avgLat, lng: avgLng },
          cluster: true,
          count: nearby.length,
          incidents: nearby,
          threat_level: nearby.reduce((highest, inc) => {
            const levels = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
            const currentLevel = levels[inc.threat_level?.toUpperCase()] || 0;
            const highestLevel = levels[highest] || 0;
            return currentLevel > highestLevel ? inc.threat_level : highest;
          }, 'LOW'),
        });
      } else {
        nearby.forEach(inc => clusters.push({...inc, cluster: false}));
      }
    });
    
    return clusters;
  }, [incidents]);

  const clusterIcon = (count) => L.divIcon({
    html: `<div class="bg-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold border-2 border-white">${count}</div>`,
    className: 'custom-div-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <>
      {groupedIncidents.map((item) => {
        if (item.cluster) {
          return (
            <Marker
              key={item.id}
              position={[item.location.lat, item.location.lng]}
              icon={clusterIcon(item.count)}
              eventHandlers={{
                click: () => setSelectedIncident(item),
              }}
            >
              <Popup>
                <div className="space-y-2">
                  <strong className="text-lg">Cluster of {item.count} incidents</strong>
                  <div>Highest Threat: <span className="font-semibold">{item.threat_level}</span></div>
                  <div className="max-h-40 overflow-y-auto">
                    {item.incidents.slice(0, 5).map((inc, idx) => (
                      <div key={idx} className="py-1 border-b last:border-b-0">
                        <div className="font-medium">{inc.crime_type}</div>
                        <div className="text-sm text-gray-600">{inc.location.name}</div>
                      </div>
                    ))}
                    {item.incidents.length > 5 && (
                      <div className="text-sm text-gray-500">+ {item.incidents.length - 5} more</div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        }
        
        return (
          <Marker
            key={item.id}
            position={[item.location.lat, item.location.lng]}
            icon={getIncidentIcon(item)}
            eventHandlers={{
              mouseover: () => setSelectedIncident(item),
              mouseout: () => setSelectedIncident(null),
            }}
          >
            <Popup>
              <div className="space-y-2 min-w-[200px]">
                <div className="flex justify-between items-start">
                  <strong className="text-lg">{item.crime_type}</strong>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    item.threat_level?.toUpperCase() === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    item.threat_level?.toUpperCase() === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    item.threat_level?.toUpperCase() === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {item.threat_level || 'UNKNOWN'}
                  </span>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">📍</span>
                    <span>{item.location.name || 'Unknown location'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">⚠️</span>
                    <span>Threat Score: <strong>{item.threat_score || 'N/A'}/100</strong></span>
                  </div>
                  
                  {item.timestamp && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">🕒</span>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                  )}
                  
                  {item.description && (
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  )}
                  
                  {item.status && (
                    <div className="mt-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        item.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      
      {showCircles && <ThreatCircles incidents={incidents} />}
    </>
  );
}

export default function EnhancedLeafletMap({ incidents }) {
  const [showThreatCircles, setShowThreatCircles] = useState(false);
  const [mapType, setMapType] = useState('street');

  const tileLayers = {
    street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    topographic: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  };

  const initialCenter = useMemo(() => {
    if (incidents.length === 0) return [0, 0];
    return [incidents[0].location.lat, incidents[0].location.lng];
  }, [incidents]);

  return (
    <div className="relative">
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white rounded-lg shadow-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showThreatCircles}
              onChange={(e) => setShowThreatCircles(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm font-medium">Show Threat Radius</span>
          </label>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-3">
          <div className="text-sm font-medium mb-2">Map Style</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(tileLayers).map(([key, url]) => (
              <button
                key={key}
                onClick={() => setMapType(key)}
                className={`px-3 py-1 rounded text-sm capitalize ${
                  mapType === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>

      <MapContainer
        center={initialCenter}
        zoom={13}
        className="h-[520px] w-full rounded-xl shadow-lg"
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          url={tileLayers[mapType]}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <FitBounds incidents={incidents} />
        <MapControls />
        <IncidentMarkers 
          incidents={incidents} 
          showCircles={showThreatCircles}
        />
      </MapContainer>
      
      <div className="mt-4 text-sm text-gray-500">
        Displaying {incidents.length} incident{incidents.length !== 1 ? 's' : ''} on the map
      </div>
    </div>
  );
}