const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  addService,
  deleteService,
  updateService,
  getVendorServices,
} = require("../../controllers/vendor/services");
const { checkRole } = require("../../middleware/authMiddleware");

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Middleware to ensure only VENDOR can access these routes
router.use(checkRole(["VENDOR"]));

// Add a new service listing with image upload
router.post("/", upload.single("image"), addService);

// Delete an existing service listing
router.delete("/:serviceId", deleteService);

// Update an existing service listing with optional image upload
router.patch("/:serviceId", upload.single("image"), updateService);

// Get all services for a vendor
router.get("/", getVendorServices);

module.exports = router;
