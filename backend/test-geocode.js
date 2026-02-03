require("dotenv").config();
const geocodeLocation = require("./src/utils/geocode");

(async () => {
  const result = await geocodeLocation("Pune");
  console.log(result);
})();
