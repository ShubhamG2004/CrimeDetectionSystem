const axios = require("axios");

/**
 * Convert human-readable location name to latitude & longitude
 * Uses Google Geocoding API
 *
 * @param {string} locationName
 * @returns {{
 *   name: string,
 *   lat: number | null,
 *   lng: number | null
 * }}
 */
async function geocodeLocation(locationName) {
  try {
    if (!locationName || locationName.trim() === "") {
      return {
        name: "Unknown Location",
        lat: null,
        lng: null,
      };
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: locationName,
          key: process.env.GOOGLE_MAPS_API_KEY, // 🔐 backend key
        },
        timeout: 10000,
      }
    );

    if (
      response.data.status !== "OK" ||
      !response.data.results.length
    ) {
      return {
        name: locationName,
        lat: null,
        lng: null,
      };
    }

    const loc =
      response.data.results[0].geometry.location;

    return {
      name: locationName,
      lat: loc.lat,
      lng: loc.lng,
    };
  } catch (error) {
    console.error("🌍 Geocoding failed:", error.message);

    // Fail-safe return (VERY IMPORTANT)
    return {
      name: locationName || "Unknown Location",
      lat: null,
      lng: null,
    };
  }
}

module.exports = geocodeLocation;
