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
    html: '<div class="bg-green-600 border-2 border-white rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs">L</div>',
    className: 'custom-div-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  }),
  MEDIUM: L.divIcon({
    html: '<div class="bg-yellow-600 border-2 border-white rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-xs">M</div>',
    className: 'custom-div-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  HIGH: L.divIcon({
    html: '<div class="bg-orange-600 border-2 border-white rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-sm">H</div>',
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  CRITICAL: L.divIcon({
    html: '<div class="bg-red-600 border-2 border-white rounded-full w-12 h-12 flex items-center justify-center text-white font-bold text-sm">C</div>',
    className: 'custom-div-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }),
};

// Crime type icons mapping
export const crimeTypeIcons = {
  theft: L.divIcon({
    html: '👜',
    className: 'text-2xl bg-white bg-opacity-75 rounded-full p-1',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  }),
  assault: L.divIcon({
    html: '👊',
    className: 'text-2xl bg-white bg-opacity-75 rounded-full p-1',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  }),
  burglary: L.divIcon({
    html: '🏠',
    className: 'text-2xl bg-white bg-opacity-75 rounded-full p-1',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  }),
  vandalism: L.divIcon({
    html: '🎨',
    className: 'text-2xl bg-white bg-opacity-75 rounded-full p-1',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  }),
  traffic: L.divIcon({
    html: '🚗',
    className: 'text-2xl bg-white bg-opacity-75 rounded-full p-1',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  }),
  default: L.divIcon({
    html: '📍',
    className: 'text-2xl bg-white bg-opacity-75 rounded-full p-1',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
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