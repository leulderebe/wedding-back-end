const asyncHandler = require("express-async-handler");
const prisma = require("../../prisma/client");
const { chapa } = require("../../utils/chapa");
const uuid = require("uuid").v4;
const axios = require("axios"); // Add axios for API calls
const { sendPaymentCompletionToVendor, sendNewBookingToVendor } = require("../../utils/emailService");

// Initiate Payment
const initiatePayment = asyncHandler(async (req, res) => {
  const { amount, vendorId, bookingId } = req.body;
  const userId = req.user.id; // Use authenticated user ID

  // Validate input
  if (!amount || !vendorId || !bookingId || !userId) {
    res.status(400);
    throw new Error("Amount, vendor ID, booking ID, and user ID are required");
  }

  // Verify user and client profile
  const client = await prisma.client.findUnique({ where: { userId } });
  if (!client) {
    res.status(400);
    throw new Error("Client profile not found");
  }

  // Verify booking exists and belongs to the client
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: { include: { vendor: true } } },
  });

  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }

  if (booking.clientId !== client.id) {
    res.status(403);
    throw new Error("Unauthorized: Booking does not belong to this client");
  }

  if (booking.service.vendor.id !== vendorId) {
    res.status(400);
    throw new Error("Vendor ID does not match the booking's vendor");
  }

  // Get vendor and admin subaccounts
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { user: true },
  });

  const adminAccount = await prisma.chapaSubaccount.findFirst({
    where: { type: "ADMIN" },
  });

  if (!vendor?.chapaSubaccountId || !adminAccount) {
    res.status(500);
    throw new Error("Payment accounts not configured");
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      amount,
      status: "PENDING",
      method: "CHAPA",
      userId,
      recipientId: vendor.userId,
      vendorId,
      adminSplit: amount * 0.1,
      vendorSplit: amount * 0.9,
      bookingId,
      clientId: client.id,
    },
  });

  // Create Chapa payment
  try {
    const tx_ref = `payment-${payment.id}-${uuid()}`;

    // Get URLs from environment variables with fallbacks
   const frontendBaseUrl =  "https://wedding-front-end-x3cf.onrender.com";
    const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";

    // Properly encode URL parameters to avoid HTML entity issues
    const encodedTxRef = encodeURIComponent(tx_ref);
    const encodedPaymentId = encodeURIComponent(payment.id);

    // Ensure the return URL includes both tx_ref and payment_id for verification
    const returnUrl = `${frontendBaseUrl}/dashboard/payment/status?tx_ref=${encodedTxRef}&payment_id=${encodedPaymentId}`;

    const response = await chapa.post("/transaction/initialize", {
      amount: amount.toString(),
      currency: "ETB",
      email: req.user.email,
      tx_ref,
      callback_url: `${backendBaseUrl}/api/client/payment/verify`,
      return_url: returnUrl,
      split: {
        type: "percentage",
        subaccounts: [
          { id: adminAccount.accountId, share: 10 },
          { id: vendor.chapaSubaccountId, share: 90 },
        ],
      },
      // Add customer information
      first_name: client.firstName || req.user.firstName || "",
      last_name: client.lastName || req.user.lastName || "",
      phone_number: client.phoneNumber || "",
      title: `Payment for ${booking.service.name}`,
      description: `Wedding service booking payment for ${booking.service.name}`,
    });

    // Update payment with transaction ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: { transactionId: tx_ref },
    });

    res.status(200).json({
      checkoutUrl: response.data.data.checkout_url,
      paymentId: payment.id,
      tx_ref, // Return tx_ref for polling
    });
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });

    console.error(
      "Chapa payment error:",
      error.response?.data,
      adminAccount.accountId,
      vendor.chapaSubaccountId
    );
    res.status(500);
    throw new Error("Payment initiation failed");
  }
});

