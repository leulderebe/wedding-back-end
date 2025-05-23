const express = require("express");
const router = express.Router();
const {
  getVendorsByCategory,
  getVendorById,
} = require("../../controllers/client/vendors");

// Get vendors by category (public)
router.get("/category/:categoryName", getVendorsByCategory);

// Get vendor by ID (public)
router.get("/:id", getVendorById);

module.exports = router;
