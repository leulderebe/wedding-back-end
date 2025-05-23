const asyncHandler = require("express-async-handler");
const prisma = require("../../prisma/client");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Helper function to handle image upload
const saveImage = (imageFile) => {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, "../../public/uploads/categories");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Generate unique filename
  const fileExtension = path.extname(imageFile.originalname);
  const fileName = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(uploadsDir, fileName);

  // Save file
  fs.writeFileSync(filePath, imageFile.buffer);

  // Return the relative path to be stored in the database
  return `/uploads/categories/${fileName}`;
};

// Get all service categories
const getServiceCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.serviceCategory.findMany({
    include: {
      _count: {
        select: { services: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.status(200).json({
    success: true,
    data: categories,
  });
});

// Get service category by ID
const getServiceCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await prisma.serviceCategory.findUnique({
    where: { id },
    include: {
      services: true,
      _count: {
        select: { services: true },
      },
    },
  });

  if (!category) {
    res.status(404);
    throw new Error("Service category not found");
  }

  res.status(200).json({
    success: true,
    data: category,
  });
});

// Create a new service category
const createServiceCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  let imagePath = null;

  // Validate required fields
  if (!name) {
    res.status(400);
    throw new Error("Category name is required");
  }

  // Handle image upload if provided
  if (req.file) {
    imagePath = saveImage(req.file);
  }

  // Create the category
  const category = await prisma.serviceCategory.create({
    data: {
      name,
      description: description || "",
      image: imagePath,
    },
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

// Update a service category
const updateServiceCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  let updateData = {};

  // Check if category exists
  const existingCategory = await prisma.serviceCategory.findUnique({
    where: { id },
  });

  if (!existingCategory) {
    res.status(404);
    throw new Error("Service category not found");
  }

  // Prepare update data
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;

  // Handle image upload if provided
  if (req.file) {
    // Delete old image if exists
    if (existingCategory.image) {
      const oldImagePath = path.join(
        __dirname,
        "../../public",
        existingCategory.image
      );
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Save new image
    updateData.image = saveImage(req.file);
  }

  // Update the category
  const updatedCategory = await prisma.serviceCategory.update({
    where: { id },
    data: updateData,
  });

  res.status(200).json({
    success: true,
    data: updatedCategory,
  });
});

// Delete a service category
const deleteServiceCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if category exists
  const existingCategory = await prisma.serviceCategory.findUnique({
    where: { id },
    include: {
      services: true,
    },
  });

  if (!existingCategory) {
    res.status(404);
    throw new Error("Service category not found");
  }

  // Check if category has services
  if (existingCategory.services.length > 0) {
    res.status(400);
    throw new Error(
      "Cannot delete category with associated services. Please reassign or delete the services first."
    );
  }

  // Delete image if exists
  if (existingCategory.image) {
    const imagePath = path.join(
      __dirname,
      "../../public",
      existingCategory.image
    );
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  // Delete the category
  await prisma.serviceCategory.delete({
    where: { id },
  });

  res.status(200).json({
    success: true,
    message: "Service category deleted successfully",
  });
});

module.exports = {
  getServiceCategories,
  getServiceCategoryById,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
};
