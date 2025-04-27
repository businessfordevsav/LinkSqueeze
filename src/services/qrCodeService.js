import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import sharp from "sharp"; // For image processing
import { uploadBufferToS3, deleteFileFromS3 } from "./s3Service.js";

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local directories (for fallback and temporary storage)
const QR_CODE_DIR = path.join(__dirname, "../../public/qrcodes");
const TEMP_DIR = path.join(__dirname, "../../temp");

// App icon paths for ad mode
const APP_ICON_PATH = path.join(
  __dirname,
  "../../public/android-chrome-192x192.png"
);
const APP_ICON_LARGE_PATH = path.join(
  __dirname,
  "../../public/android-chrome-512x512.png"
);

// Ensure the directories exist
try {
  [QR_CODE_DIR, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Directory created successfully at: ${dir}`);
    }
  });
  
  // Test write access to the temp directory
  const testFile = path.join(TEMP_DIR, ".test");
  fs.writeFileSync(testFile, "test");
  fs.unlinkSync(testFile);
  console.log("Successfully verified write access to directories");
} catch (error) {
  console.error(`ERROR setting up directories: ${error.message}`);
  console.error(`Full error: ${error.stack}`);
}

// Check if we should use S3 (based on environment variables)
const useS3Storage = process.env.USE_S3_STORAGE === 'true';
console.log(`QR Code Service using S3 storage: ${useS3Storage}`);

/**
 * Process S3 URLs to use the proxy route
 * @param {string} url - The S3 URL
 * @returns {string} - The proxied URL
 */
const getProxiedUrl = (url) => {
  if (!url) return '';
  
  // If already a relative URL starting with /qrcodes, it's a local file
  if (url.startsWith('/qrcodes/')) return url;
  
  // If it's an S3 URL, convert it to use our proxy
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsedUrl = new URL(url);
      // Check if it's an S3 URL
      if (parsedUrl.hostname.includes('amazonaws.com') || parsedUrl.hostname.includes('s3')) {
        // Extract just the path from the S3 URL and use our proxy endpoint
        const fullPath = parsedUrl.pathname.substring(1); // Remove leading slash
        
        // Check if the path contains qrcodes/
        if (fullPath.includes('qrcodes/')) {
          const qrcodesIndex = fullPath.indexOf('qrcodes/');
          const keyPath = fullPath.substring(qrcodesIndex);
          return `/s3-image/${keyPath}`;
        }
        
        // If no qrcodes/ path is found, assume it's just the file name and add the qrcodes/ prefix
        const parts = fullPath.split('/');
        const fileName = parts[parts.length - 1];
        return `/s3-image/qrcodes/${fileName}`;
      }
      // Not an S3 URL, return as is
      return url;
    } catch (error) {
      console.error('Error processing URL:', error);
      return url;
    }
  }
  
  // Handle case where URL is just a filename (might be stored this way in the database)
  if (url.endsWith('.png') && !url.includes('/')) {
    return `/s3-image/qrcodes/${url}`;
  }
  
  return url;
};

/**
 * Generate a QR code for a URL and save it to S3 or local directory
 * @param {string} shortId - The short ID of the URL
 * @param {string} fullUrl - The full URL to encode in the QR code
 * @param {Object} options - Optional configuration for the QR code
 * @returns {Promise<string>} - The URL to access the QR code
 */
const generateQRCode = async (shortId, fullUrl, options = {}) => {
  try {
    console.log(`Generating QR code for ID: ${shortId}, URL: ${fullUrl}`);

    const fileName = `${shortId}.png`;
    
    // Default QR code options with improved visuals
    const qrOptions = {
      errorCorrectionLevel: "H", // High error correction for better scanning
      margin: 1,
      width: 300,
      color: {
        dark: options.darkColor || "#000000",
        light: options.lightColor || "#ffffff",
      },
      rendererOpts: {
        quality: 1.0, // Higher quality for better rendering on small screens
      },
    };

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(fullUrl, qrOptions);

    if (useS3Storage) {
      // Upload to S3
      try {
        const s3Key = `qrcodes/${fileName}`;
        const fileUrl = await uploadBufferToS3(qrBuffer, s3Key, 'image/png');
        console.log(`QR code uploaded to S3 at: ${fileUrl}`);
        
        // Return the S3 URL or just the key path that can be constructed into a URL
        return fileUrl;
      } catch (s3Error) {
        console.error("Error uploading QR code to S3:", s3Error);
        // Fall back to local storage if S3 upload fails
        console.log("Falling back to local storage for QR code");
      }
    }
    
    // Local storage (as fallback or if S3 is not enabled)
    const filePath = path.join(QR_CODE_DIR, fileName);
    console.log(`Saving QR code locally to: ${filePath}`);
    
    // Write buffer to file
    fs.writeFileSync(filePath, qrBuffer);
    
    // Verify the file was created
    if (!fs.existsSync(filePath)) {
      throw new Error(`QR code file was not created at: ${filePath}`);
    }

    console.log(`QR code generated successfully at: ${filePath}`);
    // Return relative path to QR code for local storage
    return `/qrcodes/${fileName}`;
  } catch (error) {
    console.error("Error generating QR code:", error);
    console.error("Error stack:", error.stack);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
};

/**
 * Generate a QR code with app icon overlay (ad mode)
 * @param {string} shortId - The short ID of the URL
 * @param {string} fullUrl - The full URL to encode in the QR code
 * @param {Object} options - Optional configuration for the QR code
 * @returns {Promise<string>} - The URL to access the QR code
 */
const generateAdModeQRCode = async (shortId, fullUrl, options = {}) => {
  try {
    console.log(
      `Generating ad mode QR code with app icon for ID: ${shortId}, URL: ${fullUrl}`
    );
    
    // First generate the QR code as buffer
    const fileName = `${shortId}.png`;
    const qrOptions = {
      errorCorrectionLevel: "H", // High error correction required for logo overlay
      margin: 1,
      width: 300,
      color: {
        dark: options.darkColor || "#000000",
        light: options.lightColor || "#ffffff",
      },
      rendererOpts: {
        quality: 1.0,
      },
    };

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(fullUrl, qrOptions);

    try {
      // Process the QR code with Sharp
      const qrImage = sharp(qrBuffer);
      
      // Now overlay the app icon on the QR code
      const iconPath = options.useLargeIcon
        ? APP_ICON_LARGE_PATH
        : APP_ICON_PATH;
      const iconImage = await sharp(iconPath);

      // Calculate icon size (default to 20% of QR code size)
      const qrMetadata = await qrImage.metadata();
      const iconSize = options.iconSizePercent
        ? Math.floor(qrMetadata.width * (options.iconSizePercent / 100))
        : Math.floor(qrMetadata.width * 0.2);

      // Resize icon to appropriate size
      const resizedIcon = await iconImage.resize(iconSize, iconSize).toBuffer();

      // Calculate position to center the icon
      const iconPosition = {
        left: Math.floor((qrMetadata.width - iconSize) / 2),
        top: Math.floor((qrMetadata.height - iconSize) / 2),
      };

      // Composite the icon onto the QR code
      const finalImageBuffer = await qrImage
        .composite([
          {
            input: resizedIcon,
            left: iconPosition.left,
            top: iconPosition.top,
          },
        ])
        .toBuffer();
        
      if (useS3Storage) {
        // Upload to S3
        try {
          const s3Key = `qrcodes/${fileName}`;
          const fileUrl = await uploadBufferToS3(finalImageBuffer, s3Key, 'image/png');
          console.log(`Ad mode QR code uploaded to S3 at: ${fileUrl}`);
          
          // Return the S3 URL
          return fileUrl;
        } catch (s3Error) {
          console.error("Error uploading ad mode QR code to S3:", s3Error);
          // Fall back to local storage if S3 upload fails
          console.log("Falling back to local storage for ad mode QR code");
        }
      }
      
      // Local storage (as fallback or if S3 is not enabled)
      const filePath = path.join(QR_CODE_DIR, fileName);
      await sharp(finalImageBuffer).toFile(filePath);
      
      console.log(`Ad mode QR code generated successfully at: ${filePath}`);
      return `/qrcodes/${fileName}`;
    } catch (sharpError) {
      console.error("Error in Sharp processing:", sharpError);
      
      // If Sharp processing fails, use the original QR buffer as fallback
      if (useS3Storage) {
        try {
          const s3Key = `qrcodes/${fileName}`;
          const fileUrl = await uploadBufferToS3(qrBuffer, s3Key, 'image/png');
          console.log(`Fallback QR code uploaded to S3 at: ${fileUrl}`);
          return fileUrl;
        } catch (s3FallbackError) {
          console.error("Error in S3 fallback upload:", s3FallbackError);
        }
      }
      
      // Local fallback
      const filePath = path.join(QR_CODE_DIR, fileName);
      fs.writeFileSync(filePath, qrBuffer);
      console.log("Falling back to regular QR code without icon overlay");
      return `/qrcodes/${fileName}`;
    }
  } catch (error) {
    console.error("Error generating ad mode QR code:", error);
    console.error("Error stack:", error.stack);
    throw new Error(`Failed to generate ad mode QR code: ${error.message}`);
  }
};

/**
 * Generate a QR code with custom styling (e.g., logo, colors)
 * @param {string} shortId - The short ID of the URL
 * @param {string} fullUrl - The full URL to encode in the QR code
 * @param {Object} styleOptions - Custom style options
 * @returns {Promise<string>} - The URL to access the QR code
 */
const generateStyledQRCode = async (
  shortId,
  fullUrl,
  styleOptions = {}
) => {
  try {
    const colorOptions = {
      darkColor: styleOptions.darkColor || "#000000",
      lightColor: styleOptions.lightColor || "#ffffff",
    };
    return await generateQRCode(shortId, fullUrl, colorOptions);
  } catch (error) {
    console.error("Error generating styled QR code:", error);
    throw error;
  }
};

/**
 * Delete a QR code file
 * @param {string} qrCodeUrl - The URL or path of the QR code to delete
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
const deleteQRCode = async (qrCodeUrl) => {
  try {
    if (!qrCodeUrl) return false;

    // Extract the filename from the URL
    const fileName = qrCodeUrl.split("/").pop();
    
    if (useS3Storage && (qrCodeUrl.includes('amazonaws.com') || qrCodeUrl.includes('s3'))) {
      // For S3 storage
      const s3Key = `qrcodes/${fileName}`;
      const result = await deleteFileFromS3(s3Key);
      console.log(`QR code delete from S3 result: ${result}`);
      return result;
    } else {
      // For local storage
      const filePath = path.join(QR_CODE_DIR, fileName);
      console.log(`Attempting to delete local QR code at: ${filePath}`);

      // Check if file exists
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`QR code deleted successfully: ${filePath}`);
          return true;
        } catch (unlinkError) {
          console.error(`Error deleting file ${filePath}:`, unlinkError);
          return false;
        }
      }
      
      console.log(`QR code file not found at: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error("Error deleting QR code:", error);
    console.error("Error stack:", error.stack);
    return false;
  }
};

