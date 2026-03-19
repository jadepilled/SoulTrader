/**
 * SMTP Diagnostic Script
 * Run on the server: node scripts/test-email.js your@email.com
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const recipient = process.argv[2];
if (!recipient) {
  console.error('Usage: node scripts/test-email.js <recipient-email>');
  process.exit(1);
}

console.log('\n── SoulTrader SMTP Diagnostic ──────────────────────────');
console.log(`Host    : mail.spacemail.com:587 (STARTTLS)`);
console.log(`User    : ${process.env.EMAIL_USER || '❌  NOT SET'}`);
console.log(`Pass    : ${process.env.EMAIL_PASS ? '(set)' : '❌  NOT SET'}`);
console.log(`Send to : ${recipient}`);
console.log('─────────────────────────────────────────────────────────\n');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('❌  Credentials missing from .env. Aborting.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     15000,
  logger: true,
  debug: true,
});

console.log('Step 1: Verifying SMTP connection and credentials...');
transporter.verify((err) => {
  if (err) {
    console.error('\n❌  Verification failed:');
    console.error(`    Code    : ${err.code || 'n/a'}`);
    console.error(`    Response: ${err.response || 'n/a'}`);
    console.error(`    Message : ${err.message}`);
    process.exit(1);
  }

  console.log('✅  Connection verified.\n');
  console.log('Step 2: Sending test email...');

  transporter.sendMail({
    from: `SoulTrader <${process.env.EMAIL_USER}>`,
    to: recipient,
    subject: 'SoulTrader SMTP Test',
    html: `<div style="background:#1a1a1a;padding:2rem;font-family:sans-serif;color:#eee;">
             <h2 style="color:#c9a84c;">SMTP Test Successful</h2>
             <p>The SoulTrader email pipeline is working correctly on port 587.</p>
           </div>`,
  }, (sendErr, info) => {
    if (sendErr) {
      console.error('\n❌  Send failed:', sendErr.message);
      process.exit(1);
    }
    console.log('\n✅  Email sent.');
    console.log(`    Message ID : ${info.messageId}`);
    console.log(`    Response   : ${info.response}`);
    process.exit(0);
  });
});
