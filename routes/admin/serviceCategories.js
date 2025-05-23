const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  getServiceCategories,
  getServiceCategoryById,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
} = require("../../controllers/admin/serviceCategories");
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

// Middleware to ensure only ADMIN can access these routes
router.use(checkRole("ADMIN"));

// Get all service categories
router.get("/", getServiceCategories);

// Get service category by ID
router.get("/:id", getServiceCategoryById);

// Create new service category with image upload
router.post("/", upload.single("image"), createServiceCategory);

// Update service category with optional image upload
router.patch("/:id", upload.single("image"), updateServiceCategory);

// Delete service category
router.delete("/:id", deleteServiceCategory);

module.exports = router;
