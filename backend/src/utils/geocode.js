const axios = require("axios");

/**
 * Convert location name to latitude & longitude
 * @param {string} locationName
 * @returns { name, lat, lng }
 */
async function geocodeLocation(locationName) {
  if (!locationName) {
    throw new Error("Location name is required");
  }

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    {
      params: {
        address: locationName,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
      timeout: 10000,
    }
  );

  if (
    response.data.status !== "OK" ||
    !response.data.results.length
  ) {
    throw new Error("Invalid or unknown location");
  }

  const loc =
    response.data.results[0].geometry.location;

  return {
    name: locationName,
    lat: loc.lat,
    lng: loc.lng,
  };
}

module.exports = geocodeLocation;
