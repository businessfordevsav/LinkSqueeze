import User from "../models/user.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import emailService from "../services/emailService.js";

// For testing API responses
const isTestEnvironment = () => {
  return process.env.NODE_ENV === 'test';
};

// Helper to handle different response types based on environment
const respondWithTemplateOrJson = (res, status, template, data) => {
  if (isTestEnvironment()) {
    return res.status(status).json(data);
  }
  return res.status(status).render(template, data);
};

// Register a new user
export const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return respondWithTemplateOrJson(res, 400, "auth/register", {
        status: "error",
        message: "Please provide all required fields",
        user: { name, email }
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return respondWithTemplateOrJson(res, 400, "auth/register", {
        status: "error",
        message: "Passwords do not match",
        user: { name, email }
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return respondWithTemplateOrJson(res, 400, "auth/register", {
        status: "error",
        message: "Email already in use",
        user: { name, email }
      });
    }

    // Create new user - let the User model handle password hashing
    const user = await User.create({
      name,
      email,
      password, // The pre-save hook in the User model will hash this
    });

    // Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "your-secret-key-should-be-in-env-file",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Set cookie
    const cookieOptions = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    };

    res.cookie("token", token, cookieOptions);
    
    // Also set the user in session for consistent authentication
    if (req.session) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }

    // For testing, send JSON response with status success
    if (isTestEnvironment()) {
      return res.status(201).json({
        status: "success",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          }
        }
      });
    }
    
    // Redirect to dashboard
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Registration error:", error);
    return respondWithTemplateOrJson(res, 500, "auth/register", {
      status: "error",
      message: "An error occurred during registration",
      user: req.body
    });
  }
};

// Log in a user
export const login = async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    // Validate input
    if (!email || !password) {
      return respondWithTemplateOrJson(res, 400, "auth/login", {
        status: "error",
        message: "Please provide email and password",
        email
      });
    }

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return respondWithTemplateOrJson(res, 401, "auth/login", {
        status: "error",
        message: "Invalid email or password",
        email
      });
    }

    // Verify password using the model's method instead of direct bcrypt compare
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      return respondWithTemplateOrJson(res, 401, "auth/login", {
        status: "error",
        message: "Invalid email or password",
        email
      });
    }

    // Set expiration time based on remember me checkbox
    const expiresIn = remember ? "30d" : (process.env.JWT_EXPIRES_IN || "7d");

    // Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "your-secret-key-should-be-in-env-file",
      { expiresIn }
    );

    // Set cookie
    const cookieOptions = {
      expires: new Date(
        Date.now() + (remember ? 30 : (process.env.JWT_COOKIE_EXPIRES_IN || 7)) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    };

    res.cookie("token", token, cookieOptions);
    
    // Also set the user in session for consistent authentication
    if (req.session) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }

    // For testing, send JSON response with status success
    if (isTestEnvironment()) {
      return res.status(200).json({
        status: "success",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          }
        }
      });
    }
    
    // Redirect to dashboard in production
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    return respondWithTemplateOrJson(res, 500, "auth/login", {
      status: "error",
      message: "An error occurred during login",
      email: req.body.email
    });
  }
};

// Log out a user
export const logout = (req, res) => {
  // Clear JWT cookie
  res.cookie("token", "logged-out", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  
  // Clear session
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
    });
  }
  
  res.redirect("/");
};

// Check if user is authenticated
export const isAuthenticated = async (req, res, next) => {
  try {
    // First check if user is in session
    if (req.session && req.session.user) {
      // Validate the session user by finding them in the database
      const sessionUser = await User.findById(req.session.user.id);
      if (sessionUser) {
        req.user = sessionUser;
        res.locals.user = sessionUser;
        return next();
      }
    }

    // If no session, fall back to token authentication
    const token = req.cookies.token;

    if (!token) {
      return res.redirect("/login");
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key-should-be-in-env-file"
    );

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.redirect("/login");
    }

    // Grant access to protected route
    req.user = user;
    res.locals.user = user;
    
    // Update session with user info if session exists but user doesn't
    if (req.session && !req.session.user) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.redirect("/login");
  }
};

// Render login page
export const loginPage = (req, res) => {
  res.render('auth/login', { error: null, success: null });
};

