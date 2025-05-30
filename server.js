const cors = require("cors");
const express = require("express");
const dotenv = require("dotenv");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { errorHandler } = require("./middleware/errorMiddleware");
const { authMiddlewareSocket } = require("./middleware/authMiddleware");
const prisma = require("./prisma/client");
const fs = require("fs");
const path = require("path");

dotenv.config();

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, "uploads");
const categoriesDir = path.join(uploadsDir, "categories");

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log("Created uploads directory");
}

if (!fs.existsSync(categoriesDir)) {
  fs.mkdirSync(categoriesDir);
  console.log("Created uploads/categories directory");
}

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5000;

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration for Express
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://weddingplanning-1-joi4.onrender.com",
    "https://wedding-front-end-x3cf.onrender.com", // Added new frontend URL
    "http://localhost:8000",
  ], // Ensure this matches your frontend URL
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use("/public", express.static("public"));
app.use("/uploads", express.static("uploads")); // Serve files from the uploads directory

// Set up Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://weddingplanning-1-joi4.onrender.com",
      "https://wedding-front-end-x3cf.onrender.com", // Added new frontend URL
      "http://localhost:8000",
    ],
    methods: ["GET", "POST"],
  },
});

// Apply WebSocket authentication middleware
io.use(authMiddlewareSocket);

// Socket.IO logic for real-time chat
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.id}`);

  // Mark user as online
  prisma.user.update({
    where: { id: socket.user.id },
    data: { isOnline: true },
  });

  // Join a conversation room
  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.user.id} joined conversation ${conversationId}`);
  });

  // Handle sending a message
  socket.on("sendMessage", async ({ conversationId, content, toUserId }) => {
    try {
      const message = await prisma.message.create({
        data: {
          content,
          fromUserId: socket.user.id,
          toUserId,
          conversationId,
        },
        include: { fromUser: true, toUser: true },
      });

      // Emit the message to the conversation room
      io.to(conversationId).emit("receiveMessage", message);
    } catch (error) {
      console.error("Error sending message:", error.message);
    }
  });

  // Mark message as read
  socket.on("markAsRead", async ({ messageId }) => {
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { read: true, lastSeen: new Date() },
      });
    } catch (error) {
      console.error("Error marking message as read:", error.message);
    }
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    try {
      await prisma.user.update({
        where: { id: socket.user.id },
        data: { isOnline: false },
      });
      console.log(`User disconnected: ${socket.user.id}`);
    } catch (error) {
      console.error("Error handling disconnection:", error.message);
    }
  });
});

// Auth Routes
app.use("/api/auth", require("./routes/shared/authRoutes"));

// For debugging purposes, log all requests
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// User Routes (common for all user types)
app.use("/api/user", require("./routes/shared/userRoutes"));

// Vendor Routes
app.use("/api/vendor/account", require("./routes/vendor/account"));
app.use("/api/vendor", require("./routes/vendor/conversation"));
app.use("/api/vendor/dashboard", require("./routes/vendor/dashboard"));
app.use("/api/vendor/payment", require("./routes/vendor/payment"));
app.use("/api/vendor/services", require("./routes/vendor/services"));
app.use("/api/vendor/bookings", require("./routes/vendor/bookings"));

// Admin Routes
app.use("/api/admin/clients", require("./routes/admin/client"));
app.use("/api/admin/dashboard", require("./routes/admin/dashboard"));
app.use("/api/admin/event-planners", require("./routes/admin/eventPlanners"));
app.use("/api/admin/feedback", require("./routes/admin/feedback"));
app.use("/api/admin/vendors", require("./routes/admin/vendors"));
app.use("/api/admin/payments", require("./routes/admin/payment"));
app.use(
  "/api/admin/service-categories",
  require("./routes/admin/serviceCategories")
);

// Event Planner Routes
app.use(
  "/api/eventplanner/dashboard",
  require("./routes/eventplanner/dashboard")
);
app.use("/api/eventplanner/vendors", require("./routes/eventplanner/vendors"));
app.use("/api/eventplanner/clients", require("./routes/eventplanner/clients"));
app.use(
  "/api/eventplanner/feedback",
  require("./routes/eventplanner/feedback")
);
app.use("/api/eventplanner/payments", require("./routes/eventplanner/payment"));
app.use("/api/eventplanner/account", require("./routes/eventplanner/account"));

// Client Routes
app.use("/api/client/bookings", require("./routes/client/booking"));
app.use("/api/client/feedback", require("./routes/client/feedback"));
app.use("/api/client/services", require("./routes/client/services"));
app.use(
  "/api/client/service-categories",
  require("./routes/client/serviceCategories")
);
app.use("/api/client/vendors", require("./routes/client/vendors"));
app.use("/api/client", require("./routes/client/conversation"));
app.use("/api/client/payment", require("./routes/client/payment"));
app.use("/api/client/account", require("./routes/client/account"));
app.use("/api/client/dashboard", require("./routes/client/dashboard"));

const { createAdminSubaccount } = require("./utils/chapa");

// After connecting to database
createAdminSubaccount().then(() => {
  console.log("Admin subaccount verified");
});

app.get("/", (_req, res) => {
  res.send("Api Up and Running!");
});

// Handle 404 errors with a custom message
app.use((req, res, _next) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      "/api/auth/*",
      "/api/user/*",
      "/api/vendor/*",
      "/api/admin/*",
      "/api/eventplanner/*",
      "/api/client/*",
      "/uploads/*",
      "/public/*",
    ],
  });
});

app.use(errorHandler);

// Start the server
httpServer.listen(port, () => console.log(`Server started on port ${port}`));
