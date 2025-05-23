/**
 * Email Service Test
 *
 * This script tests the email service configuration and functionality.
 * It verifies that:
 * 1. All required environment variables are set
 * 2. The email transport can be created
 * 3. Authentication with the email server works
 * 4. A test email can be sent successfully
 *
 * Usage:
 * - Run with Node.js: node tests/emailService.test.js [recipient-email]
 * - The recipient email is optional. If not provided, it will use the EMAIL_USER as the recipient.
 */

require('dotenv').config(); // Load environment variables
const { testEmailConfiguration } = require('../utils/emailService');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Print a formatted section header
 * @param {string} title - Section title
 */
function printSection(title) {
  console.log('\n' + colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + ' ' + title + colors.reset);
  console.log(colors.bright + colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

/**
 * Print a success message
 * @param {string} message - Success message
 */
function printSuccess(message) {
  console.log(colors.green + '✓ ' + message + colors.reset);
}

/**
 * Print an error message
 * @param {string} message - Error message
 */
function printError(message) {
  console.log(colors.red + '✗ ' + message + colors.reset);
}

/**
 * Print a warning message
 * @param {string} message - Warning message
 */
function printWarning(message) {
  console.log(colors.yellow + '⚠ ' + message + colors.reset);
}

/**
 * Print an info message
 * @param {string} message - Info message
 */
function printInfo(message) {
  console.log(colors.blue + 'ℹ ' + message + colors.reset);
}

/**
 * Run the email service test
 */
async function runTest() {
  printSection('EMAIL SERVICE TEST');

  // Get recipient email from command line args or use EMAIL_USER as fallback
  const args = process.argv.slice(2);
  const recipientEmail = args[0] || process.env.EMAIL_USER;

  if (!recipientEmail) {
    printError('No recipient email provided and EMAIL_USER not set. Please provide a recipient email.');
    process.exit(1);
  }

  printInfo(`Testing email service with recipient: ${recipientEmail}`);
  printInfo(`Using Gmail SMTP configuration:`);
  printInfo(`- Host: ${process.env.EMAIL_HOST || 'smtp.gmail.com'}`);
  printInfo(`- Port: ${process.env.EMAIL_PORT || '465'}`);
  printInfo(`- Secure: ${process.env.EMAIL_SECURE || 'true'}`);

  // Check if using SSL (port 465) or TLS (port 587)
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  if (port === 465) {
    printInfo('- Connection type: SSL (more reliable, works through most firewalls)');
  } else if (port === 587) {
    printInfo('- Connection type: TLS (standard, may be blocked by some firewalls)');
  }

  try {
    printInfo('Checking Gmail credentials...');
    printInfo(`Using EMAIL_USER: ${process.env.EMAIL_USER}`);
    printInfo(`Using EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '********' : 'not set'}`);

    // Check if the Gmail password is an App Password (should be 16 characters)
    if (process.env.EMAIL_PASSWORD && process.env.EMAIL_PASSWORD.length !== 16 && !process.env.EMAIL_PASSWORD.includes(' ')) {
      printWarning('Your EMAIL_PASSWORD does not look like a Gmail App Password.');
      printWarning('Gmail App Passwords are usually 16 characters without spaces.');
      printWarning('You might need to create an App Password in your Google Account settings.');
    }

    printInfo('\nAttempting to connect to Gmail SMTP server...');

    // Run the email configuration test
    const result = await testEmailConfiguration(recipientEmail);

    if (result.success) {
      printSuccess('Email configuration test completed successfully!');
      printInfo('Message ID: ' + result.details.messageId);
      printInfo('Timestamp: ' + result.details.timestamp);
      console.log('\n' + colors.green + 'All tests passed! Your email service is configured correctly.' + colors.reset);
    } else {
      printError(`Test failed at stage: ${result.stage}`);
      printError(`Error message: ${result.message}`);

      if (result.details) {
        console.log('\nError details:');
        console.log(result.details);
      }

      if (result.stage === 'connection' || result.stage === 'error') {
        printWarning('\nCommon issues with Gmail SMTP:');
        printWarning('1. Make sure you are using an App Password if you have 2-factor authentication enabled.');
        printWarning('   - Go to your Google Account > Security > App passwords');
        printWarning('   - Create a new app password for "Mail" and "Other (Custom name)"');
        printWarning('   - Use that 16-character password in your .env file');
        printWarning('2. Check if your network/firewall allows outgoing connections to port 587.');
        printWarning('3. Verify that your EMAIL_USER and EMAIL_PASSWORD environment variables are correct.');
      }

      console.log('\n' + colors.red + 'Email service test failed. Please check your configuration.' + colors.reset);
    }
  } catch (error) {
    printError('Unexpected error during test execution:');
    console.error(error);
  }
}

// Run the test
runTest();
