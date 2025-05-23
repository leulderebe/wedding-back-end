const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create admin user if it doesn't exist
  const adminEmail = 'admin@weddingplanner.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        phone: '+1234567890',
      }
    });
    console.log('Admin user created successfully!');
  } else {
    console.log('Admin user already exists, skipping creation.');
  }

  // Create service categories if they don't exist
  const defaultCategories = [
    {
      name: 'Venue',
      description: 'Wedding venues including hotels, gardens, and banquet halls',
      image: null
    },
    {
      name: 'Catering',
      description: 'Food and beverage services for your wedding',
      image: null
    },
    {
      name: 'Photography',
      description: 'Professional photography services to capture your special day',
      image: null
    },
    {
      name: 'Videography',
      description: 'Professional video services to document your wedding',
      image: null
    },
    {
      name: 'Decoration',
      description: 'Wedding decoration services including flowers and themes',
      image: null
    },
    {
      name: 'Music',
      description: 'Live bands, DJs, and other music services',
      image: null
    },
    {
      name: 'Transportation',
      description: 'Luxury cars, limousines, and other transportation services',
      image: null
    },
    {
      name: 'Attire',
      description: 'Wedding dresses, suits, and accessories',
      image: null
    }
  ];

  console.log('Creating service categories...');
  for (const category of defaultCategories) {
    const existingCategory = await prisma.serviceCategory.findFirst({
      where: { name: category.name }
    });

    if (!existingCategory) {
      await prisma.serviceCategory.create({
        data: category
      });
      console.log(`Created category: ${category.name}`);
    } else {
      console.log(`Category ${category.name} already exists, skipping.`);
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
