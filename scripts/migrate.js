const { execSync } = require("child_process");
const path = require("path");

console.log("Running database migrations...");

try {
  // Run Prisma migrations
  execSync("npx prisma migrate dev --name add_service_categories", {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });

  console.log("Migrations completed successfully!");

  // Run Prisma seed
  console.log("Running database seed...");
  execSync("node prisma/seed.js", {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });

  console.log("Database setup completed successfully!");
} catch (error) {
  console.error("Error setting up database:", error.message);
  process.exit(1);
}
