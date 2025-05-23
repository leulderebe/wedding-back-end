const nodemailer = require('nodemailer');
const { FRONTEND_URL } = process.env;

/**
 * Email Service for sending notifications
 *
 * This service handles sending emails for various events:
 * - Vendor approval
 * - Payment completion
 * - New booking notifications
 */

// Create a transporter object for Gmail SMTP
const createTransporter = () => {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '465', 10), // 465 for SSL, 587 for TLS
      secure: process.env.EMAIL_SECURE === 'true', // true for 465 (SSL), false for 587 (TLS)
      auth: {
        user: process.env.EMAIL_USER, // Gmail address
        pass: process.env.EMAIL_PASSWORD, // Gmail password or app password
      },
      tls: {
        // Do not fail on invalid certificates
        rejectUnauthorized: false
      }
    });
};

// Note: We create a new transporter for each email to ensure fresh connections

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @returns {Promise} - Promise with send info
 */
const sendEmail = async (options) => {
  try {
    console.log(`Sending email to ${options.to} with subject "${options.subject}"`);

    // Create a new transporter for each email to ensure fresh connection
    const emailTransporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Wedding Planner" <noreply@weddingplanner.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('- Message ID:', info.messageId);

    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('- Error code:', error.code);
    console.error('- Error message:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('  This usually means there is no SMTP server running at the specified host/port.');
      console.error('  Check your EMAIL_HOST and EMAIL_PORT environment variables.');
    } else if (error.code === 'EAUTH') {
      console.error('  This usually means your email credentials are incorrect.');
      console.error('  Check your EMAIL_USER and EMAIL_PASSWORD environment variables.');
    } else if (error.code === 'ESOCKET') {
      console.error('  This usually means there is a network issue or the port is blocked.');
      console.error('  Make sure port 587 is not blocked by your firewall or network.');
    }

    throw error;
  }
};

/**
 * Send vendor approval notification
 * @param {Object} vendor - Vendor data
 * @param {Object} vendor.user - User data
 * @param {string} vendor.user.email - Vendor email
 * @param {string} vendor.user.firstName - Vendor first name
 * @param {string} vendor.businessName - Vendor business name
 */
const sendVendorApprovalEmail = async (vendor) => {
  const subject = 'Your Vendor Account Has Been Approved!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #4CAF50; text-align: center;">Congratulations!</h2>
      <p>Hello ${vendor.user.firstName},</p>
      <p>We're pleased to inform you that your vendor account <strong>${vendor.businessName}</strong> has been approved!</p>
      <p>You can now log in to your vendor dashboard and start managing your services, bookings, and payments.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/login" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Go to Vendor Dashboard
        </a>
      </div>
      <p>Thank you for joining our wedding planning platform. We look forward to a successful partnership!</p>
      <p>Best regards,<br>The Wedding Planner Team</p>
    </div>
  `;

  return sendEmail({
    to: vendor.user.email,
    subject,
    html,
  });
};


/**
 * Send a test email
 * @param {string} to - Recipient email
 * @returns {Promise} - Promise with send info
 */
const sendTestEmail = async (to) => {
  if (!to) {
    throw new Error('Recipient email is required');
  }

  console.log(`Sending test email to ${to}...`);
  const subject = 'Test Email from Wedding Planner';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #4CAF50; text-align: center;">Test Email</h2>
      <p>This is a test email sent from the Wedding Planner platform to verify email configuration.</p>
      <p>If you received this email, your email service is working correctly!</p>
      <p>Best regards,<br>The Wedding Planner Team</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
};


/**
 * Send payment completion notification to vendor
 * @param {Object} payment - Payment data
 * @param {Object} booking - Booking data
 * @param {Object} vendor - Vendor data
 */
const sendPaymentCompletionToVendor = async (payment, booking, vendor) => {
  const subject = 'Payment Received for Booking';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #4CAF50; text-align: center;">Payment Received</h2>
      <p>Hello ${vendor.user.firstName},</p>
      <p>We're pleased to inform you that a payment has been completed for a booking:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Service:</strong> ${booking.service.name}</p>
        <p><strong>Client:</strong> ${booking.client.user.firstName} ${booking.client.user.lastName}</p>
        <p><strong>Amount:</strong> ETB ${payment.amount.toLocaleString()}</p>
        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
        <p><strong>Payment ID:</strong> ${payment.id}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/dashboard/bookings/${booking.id}/show" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          View Booking Details
        </a>
      </div>
      <p>Please review the booking details and confirm it at your earliest convenience.</p>
      <p>Best regards,<br>The Wedding Planner Team</p>
    </div>
  `;

  return sendEmail({
    to: vendor.user.email,
    subject,
    html,
  });
};

