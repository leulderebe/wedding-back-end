const asyncHandler = require("express-async-handler");
const prisma = require("../../prisma/client");

// Get vendors by category
const getVendorsByCategory = asyncHandler(async (req, res) => {
  const { categoryName } = req.params;

  // Find the category by name
  // Using a simple equality check which should work in all Prisma versions
  const category = await prisma.serviceCategory.findFirst({
    where: {
      name: categoryName,
    },
  });

  if (!category) {
    res.status(404);
    throw new Error(`Category '${categoryName}' not found`);
  }

  // Find vendors that offer services in this category
  const vendors = await prisma.vendor.findMany({
    where: {
      status: "APPROVED", // Only approved vendors
      services: {
        some: {
          categoryId: category.id,
        },
      },
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      services: {
        where: {
          categoryId: category.id,
        },
        take: 3, // Limit to 3 services per vendor for preview
      },
      _count: {
        select: {
          services: true,
        },
      },
    },
    orderBy: {
      rating: "desc", // Order by rating
    },
  });

  // Format the response
  const formattedVendors = vendors.map((vendor) => ({
    id: vendor.id,
    businessName: vendor.businessName,
    rating: vendor.rating,
    serviceType: vendor.serviceType,
    ownerName: `${vendor.user.firstName} ${vendor.user.lastName}`,
    email: vendor.user.email,
    phone: vendor.user.phone,
    serviceCount: vendor._count.services,
    services: vendor.services.map((service) => {
      // Parse features if it's a string
      let features = [];
      if (service.features) {
        if (typeof service.features === "string") {
          try {
            features = JSON.parse(service.features);
          } catch (e) {
            console.error("Error parsing features:", e);
            features = [];
          }
        } else if (Array.isArray(service.features)) {
          features = service.features;
        }
      }

      return {
        id: service.id,
        name: service.name,
        price: service.price,
        packageType: service.packageType || "Standard",
        features: features,
      };
    }),
  }));

  res.status(200).json({
    success: true,
    category: {
      id: category.id,
      name: category.name,
      description: category.description,
      image: category.image,
    },
    vendors: formattedVendors,
  });
});

// Get vendor by ID
const getVendorById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vendor = await prisma.vendor.findUnique({
    where: {
      id,
      status: "APPROVED", // Only approved vendors
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      services: {
        include: {
          category: true,
        },
        orderBy: {
          price: "asc",
        },
      },
      // Note: reviews relation is not defined in the Prisma schema
      // If you need reviews, you'll need to fetch them separately
    },
  });

  if (!vendor) {
    res.status(404);
    throw new Error("Vendor not found or not approved");
  }

  // Group services by category
  const servicesByCategory = {};
  vendor.services.forEach((service) => {
    const categoryName = service.category?.name || "Other";
    if (!servicesByCategory[categoryName]) {
      servicesByCategory[categoryName] = [];
    }
    // Parse features if it's a string
    let features = [];
    if (service.features) {
      if (typeof service.features === "string") {
        try {
          features = JSON.parse(service.features);
        } catch (e) {
          console.error("Error parsing features:", e);
          // Fallback to generated features if parsing fails
          features = generateServiceFeatures(
            service.name,
            service.category?.name
          );
        }
      } else if (Array.isArray(service.features)) {
        features = service.features;
      }
    } else {
      // Fallback to generated features if none exist
      features = generateServiceFeatures(service.name, service.category?.name);
    }

    servicesByCategory[categoryName].push({
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price,
      image:
        service.image ||
        `/image/service-${
          service.category?.name?.toLowerCase() || "default"
        }.jpg`,
      packageType: service.packageType || "Standard",
      features: features,
      timeline: generateServiceTimeline(service.price),
      pricing: `Starting at ETB ${service.price.toLocaleString()}`,
    });
  });

  // Format the response
  const formattedVendor = {
    id: vendor.id,
    businessName: vendor.businessName,
    description: vendor.description,
    rating: vendor.rating,
    serviceType: vendor.serviceType,
    ownerName: `${vendor.user.firstName} ${vendor.user.lastName}`,
    contactEmail: vendor.user.email,
    contactPhone: vendor.user.phone,
    servicesByCategory,
    // Reviews are not included since the relation is not defined in the schema
    reviews: [], // Empty array to maintain API compatibility
  };

  res.status(200).json({
    success: true,
    vendor: formattedVendor,
  });
});

// Helper function to generate service features based on service name and category
const generateServiceFeatures = (serviceName, category) => {
  // Base features for different service types
  const baseFeatures = {
    "Wedding Planning": [
      "Initial consultation and vision planning",
      "Venue selection and booking assistance",
      "Vendor recommendations and coordination",
      "Budget creation and management",
      "Timeline development and scheduling",
      "Guest list management",
      "RSVP tracking",
      "Day-of coordination and execution",
      "Post-wedding wrap-up services",
    ],
    "Floral Design": [
      "Initial consultation and design concept",
      "Custom bouquets and boutonnieres",
      "Ceremony floral arrangements",
      "Reception centerpieces and table décor",
      "Cake flowers and special accent pieces",
      "Delivery and setup on wedding day",
      "Post-event cleanup and removal",
    ],
    Photography: [
      "Engagement photo session",
      "Full-day wedding coverage",
      "Second shooter for comprehensive coverage",
      "Professional editing and color correction",
      "Online gallery of high-resolution images",
      "Custom wedding album design",
      "Highlight video (3-5 minutes)",
      "Full ceremony and reception video",
    ],
    Catering: [
      "Menu consultation and tasting",
      "Customized menu planning",
      "Dietary accommodation options",
      "Professional service staff",
      "Complete setup and cleanup",
      "Bar service and signature cocktails",
      "Custom cake design consultation",
      "Dessert table options",
    ],
    Venue: [
      "Venue assessment and design planning",
      "Custom decoration packages",
      "Lighting design and installation",
      "Drapery and backdrop setups",
      "Table and chair decoration",
      "Entrance and aisle decoration",
      "Setup and teardown services",
      "Coordination with other vendors",
    ],
    Music: [
      "Professional sound equipment",
      "Customized playlist creation",
      "Live performance options",
      "MC services for announcements",
      "Lighting effects coordination",
      "Early setup and sound check",
      "Backup equipment available",
      "Experienced professionals",
    ],
  };

  // Find the closest matching service type
  let serviceType =
    Object.keys(baseFeatures).find(
      (type) =>
        serviceName.includes(type) || (category && category.includes(type))
    ) || "Wedding Planning";

  // Get base features for this service type
  return [...baseFeatures[serviceType]];
};

// Helper function to generate service timeline based on price
const generateServiceTimeline = (price) => {
  if (price < 5000) {
    return "3-6 months before wedding date";
  } else if (price < 10000) {
    return "6-9 months before wedding date";
  } else if (price < 20000) {
    return "9-12 months before wedding date";
  } else {
    return "12-18 months before wedding date";
  }
};

module.exports = {
  getVendorsByCategory,
  getVendorById,
};
