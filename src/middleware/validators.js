// src/middleware/validators.js
import { body, param, validationResult } from 'express-validator';

// Function to check validation results
export const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // For API requests
    if (req.path.startsWith('/api/')) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // For form submissions, redirect back with error message
    const errorMessage = errors.array()[0].msg;
    if (req.path.includes('login')) {
      return res.render('auth/login', { error: errorMessage, email: req.body.email || '' });
    } else if (req.path.includes('register')) {
      return res.render('auth/register', { error: errorMessage, user: req.body });
    } else if (req.path.includes('forgot-password')) {
      return res.render('auth/forgot-password', { error: errorMessage, email: req.body.email || '' });
    } else if (req.path.includes('reset-password')) {
      return res.render('auth/reset-password', { error: errorMessage, token: req.params.token || req.body.token });
    }
    
    // Generic fallback
    return res.status(400).send(errorMessage);
  }
  next();
};

// Validation rules for user registration
export const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .escape(),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  checkValidationResult
];

// Validation rules for login
export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .not().isEmpty()
    .withMessage('Password is required'),
  checkValidationResult
];

// Validation rules for forgot password
export const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  checkValidationResult
];

// Validation rules for reset password
export const resetPasswordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  checkValidationResult
];

// Validation rules for URL creation
export const urlValidation = [
  body('redirectUrl')
    .trim()
    .isURL({ require_protocol: true })
    .withMessage('Please enter a valid URL including http:// or https://'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Custom name must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Custom name can only contain letters, numbers, underscores and hyphens'),
  checkValidationResult
];

// Less strict validation rules for URL updates
export const urlUpdateValidation = [
  body('redirectUrl')
    .optional()
    .trim()
    .isURL({ require_protocol: true })
    .withMessage('Please enter a valid URL including http:// or https://'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  // Don't validate the structure of the customOverlay object
  checkValidationResult
];

// Validation for URL ID parameter
export const urlIdValidation = [
  param('shortId')
    .trim()
    .notEmpty()
    .withMessage('URL ID is required')
    .matches(/^[a-zA-Z0-9_-]+$/) // Allow alphanumeric, underscores, and hyphens
    .withMessage('Invalid URL ID format'),
  checkValidationResult
];

export default {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  urlValidation,
  urlUpdateValidation,
  urlIdValidation
};