import express from 'express';
import { 
    register, 
    login, 
    logout, 
    isAuthenticated, 
    loginPage, 
    registerPage,
    profilePage,
    updateProfile,
    changePasswordPage,
    updatePassword,
    uploadProfileImage,
    forgotPasswordPage,
    forgotPassword,
    resetPasswordPage,
    resetPassword,
    deleteAccount
} from '../controllers/auth.js';
import multer from 'multer';
import path from 'path';
import { 
    registerValidation, 
    loginValidation, 
    forgotPasswordValidation, 
    resetPasswordValidation 
} from '../middleware/validators.js';

const router = express.Router();

// Determine whether to use S3 or local storage based on environment variable
const useS3Storage = process.env.USE_S3_STORAGE === 'true';

// Configure multer for file uploads
const storage = useS3Storage
    ? multer.memoryStorage() // Use memory storage for S3 uploads
    : multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'public/uploads/profile');
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, 'profile-' + uniqueSuffix + ext);
        }
    });

const upload = multer({ 
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB file size limit
    fileFilter: (req, file, cb) => {
        // Only allow image files
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});

// Auth routes
router.get('/register', registerPage);
router.post('/register', registerValidation, register);
router.get('/login', loginPage);
router.post('/login', loginValidation, login);
router.get('/logout', logout);

// Forgot password routes
router.get('/forgot-password', forgotPasswordPage);
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.get('/reset-password/:token', resetPasswordPage);
router.post('/reset-password/:token', resetPasswordValidation, resetPassword);

// Profile routes - protected with authentication middleware
router.get('/profile', isAuthenticated, profilePage);
router.post('/profile', isAuthenticated, updateProfile);
router.get('/change-password', isAuthenticated, changePasswordPage);
router.post('/profile/change-password', isAuthenticated, updatePassword);
router.post('/profile/upload-avatar', isAuthenticated, upload.single('profileImage'), uploadProfileImage);
router.post('/profile/delete', isAuthenticated, deleteAccount);

export default router;