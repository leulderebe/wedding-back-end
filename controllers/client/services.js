const asyncHandler = require("express-async-handler");
const prisma = require("../../prisma/client");

// Browse Services
const browseServices = asyncHandler(async (req, res) => {
  // Extract query parameters for filtering, sorting, and pagination
  const {
    categoryId,
    search,
    sortBy = "price", // Default to price
    sortOrder = "asc", // Default to ascending
    page = 1,
    limit = 10,
  } = req.query;

  // Validate sort parameters
  const validSortFields = ["price", "name", "createdAt"];
  const validSortOrders = ["asc", "desc"];
  if (!validSortFields.includes(sortBy)) {
    res.status(400);
    throw new Error("Invalid sortBy field. Must be price, name, or createdAt");
  }
  if (!validSortOrders.includes(sortOrder)) {
    res.status(400);
    throw new Error("Invalid sortOrder. Must be asc or desc");
  }

  // Convert page and limit to integers
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (pageNum < 1 || limitNum < 1) {
    res.status(400);
    throw new Error("Page and limit must be positive integers");
  }

  // Build where clause for filtering
  const where = {
    vendor: { status: "APPROVED" }, // Only show services from approved vendors
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.name = { contains: search, mode: "insensitive" }; // Case-insensitive search
  }

  // Fetch services with pagination
  const services = await prisma.service.findMany({
    where,
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          rating: true,
          userId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      category: true, // Include category information
    },
    orderBy: { [sortBy]: sortOrder },
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  });

  // Get total count for pagination metadata
  const totalServices = await prisma.service.count({ where });

  // Format response
  const formattedServices = services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    image: service.image,
    categoryId: service.categoryId,
    categoryName: service.category?.name,
    createdAt: service.createdAt,
    vendor: {
      id: service.vendor.id,
      userId: service.vendor.userId,
      businessName: service.vendor.businessName,
      rating: service.vendor.rating,
      ownerName: `${service.vendor.user.firstName} ${service.vendor.user.lastName}`,
    },
  }));

  res.status(200).json({
    message: "Services retrieved successfully",
    services: formattedServices,
    pagination: {
      total: totalServices,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalServices / limitNum),
    },
  });
});

// Get service by ID
const getServiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          rating: true,
          userId: true,
          description: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      category: true,
    },
  });

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  // Check if vendor is approved
  if (service.vendor.status !== "APPROVED") {
    res.status(403);
    throw new Error("This service is not available");
  }

  // Format response
  const formattedService = {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    image: service.image,
    categoryId: service.categoryId,
    categoryName: service.category?.name,
    createdAt: service.createdAt,
    vendor: {
      id: service.vendor.id,
      userId: service.vendor.userId,
      businessName: service.vendor.businessName,
      description: service.vendor.description,
      rating: service.vendor.rating,
      ownerName: `${service.vendor.user.firstName} ${service.vendor.user.lastName}`,
      contactEmail: service.vendor.user.email,
      contactPhone: service.vendor.user.phone,
    },
  };

  res.status(200).json({
    message: "Service retrieved successfully",
    service: formattedService,
  });
});

module.exports = { browseServices, getServiceById };
