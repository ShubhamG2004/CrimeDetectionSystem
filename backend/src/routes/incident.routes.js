const express = require("express");
const router = express.Router();
const { createIncident } = require("../controllers/incident.controller");

router.post("/create", createIncident);

module.exports = router;