/**
 * Get file size of a QR code
 * @param {string} qrCodeUrl - The URL of the QR code
 * @returns {Promise<number>} - The file size in bytes
 */
const getQRCodeSize = async (qrCodeUrl) => {
  try {
    if (!qrCodeUrl) return 0;
    
    // For S3 URLs, we can't easily get the file size without downloading
    if (useS3Storage && (qrCodeUrl.includes('amazonaws.com') || qrCodeUrl.includes('s3'))) {
      return -1; // Indicate that size is unknown for S3
    }
    
    // For local files
    const fileName = qrCodeUrl.split("/").pop();
    const filePath = path.join(QR_CODE_DIR, fileName);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return stats.size;
    }
    return 0;
  } catch (error) {
    console.error("Error getting QR code size:", error);
    return 0;
  }
};

/**
 * Check if a QR code exists
 * @param {string} shortId - The short ID of the URL
 * @returns {Promise<boolean>} - Whether the QR code exists
 */
const qrCodeExists = async (shortId) => {
  try {
    // For S3, we would need to check if the object exists in the bucket
    if (useS3Storage) {
      // This would require implementing a method to check S3 object existence
      // For now, we return true assuming it exists if S3 is enabled
      return true;
    }
    
    // For local storage
    const filePath = path.join(QR_CODE_DIR, `${shortId}.png`);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error("Error checking if QR code exists:", error);
    return false;
  }
};

export {
  generateQRCode,
  generateAdModeQRCode,
  generateStyledQRCode,
  deleteQRCode,
  getQRCodeSize,
  qrCodeExists,
  getProxiedUrl
};
