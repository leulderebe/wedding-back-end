const asyncHandler = require("express-async-handler");
const prisma = require("../../prisma/client");

// Get all service categories
const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.serviceCategory.findMany({
    include: {
      _count: {
        select: { services: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  res.status(200).json({
    success: true,
    data: categories,
  });
});

// Get category by ID with its services
const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await prisma.serviceCategory.findUnique({
    where: { id },
    include: {
      services: {
        where: {
          vendor: {
            status: "APPROVED", // Only include services from approved vendors
          },
        },
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
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Format the response
  const formattedCategory = {
    id: category.id,
    name: category.name,
    description: category.description,
    image: category.image,
    services: category.services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      image: service.image,
      createdAt: service.createdAt,
      vendor: {
        id: service.vendor.id,
        userId: service.vendor.userId,
        businessName: service.vendor.businessName,
        rating: service.vendor.rating,
        ownerName: `${service.vendor.user.firstName} ${service.vendor.user.lastName}`,
      },
    })),
  };

  res.status(200).json({
    success: true,
    data: formattedCategory,
  });
});

module.exports = {
  getAllCategories,
  getCategoryById,
};