// Render register page
export const registerPage = (req, res) => {
  res.render('auth/register', { user: {}, error: null });
};

// Render user profile page
export const profilePage = async (req, res) => {
  try {
    // Import the URL model for link statistics
    const URL = (await import("../models/url.js")).default;
    
    // Find all links created by this user
    const userLinks = await URL.find({ createdBy: req.user._id });
    
    // Calculate total links and clicks
    const totalLinks = userLinks.length;
    const totalClicks = userLinks.reduce((sum, link) => sum + link.clicks, 0);
    
    res.render('auth/profile', { 
      user: req.user, 
      totalLinks,
      totalClicks,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error("Profile page error:", error);
    res.render('auth/profile', { 
      user: req.user, 
      totalLinks: 0,
      totalClicks: 0,
      error: "Failed to load link statistics",
      success: req.query.success || null
    });
  }
};

// Render change password page
export const changePasswordPage = (req, res) => {
  res.render('auth/change-password', {
    user: req.user,
    error: req.query.error || null,
    success: req.query.success || null
  });
};

// Update user profile information
export const updateProfile = async (req, res) => {
  try {
    const { name, email, bio } = req.body;
    
    // Validate input
    if (!name || !email) {
      return res.status(400).render("auth/profile", {
        error: "Please provide name and email",
        success: null,
        user: req.user,
        totalLinks: 0,
        totalClicks: 0
      });
    }
    
    // Check if email is already in use by another user
    if (email !== req.user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existingUser) {
        return res.render('auth/profile', {
          user: { ...req.user, name, email, bio },
          error: 'Email is already in use by another account',
          success: null,
          totalLinks: 0,
          totalClicks: 0
        });
      }
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, bio },
      { new: true, runValidators: true }
    );
    
    res.locals.user = updatedUser;
    
    // Update token with new user info
    const token = jwt.sign(
      { id: updatedUser._id },
      process.env.JWT_SECRET || "your-secret-key-should-be-in-env-file",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    
    // Update cookie
    const cookieOptions = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    };

    res.cookie("token", token, cookieOptions);
    
    // Also update session user
    if (req.session) {
      req.session.user = {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      };
    }
    
    // Get link statistics before rendering the profile page
    const URL = (await import("../models/url.js")).default;
    const userLinks = await URL.find({ createdBy: updatedUser._id });
    const totalLinks = userLinks.length;
    const totalClicks = userLinks.reduce((sum, link) => sum + link.clicks, 0);
    
    res.render("auth/profile", {
      success: "Profile updated successfully",
      error: null,
      user: updatedUser,
      totalLinks,
      totalClicks
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).render("auth/profile", {
      error: "An error occurred while updating your profile",
      success: null,
      user: req.user,
      totalLinks: 0,
      totalClicks: 0
    });
  }
};

// Handle profile image upload
export const uploadProfileImage = async (req, res) => {
  try {
    // Import the S3 service
    const { uploadBufferToS3, uploadFileToS3 } = await import("../services/s3Service.js");
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded"
      });
    }

    // Check if we should use S3 storage
    const useS3Storage = process.env.USE_S3_STORAGE === 'true';
    let profilePicturePath;
    
    if (useS3Storage) {
      try {
        let fileUrl;
        
        // Check if we're using memory storage (buffer) or disk storage (path)
        if (req.file.buffer) {
          // Using memory storage, upload buffer directly to S3
          const s3Key = `profiles/${Date.now()}-${req.file.originalname}`;
          fileUrl = await uploadBufferToS3(
            req.file.buffer, 
            s3Key, 
            req.file.mimetype
          );
          console.log(`Profile image (buffer) uploaded to S3: ${fileUrl}`);
        } else {
          // Using disk storage, upload file to S3
          const filePath = req.file.path;
          const s3Key = `profiles/${Date.now()}-${req.file.originalname}`;
          fileUrl = await uploadFileToS3(filePath, s3Key);
          console.log(`Profile image (file) uploaded to S3: ${fileUrl}`);
          
          // Delete the local file after successful S3 upload
          const fs = await import('fs');
          fs.unlinkSync(filePath);
        }
        
        // Use the full S3 URL as the profile picture path
        profilePicturePath = fileUrl;
      } catch (s3Error) {
        console.error("Error uploading to S3:", s3Error);
        // Fallback to local storage if using disk storage
        if (req.file.path) {
          profilePicturePath = `/uploads/profile/${req.file.filename}`;
        } else {
          // If using memory storage and S3 fails, we can't save the file
          return res.status(500).json({
            success: false,
            message: "Failed to upload profile image to S3"
          });
        }
      }
    } else {
      // Use local storage - should only happen if we're using disk storage
      profilePicturePath = `/uploads/profile/${req.file.filename}`;
    }
    
    // Update user's profile picture in database
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: profilePicturePath },
      { new: true }
    );
    
    // Update session user if session exists
    if (req.session && req.session.user) {
      req.session.user = {
        ...req.session.user,
        profilePicture: profilePicturePath
      };
    }
    
    // Return success response
    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImageUrl: updatedUser.profileImageUrl
    });
  } catch (error) {
    console.error("Profile image upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile image"
    });
  }
};

