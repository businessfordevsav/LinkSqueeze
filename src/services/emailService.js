import nodemailer from 'nodemailer';

/**
 * Email service for sending emails
 */
class EmailService {
  constructor() {
    // Create reusable transporter using SMTP
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
      },
      requireTLS: true,
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false,
        // Force TLSv1.2 only
        minVersion: 'TLSv1.2'
      },
      debug: process.env.NODE_ENV === 'development'
    });
    
    // Verify connection configuration on startup
    if (process.env.NODE_ENV !== 'test') {
      this.verifyConnection();
    }
  }
  
  /**
   * Verify connection to email server
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service: Connection to SMTP server established successfully');
    } catch (error) {
      console.error('Email service: Could not connect to SMTP server', error);
      
      if (error.code === 'ESOCKET' && error.reason === 'wrong version number') {
        console.log('\n--- TLS CONNECTION ERROR ---');
        console.log('The email server is rejecting the TLS connection. Please check your email settings:');
        console.log('1. Make sure EMAIL_PORT is set to 587 (for STARTTLS) or 465 (for SSL/TLS)');
        console.log('2. If using port 587, set EMAIL_SECURE=false');
        console.log('3. If using port 465, set EMAIL_SECURE=true');
        console.log('--------------------------\n');
      } else if (error.code === 'EAUTH') {
        console.log('\n--- AUTHENTICATION ERROR ---');
        console.log('For Gmail users, you need to use an "App Password" instead of your regular password.');
        console.log('Please follow these steps:');
        console.log('1. Enable 2-Step Verification: https://myaccount.google.com/security');
        console.log('2. Create an App Password: https://myaccount.google.com/apppasswords');
        console.log('3. Update your .env file with the generated App Password');
        console.log('----------------------------\n');
      }
    }
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} resetUrl - Password reset URL
   * @returns {Promise<boolean>} - True if email sent successfully
   */
  async sendPasswordResetEmail(to, resetUrl) {
    try {
      // Mail options
      const mailOptions = {
        from: `"shrtn.live" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to,
        subject: 'shrtn.live - Password Reset',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #4338ca;">shrtn.live</h1>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
              <p style="color: #64748b; line-height: 1.6;">You are receiving this email because you (or someone else) requested to reset your password.</p>
              <p style="color: #64748b; line-height: 1.6;">Please click the button below to reset your password. This link will expire in 1 hour.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #4338ca; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #64748b; line-height: 1.6;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
            </div>
            <div style="text-align: center; color: #94a3b8; font-size: 14px;">
              <p>&copy; ${new Date().getFullYear()} shrtn.live. All rights reserved.</p>
            </div>
          </div>
        `
      };

      // Send mail with defined transport object
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }
}

export default new EmailService();