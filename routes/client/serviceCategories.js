const express = require("express");
const router = express.Router();
const {
  getAllCategories,
  getCategoryById,
} = require("../../controllers/client/serviceCategories");

// These routes are public and don't require authentication
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

module.exports = router;