// Update user password
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
      return res.render('auth/change-password', {
        user: req.user,
        error: 'New password and confirm password do not match',
        success: null
      });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.render('auth/change-password', {
        user: req.user,
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        success: null
      });
    }

    // Get user from database with password field
    const user = await User.findById(req.user._id).select("+password");

    // Verify current password using the model's method
    const isMatch = await user.verifyPassword(currentPassword);
    if (!isMatch) {
      return res.render('auth/change-password', {
        user: req.user,
        error: 'Current password is incorrect',
        success: null
      });
    }

    // Update user with new password - let the pre-save hook handle hashing
    user.password = newPassword;
    await user.save();

    // Render change password page with success message
    res.render('auth/change-password', {
      user: req.user,
      error: null,
      success: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Password update error:', error);
    res.render('auth/change-password', {
      user: req.user,
      error: 'Error updating password. Please try again.',
      success: null
    });
  }
};

// Generate random token
const generateResetToken = () => {
  // Generate a random 32-byte hex string
  return crypto.randomBytes(32).toString('hex');
};

// Render forgot password page
export const forgotPasswordPage = (req, res) => {
  res.render('auth/forgot-password', { 
    error: null, 
    success: null 
  });
};

// Process forgot password request
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.render('auth/forgot-password', {
        error: 'Please provide your email address',
        success: null
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Return error if user doesn't exist
    if (!user) {
      return res.render('auth/forgot-password', {
        error: 'No account with this email address exists.',
        success: null
      });
    }
    
    // Generate token
    const resetToken = generateResetToken();
    
    // Set token and expiration in user document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000; // Token valid for 1 hour
    await user.save();
    
    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    
    try {
      // Send password reset email using our email service
      const emailSent = await emailService.sendPasswordResetEmail(user.email, resetUrl);
      
      if (!emailSent) {
        throw new Error('Failed to send email');
      }
      
      // Log the reset URL in development environment
      if (process.env.NODE_ENV !== 'production') {
        console.log('Password reset link (dev only):', resetUrl);
      }
      
      return res.render('auth/forgot-password', {
        error: null,
        success: 'A password reset link has been sent to your email address.'
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      
      // Don't reset the token on email failure, instead show the reset URL directly in development
      // This allows testing password reset even when email service isn't configured
      if (process.env.NODE_ENV !== 'production') {
        return res.render('auth/forgot-password', {
          error: 'There was a problem sending the email. Since you are in development mode, you can use the following link:',
          success: `<a href="${resetUrl}" style="text-decoration: underline; color: blue;">Reset Password Link</a>`
        });
      }
      
      return res.render('auth/forgot-password', {
        error: 'There was a problem sending the password reset email. Please check your email configuration or try again later.',
        success: null
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('auth/forgot-password', {
      error: 'An error occurred. Please try again.',
      success: null
    });
  }
};

// Render reset password page
export const resetPasswordPage = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with the token and ensure it's not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.render('auth/reset-password', {
        error: 'Password reset token is invalid or has expired',
        success: null,
        token: null
      });
    }
    
    res.render('auth/reset-password', {
      error: null,
      success: null,
      token
    });
  } catch (error) {
    console.error('Reset password page error:', error);
    res.render('auth/reset-password', {
      error: 'An error occurred. Please try again.',
      success: null,
      token: null
    });
  }
};