/**
 * Send new booking notification to vendor
 * @param {Object} booking - Booking data
 * @param {Object} vendor - Vendor data
 */
const sendNewBookingToVendor = async (booking, vendor) => {
  const subject = 'New Booking Received';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #4CAF50; text-align: center;">New Booking Received</h2>
      <p>Hello ${vendor.user.firstName},</p>
      <p>You have received a new booking for your service:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Service:</strong> ${booking.service.name}</p>
        <p><strong>Client:</strong> ${booking.client.user.firstName} ${booking.client.user.lastName}</p>
        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
        <p><strong>Location:</strong> ${booking.location}</p>
        <p><strong>Status:</strong> ${booking.status}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/dashboard/bookings/${booking.id}/show" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          View Booking Details
        </a>
      </div>
      <p>Please review the booking details and confirm it at your earliest convenience.</p>
      <p>Best regards,<br>The Wedding Planner Team</p>
    </div>
  `;

  return sendEmail({
    to: vendor.user.email,
    subject,
    html,
  });
};

/**
 * Send booking confirmation notification to client
 * @param {Object} booking - Booking data
 * @param {Object} client - Client data
 */
const sendBookingConfirmationToClient = async (booking, client) => {
  const subject = 'Your Booking Has Been Confirmed!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #4CAF50; text-align: center;">Booking Confirmed</h2>
      <p>Hello ${client.user.firstName},</p>
      <p>We're pleased to inform you that your booking has been confirmed by the vendor:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Service:</strong> ${booking.service.name}</p>
        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
        <p><strong>Location:</strong> ${booking.location}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/dashboard/my-bookings" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          View Booking Details
        </a>
      </div>
      <p>If you have any questions, please contact the vendor directly.</p>
      <p>Best regards,<br>The Wedding Planner Team</p>
    </div>
  `;

  return sendEmail({
    to: client.user.email,
    subject,
    html,
  });
};

/**
 * Send booking cancellation notification to client
 * @param {Object} booking - Booking data
 * @param {Object} client - Client data
 * @param {string} cancellationReason - Reason for cancellation
 */
const sendBookingCancellationToClient = async (booking, client, cancellationReason) => {
  const subject = 'Your Booking Has Been Cancelled';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #F44336; text-align: center;">Booking Cancelled</h2>
      <p>Hello ${client.user.firstName},</p>
      <p>We regret to inform you that your booking has been cancelled by the vendor:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Service:</strong> ${booking.service.name}</p>
        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
        <p><strong>Cancellation Reason:</strong> ${cancellationReason}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/dashboard/my-bookings" style="background-color: #F44336; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          View Booking Details
        </a>
      </div>
      <p>If you have any questions, please contact our support team.</p>
      <p>Best regards,<br>The Wedding Planner Team</p>
    </div>
  `;

  return sendEmail({
    to: client.user.email,
    subject,
    html,
  });
};

/**
 * Send booking completion notification to client
 * @param {Object} booking - Booking data
 * @param {Object} client - Client data
 */
const sendBookingCompletionToClient = async (booking, client) => {
  const subject = 'Your Booking Has Been Completed';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #4CAF50; text-align: center;">Booking Completed</h2>
      <p>Hello ${client.user.firstName},</p>
      <p>We're pleased to inform you that your booking has been marked as completed by the vendor:</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Service:</strong> ${booking.service.name}</p>
        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/dashboard/my-bookings" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          View Booking Details
        </a>
      </div>
      <p>Thank you for using our platform. We hope you had a great experience!</p>
      <p>Best regards,<br>The Wedding Planner Team</p>
    </div>
  `;

  return sendEmail({
    to: client.user.email,
    subject,
    html,
  });
};

