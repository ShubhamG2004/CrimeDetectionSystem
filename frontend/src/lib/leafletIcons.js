import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default icons in Leaflet with Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
  iconUrl: '/leaflet/images/marker-icon.png',
  shadowUrl: '/leaflet/images/marker-shadow.png',
});

// Custom threat level icons with better design
export const threatIcons = {
  LOW: L.divIcon({
    html: '<div class="incident-marker incident-marker--low"><span>1</span></div>',
    className: 'custom-div-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  }),
  MEDIUM: L.divIcon({
    html: '<div class="incident-marker incident-marker--medium"><span>1</span></div>',
    className: 'custom-div-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  }),
  HIGH: L.divIcon({
    html: '<div class="incident-marker incident-marker--high"><span>1</span></div>',
    className: 'custom-div-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  }),
  CRITICAL: L.divIcon({
    html: '<div class="incident-marker incident-marker--critical"><span>1</span></div>',
    className: 'custom-div-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  }),
};

// Crime type icons mapping
export const crimeTypeIcons = {
  default: L.divIcon({
    html: '<div class="incident-marker incident-marker--medium"><span>1</span></div>',
    className: 'custom-div-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  }),
};

// Get appropriate icon based on incident data
export const getIncidentIcon = (incident) => {
  if (incident.threat_level) {
    const level = incident.threat_level.toUpperCase();
    return threatIcons[level] || threatIcons.LOW;
  }
  
  if (incident.crime_type) {
    const type = incident.crime_type.toLowerCase();
    return crimeTypeIcons[type] || crimeTypeIcons.default;
  }
  
  return crimeTypeIcons.default;
};