const express = require("express");
const router = express.Router();
const {
  browseServices,
  getServiceById,
} = require("../../controllers/client/services");

// Browse all services (public)
router.get("/", browseServices);

// Get service by ID (public)
router.get("/:id", getServiceById);

module.exports = router;
