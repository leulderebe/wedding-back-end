const asyncHandler = require("express-async-handler");
const prisma = require("../../prisma/client");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Helper function to handle image upload
const saveImage = (imageFile) => {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, "../../public/uploads/services");
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
  return `/uploads/services/${fileName}`;
};

// Add a new service listing for the vendor
const addService = asyncHandler(async (req, res) => {
  // Fetch the vendor record using the user ID from the decoded token
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user.id },
  });

  if (!vendor) {
    res.status(404);
    throw new Error("Vendor profile not found");
  }

  const vendorId = vendor.id;

  // Extract service details from the request body
  const { title, description, price } = req.body;
  let imagePath = null;

  // Validate required fields
  if (!title || !price) {
    res.status(400);
    throw new Error("Title, price, and category are required fields");
  }

  // Validate price (must be a positive number)
  if (typeof price !== "number" || price <= 0) {
    res.status(400);
    throw new Error("Price must be a positive number");
  }

  // Check if category exists
  const category = await prisma.vendor.findUnique({
    where: { userId: req.user.id },
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Handle image upload if provided
  if (req.file) {
    imagePath = saveImage(req.file);
  }

  // Extract features and packageType from request body
  const { features, packageType } = req.body;

  // Create the new service
  const newService = await prisma.service.create({
    data: {
      name: title,
      description: description || "",
      price,
      categoryId: category.categoryId,
      image: imagePath,
      features: features ? JSON.stringify(features) : null,
      packageType: packageType || null,
      vendorId,
    },
    include: {
      category: true,
    },
  });

  // Respond with the created service
  res.status(201).json({
    success: true,
    data: {
      serviceId: newService.id,
      title: newService.name,
      description: newService.description,
      price: newService.price,
      categoryId: newService.categoryId,
      categoryName: newService.category?.name,
      image: newService.image,
      createdAt: newService.createdAt,
    },
  });
});

// Delete an existing service listing for the vendor
const deleteService = asyncHandler(async (req, res) => {
  // Fetch the vendor record using the user ID from the decoded token
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user.id },
  });

  if (!vendor) {
    res.status(404);
    throw new Error("Vendor profile not found");
  }

  const vendorId = vendor.id;
  const { serviceId } = req.params;

  // Check if the service exists and belongs to the vendor
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (service.vendorId !== vendorId) {
    res.status(403);
    throw new Error("Not authorized to delete this service");
  }

  // Delete the service
  await prisma.service.delete({
    where: { id: serviceId },
  });

  // Respond with a success message
  res.status(200).json({
    success: true,
    message: "Service listing deleted successfully",
  });
});

// Update an existing service listing for the vendor
const updateService = asyncHandler(async (req, res) => {
  // Fetch the vendor record using the user ID from the decoded token
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user.id },
  });

  if (!vendor) {
    res.status(404);
    throw new Error("Vendor profile not found");
  }

  const vendorId = vendor.id;
  const { serviceId } = req.params;

  // Check if the service exists and belongs to the vendor
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  if (service.vendorId !== vendorId) {
    res.status(403);
    throw new Error("Not authorized to update this service");
  }

  // Extract fields to update from the request body
  const { title, description, price, categoryId, features, packageType } =
    req.body;
  let updateData = {};

  // Validate fields if provided
  if (price && (typeof price !== "number" || price <= 0)) {
    res.status(400);
    throw new Error("Price must be a positive number");
  }

  // Check if category exists if categoryId is provided
  if (categoryId) {
    const category = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      res.status(404);
      throw new Error("Category not found");
    }
    updateData.categoryId = categoryId;
  }

  // Prepare the data to update
  if (title) updateData.name = title;
  if (description !== undefined) updateData.description = description;
  if (price) updateData.price = price;
  if (features !== undefined)
    updateData.features = features ? JSON.stringify(features) : null;
  if (packageType !== undefined) updateData.packageType = packageType;

  // Handle image upload if provided
  if (req.file) {
    // Delete old image if exists
    if (service.image) {
      const oldImagePath = path.join(__dirname, "../../public", service.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Save new image
    updateData.image = saveImage(req.file);
  }

  // Update the service
  const updatedService = await prisma.service.update({
    where: { id: serviceId },
    data: updateData,
    include: {
      category: true,
    },
  });

  // Respond with the updated service
  res.status(200).json({
    success: true,
    data: {
      serviceId: updatedService.id,
      title: updatedService.name,
      description: updatedService.description,
      price: updatedService.price,
      categoryId: updatedService.categoryId,
      categoryName: updatedService.category?.name,
      image: updatedService.image,
      updatedAt: updatedService.updatedAt,
    },
  });
});

const getVendorServices = asyncHandler(async (req, res) => {
  // Fetch the vendor record using the user ID from the decoded token
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user.id },
  });

  if (!vendor) {
    res.status(404);
    throw new Error("Vendor profile not found");
  }

  const vendorId = vendor.id;

  // Get all services for this vendor
  const services = await prisma.service.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" }, // Newest first
    include: {
      vendor: {
        // Include basic vendor info if needed
        select: {
          businessName: true,
          serviceType: true,
        },
      },
      category: true, // Include category information
      bookings: true, // Include bookings
    },
  });

  // Format the response
  const formattedServices = services.map((service) => ({
    serviceId: service.id,
    title: service.name,
    description: service.description,
    price: service.price,
    categoryId: service.categoryId,
    categoryName: service.category?.name,
    image: service.image,
    features: service.features ? JSON.parse(service.features) : [],
    packageType: service.packageType || "",
    vendorInfo: {
      // Include vendor info in response
      businessName: service.vendor.businessName,
      serviceType: service.vendor.serviceType,
    },
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
    // Include bookings if they exist
    bookings: service.bookings || [],
  }));

  res.status(200).json({
    success: true,
    count: services.length,
    data: formattedServices,
  });
});

module.exports = {
  addService,
  deleteService,
  updateService,
  getVendorServices,
};