// Verify Payment (New Endpoint for Polling)
const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId, tx_ref } = req.body;
  const userId = req.user.id;

  // Validate input
  if (!paymentId || !tx_ref) {
    res.status(400);
    throw new Error("Payment ID and transaction reference are required");
  }

  console.log(
    `Verifying payment: paymentId=${paymentId}, tx_ref=${tx_ref}, userId=${userId}`
  );

  // Verify payment exists and belongs to the user
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });

  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }

  if (payment.userId !== userId) {
    res.status(403);
    throw new Error("Unauthorized: Payment does not belong to this user");
  }

  // Query Chapa's verify transaction endpoint
  try {
    const response = await chapa.get(`/transaction/verify/${tx_ref}`);
    const { status, data } = response.data;

    // Map Chapa status to your PaymentStatus enum
    let paymentStatus;
    switch (status.toLowerCase()) {
      case "success":
        paymentStatus = "COMPLETED";
        break;
      case "failed":
      case "fail":
        paymentStatus = "FAILED";
        break;
      case "pending":
        paymentStatus = "PENDING";
        break;
      default:
        paymentStatus = "FAILED";
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        updatedAt: new Date(),
      },
    });

    // Update booking status if payment is successful
    if (
      paymentStatus === "COMPLETED" &&
      payment.booking?.status === "PENDING"
    ) {
      await prisma.booking.update({
        where: { id: payment.booking.id },
        data: { status: "CONFIRMED" },
      });
    }

    // Get updated payment with booking details
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        booking: {
          include: {
            client: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            service: {
              select: {
                name: true,
                price: true,
                vendor: {
                  select: {
                    businessName: true,
                    id: true,
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Send email notifications if payment is completed
    if (paymentStatus === "COMPLETED" && updatedPayment.booking) {
      try {
        // Send payment completion email to vendor
        await sendPaymentCompletionToVendor(
          updatedPayment,
          updatedPayment.booking,
          updatedPayment.booking.service.vendor
        );

        // Send new booking notification to vendor
        await sendNewBookingToVendor(
          updatedPayment.booking,
          updatedPayment.booking.service.vendor
        );

        console.log(`Payment notification emails sent for payment ID: ${payment.id}`);
      } catch (emailError) {
        console.error('Error sending payment notification emails:', emailError);
        // Continue with the response even if email fails
      }
    }

    res.status(200).json({
      message: "Payment verified",
      paymentId: payment.id,
      status: paymentStatus,
      amount: updatedPayment.amount,
      createdAt: updatedPayment.createdAt,
      updatedAt: updatedPayment.updatedAt,
      booking: updatedPayment.booking
        ? {
            id: updatedPayment.booking.id,
            status: updatedPayment.booking.status,
            eventDate: updatedPayment.booking.eventDate,
            service: {
              name: updatedPayment.booking.service.name,
              vendor: {
                businessName:
                  updatedPayment.booking.service.vendor.businessName,
              },
            },
          }
        : null,
      chapaData: data, // Optional: return Chapa's response for debugging
    });
  } catch (error) {
    console.error("Chapa verify error:", error.response?.data);
    res.status(500);
    throw new Error("Payment verification failed");
  }
});

// Existing Webhook Handler (Optional, for when public URL is available)
const handleWebhook = asyncHandler(async (req, res) => {
  try {
    const chapaSignature = req.headers["chapa-signature"];
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;

    if (!chapaSignature || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return res.status(401).send("Unauthorized");
    }

    // Create the expected signature using the webhook secret
    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    // Verify the signature
    if (hash !== chapaSignature) {
      console.error("Invalid webhook signature");
      return res.status(401).send("Unauthorized");
    }

    const { tx_ref, status } = req.body;

    if (!tx_ref) {
      console.error("Missing tx_ref in webhook payload");
      return res.status(400).send("Bad Request: Missing tx_ref");
    }

    // Get payment by transactionId
    const payment = await prisma.payment.findFirst({
      where: { transactionId: tx_ref },
      include: { booking: true },
    });

    if (!payment) {
      console.error(`Payment not found for tx_ref: ${tx_ref}`);
      return res.status(404).send("Payment not found");
    }

    // Map Chapa status to your PaymentStatus enum
    let paymentStatus;
    switch (status.toLowerCase()) {
      case "success":
        paymentStatus = "COMPLETED";
        break;
      case "failed":
      case "fail":
        paymentStatus = "FAILED";
        break;
      case "pending":
        paymentStatus = "PENDING";
        break;
      default:
        paymentStatus = "FAILED";
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        updatedAt: new Date(),
      },
      include: {
        booking: {
          include: {
            client: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            service: {
              select: {
                name: true,
                price: true,
                vendor: {
                  select: {
                    businessName: true,
                    id: true,
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }
      },
    });

    // Update booking status if payment is completed
    if (
      paymentStatus === "COMPLETED" &&
      updatedPayment.booking?.status === "PENDING"
    ) {
      await prisma.booking.update({
        where: { id: updatedPayment.booking.id },
        data: { status: "CONFIRMED" },
      });

      // Send email notifications if payment is completed
      try {
        // Send payment completion email to vendor
        await sendPaymentCompletionToVendor(
          updatedPayment,
          updatedPayment.booking,
          updatedPayment.booking.service.vendor
        );

        // Send new booking notification to vendor
        await sendNewBookingToVendor(
          updatedPayment.booking,
          updatedPayment.booking.service.vendor
        );

        console.log(`Payment notification emails sent for payment ID: ${payment.id} via webhook`);
      } catch (emailError) {
        console.error('Error sending payment notification emails from webhook:', emailError);
        // Continue with the response even if email fails
      }
    }

    // Log successful webhook processing
    console.log(
      `Webhook processed for payment ${payment.id}, status updated to ${paymentStatus}`
    );

    res.status(200).send("Webhook processed successfully");
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).send("Webhook processing failed");
  }
});

// Get All Payments for the User
const getPayments = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status } = req.query;

  // Convert page and limit to integers
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  // Create where condition
  const where = { userId };

  // Add status filter if provided
  if (
    status &&
    ["PENDING", "COMPLETED", "FAILED", "REFUNDED"].includes(status)
  ) {
    where.status = status;
  }

  // Find client profile
  const client = await prisma.client.findUnique({
    where: { userId },
  });

  if (!client) {
    res.status(400);
    throw new Error("Client profile not found");
  }

  // Get payments with pagination
  const payments = await prisma.payment.findMany({
    where,
    include: {
      booking: {
        include: {
          service: {
            select: {
              name: true,
              price: true,
              vendor: {
                select: {
                  businessName: true,
                  id: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  });

  // Get total count for pagination
  const totalPayments = await prisma.payment.count({ where });

  // Format response
  const formattedPayments = payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    status: payment.status,
    method: payment.method,
    transactionId: payment.transactionId,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    booking: payment.booking
      ? {
          id: payment.booking.id,
          eventDate: payment.booking.eventDate,
          location: payment.booking.location,
          status: payment.booking.status,
          service: {
            name: payment.booking.service.name,
            price: payment.booking.service.price,
            vendor: {
              businessName: payment.booking.service.vendor.businessName,
              id: payment.booking.service.vendor.id,
            },
          },
        }
      : null,
  }));

  res.status(200).json({
    payments: formattedPayments,
    pagination: {
      total: totalPayments,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(totalPayments / limitNum),
    },
  });
});

module.exports = {
  initiatePayment,
  verifyPayment,
  handleWebhook,
  getPayments,
};