/**
 * Test email configuration and connectivity
 * @param {string} testEmail - Email address to send test email to
 * @returns {Promise<Object>} - Object containing test results
 */
const testEmailConfiguration = async (testEmail) => {
  console.log('Starting email configuration test...');

  // Validate the test email
  if (!testEmail) {
    console.error('No test email provided');
    return {
      success: false,
      stage: 'validation',
      message: 'No test email provided',
      details: null
    };
  }

  try {
    // Step 1: Verify environment variables are set
    console.log('Checking required environment variables...');
    const requiredVars = ['EMAIL_USER', 'EMAIL_PASSWORD'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      return {
        success: false,
        stage: 'configuration',
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
        details: null
      };
    }
    console.log('All required environment variables are set');

    // Step 2: Test transporter creation
    console.log('Creating email transporter...');
    const emailTransporter = createTransporter();
    console.log('Email transporter created successfully');

    // Step 3: Verify connection/authentication
    console.log('Verifying connection to Gmail SMTP server...');
    try {
      const verifyResult = await emailTransporter.verify();
      if (!verifyResult) {
        console.error('Failed to verify email transport connection');
        return {
          success: false,
          stage: 'connection',
          message: 'Failed to verify email transport connection',
          details: verifyResult
        };
      }
      console.log('Connection to Gmail SMTP server verified successfully');
    } catch (verifyError) {
      console.error(`Connection verification failed: ${verifyError.message}`);
      return {
        success: false,
        stage: 'connection',
        message: `Connection verification failed: ${verifyError.message}`,
        details: {
          name: verifyError.name,
          code: verifyError.code,
          command: verifyError.command
        }
      };
    }

    // Step 4: Send a test email
    console.log(`Sending test email to ${testEmail}...`);

    try {
      const testMailOptions = {
        from: process.env.EMAIL_FROM || `"Wedding Planner" <${process.env.EMAIL_USER}>`,
        to: testEmail,
        subject: 'Wedding Planner - Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #4CAF50; text-align: center;">Email Configuration Test</h2>
            <p>This is a test email to verify that your email service is configured correctly.</p>
            <p>If you're receiving this email, it means your email configuration is working properly!</p>
            <p>Configuration details:</p>
            <ul>
              <li>Host: smtp.gmail.com</li>
              <li>Port: 587</li>
              <li>User: ${process.env.EMAIL_USER}</li>
            </ul>
            <p>Test completed at: ${new Date().toLocaleString()}</p>
          </div>
        `
      };

      const info = await emailTransporter.sendMail(testMailOptions);
      console.log('Test email sent successfully!');

      return {
        success: true,
        stage: 'completed',
        message: 'Email configuration test completed successfully',
        details: {
          messageId: info.messageId,
          recipient: testEmail,
          timestamp: new Date().toISOString()
        }
      };
    } catch (sendError) {
      console.error(`Failed to send test email: ${sendError.message}`);
      return {
        success: false,
        stage: 'sending',
        message: `Failed to send test email: ${sendError.message}`,
        details: {
          name: sendError.name,
          code: sendError.code,
          command: sendError.command
        }
      };
    }
  } catch (error) {
    console.error(`Email test failed: ${error.message}`);
    return {
      success: false,
      stage: 'error',
      message: `Email test failed: ${error.message}`,
      details: {
        name: error.name,
        code: error.code
      }
    };
  }
};

module.exports = {
  sendEmail,
  sendVendorApprovalEmail,
  sendPaymentCompletionToVendor,
  sendNewBookingToVendor,
  sendBookingConfirmationToClient,
  sendBookingCancellationToClient,
  sendBookingCompletionToClient,
  sendTestEmail,
  testEmailConfiguration
};
