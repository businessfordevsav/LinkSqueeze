import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide your name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "Please provide a valid email",
      },
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't include password in queries by default
    },
    profilePicture: {
      type: String,
      default: "/img/default-user.png",
    },
    bio: {
      type: String,
      maxlength: [200, "Bio cannot be more than 200 characters"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property to get user's links
userSchema.virtual("links", {
  ref: "SHORT-URL",
  localField: "_id",
  foreignField: "createdBy",
});

// Add virtual property to get the complete profile image URL
userSchema.virtual('profileImageUrl').get(function() {
  // If profilePicture starts with http or https, it's an S3 URL that needs proxying
  if (this.profilePicture && (this.profilePicture.startsWith('http://') || this.profilePicture.startsWith('https://'))) {
    // Extract just the path from the S3 URL and use our proxy endpoint
    try {
      const url = new URL(this.profilePicture);
      const s3Key = url.pathname.substring(1); // Remove leading slash
      return `/s3-image/${s3Key}`;
    } catch (error) {
      // If URL parsing fails, return the original URL
      return this.profilePicture;
    }
  }
  
  // Otherwise, it's a local path or we need to return the default image
  return this.profilePicture || "/img/default-user.png";
});

// Pre-save hook to hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Generate a salt and hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to verify password
userSchema.methods.verifyPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get profile picture url
userSchema.methods.getProfileImageUrl = function () {
  // If profilePicture starts with http or https, it's an S3 URL that needs proxying
  if (this.profilePicture && (this.profilePicture.startsWith('http://') || this.profilePicture.startsWith('https://'))) {
    // Extract just the path from the S3 URL and use our proxy endpoint
    try {
      const url = new URL(this.profilePicture);
      const s3Key = url.pathname.substring(1); // Remove leading slash
      return `/s3-image/${s3Key}`;
    } catch (error) {
      // If URL parsing fails, return the original URL
      return this.profilePicture;
    }
  }
  
  // Otherwise, it's a local path or we need to return the default image
  return this.profilePicture || "/img/default-user.png";
};

const User = mongoose.model("User", userSchema);

export default User;