// Process reset password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    
    // Check if passwords match
    if (password !== confirmPassword) {
      return res.render('auth/reset-password', {
        error: 'Passwords do not match',
        success: null,
        token
      });
    }
    
    // Validate password strength with individual checks for better error messages
    if (password.length < 8) {
      return res.render('auth/reset-password', {
        error: 'Password must be at least 8 characters long',
        success: null,
        token
      });
    }
    
    if (!/[A-Z]/.test(password)) {
      return res.render('auth/reset-password', {
        error: 'Password must contain at least one uppercase letter',
        success: null,
        token
      });
    }
    
    if (!/[a-z]/.test(password)) {
      return res.render('auth/reset-password', {
        error: 'Password must contain at least one lowercase letter',
        success: null,
        token
      });
    }
    
    if (!/\d/.test(password)) {
      return res.render('auth/reset-password', {
        error: 'Password must contain at least one number',
        success: null,
        token
      });
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return res.render('auth/reset-password', {
        error: 'Password must contain at least one special character',
        success: null,
        token
      });
    }
    
    // Find user with the token and ensure it's not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.render('auth/reset-password', {
        error: 'Password reset token is invalid or has expired',
        success: null,
        token: null
      });
    }
    
    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    
    // Redirect to login page with success message
    res.render('auth/login', {
      error: null,
      success: 'Your password has been reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.render('auth/reset-password', {
      error: 'An error occurred while resetting your password',
      success: null,
      token: req.params.token
    });
  }
};

// Delete user account
export const deleteAccount = async (req, res) => {
  try {
    // Import required services and models
    const { deleteFileFromS3 } = await import("../services/s3Service.js");
    const URL = (await import("../models/url.js")).default;
    const { deleteQRCode } = await import("../services/qrCodeService.js");
    const fs = await import('fs');
    const path = await import('path');

    const userId = req.user._id;
    console.log(`Deleting account for user: ${userId}`);

    // 1. Find all user's shortened URLs
    const userUrls = await URL.find({ createdBy: userId });
    console.log(`Found ${userUrls.length} URLs to delete`);

    // 2. Delete all QR codes associated with the user's URLs
    for (const url of userUrls) {
      if (url.qrCodeUrl) {
        try {
          const deleted = await deleteQRCode(url.qrCodeUrl);
          if (deleted) {
            console.log(`QR code deleted for URL: ${url.shortId}`);
          } else {
            console.warn(`Failed to delete QR code for URL: ${url.shortId}`);
          }
        } catch (error) {
          console.error(`Error deleting QR code for URL ${url.shortId}:`, error);
        }
      }
    }

    // 3. Delete all the user's URLs
    await URL.deleteMany({ createdBy: userId });
    console.log(`Deleted all URLs for user ${userId}`);

    // 4. Delete the user's profile picture if it exists
    const useS3Storage = process.env.USE_S3_STORAGE === 'true';
    if (req.user.profilePicture && req.user.profilePicture !== "/img/default-user.png") {
      try {
        if (useS3Storage && (req.user.profilePicture.startsWith('http://') || req.user.profilePicture.startsWith('https://'))) {
          // Extract S3 key from URL
          const url = new URL(req.user.profilePicture);
          const s3Key = url.pathname.substring(1); // Remove leading slash
          const result = await deleteFileFromS3(s3Key);
          console.log(`Profile picture delete from S3 result: ${result}`);
        } else if (!useS3Storage && req.user.profilePicture.startsWith('/uploads/')) {
          // Delete local profile picture
          const filePath = path.join(process.cwd(), 'public', req.user.profilePicture);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Local profile picture deleted: ${filePath}`);
          }
        }
      } catch (error) {
        console.error("Error deleting profile picture:", error);
      }
    }

    // 5. Delete the user from the database
    await User.findByIdAndDelete(userId);
    console.log(`User ${userId} deleted from database`);

    // 6. Clear auth tokens and session
    res.cookie("token", "logged-out", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });
    
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
      });
    }

    // 7. Redirect to home page with a success message
    res.redirect("/?message=account-deleted");
  } catch (error) {
    console.error("Delete account error:", error);
    
    // Return user to profile page with error message
    res.redirect("/profile?error=Failed%20to%20delete%20account.%20Please%20try%20again.");
  }
};