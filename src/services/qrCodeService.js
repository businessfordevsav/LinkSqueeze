import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import sharp from "sharp"; // Replace Jimp with Sharp for better performance
// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QR_CODE_DIR = path.join(__dirname, "../../public/qrcodes");
// App icon paths for ad mode
const APP_ICON_PATH = path.join(
  __dirname,
  "../../public/android-chrome-192x192.png"
);
const APP_ICON_LARGE_PATH = path.join(
  __dirname,
  "../../public/android-chrome-512x512.png"
);
// Ensure the QR code directory exists with more robust error handling
try {
  if (!fs.existsSync(QR_CODE_DIR)) {
    console.log(`Creating QR code directory: ${QR_CODE_DIR}`);
    fs.mkdirSync(QR_CODE_DIR, { recursive: true });
    console.log(`QR code directory created successfully at: ${QR_CODE_DIR}`);
  } else {
    console.log(`QR code directory already exists at: ${QR_CODE_DIR}`);
  }
  // Test write access to the directory
  const testFile = path.join(QR_CODE_DIR, ".test");
  fs.writeFileSync(testFile, "test");
  fs.unlinkSync(testFile);
  console.log("Successfully verified write access to QR code directory");
} catch (error) {
  console.error(`ERROR setting up QR code directory: ${error.message}`);
  console.error(`Full error: ${error.stack}`);
  console.error(`Attempted to create/access directory at: ${QR_CODE_DIR}`);
  // We don't throw here to avoid crashing the app on startup,
  // but QR generation will fail later if this isn't fixed
}
/**
 * Generate a QR code for a URL and save it to the public directory
 * @param {string} shortId - The short ID of the URL
 * @param {string} fullUrl - The full URL to encode in the QR code
 * @param {Object} options - Optional configuration for the QR code
 * @returns {Promise<string>} - The URL to access the QR code
 */
export const generateQRCode = async (shortId, fullUrl, options = {}) => {
  try {
    console.log(`Generating QR code for ID: ${shortId}, URL: ${fullUrl}`);

    // Verify the directory exists before attempting to write
    if (!fs.existsSync(QR_CODE_DIR)) {
      console.error(`QR code directory does not exist at: ${QR_CODE_DIR}`);
      try {
        fs.mkdirSync(QR_CODE_DIR, { recursive: true });
        console.log(`Created QR code directory: ${QR_CODE_DIR}`);
      } catch (mkdirError) {
        throw new Error(
          `Failed to create QR code directory: ${mkdirError.message}`
        );
      }
    }

    const fileName = `${shortId}.png`;
    const filePath = path.join(QR_CODE_DIR, fileName);
    console.log(`QR code will be saved to: ${filePath}`);

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

    // Generate QR code
    await QRCode.toFile(filePath, fullUrl, qrOptions);

    // Verify the file was created
    if (!fs.existsSync(filePath)) {
      throw new Error(`QR code file was not created at: ${filePath}`);
    }

    console.log(`QR code generated successfully at: ${filePath}`);
    // Return relative path to QR code
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
export const generateAdModeQRCode = async (shortId, fullUrl, options = {}) => {
  try {
    console.log(
      `Generating ad mode QR code with app icon for ID: ${shortId}, URL: ${fullUrl}`
    );
    // Verify the directory exists before attempting to write
    if (!fs.existsSync(QR_CODE_DIR)) {
      console.error(`QR code directory does not exist at: ${QR_CODE_DIR}`);
      throw new Error("QR code directory does not exist");
    }
    // First generate the QR code
    const fileName = `${shortId}.png`;
    const filePath = path.join(QR_CODE_DIR, fileName);
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

    // Generate QR code as buffer instead of directly to file
    const qrBuffer = await QRCode.toBuffer(fullUrl, qrOptions);

    try {
      // Load QR code from buffer instead of file
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

      // Composite the icon onto the QR code and save directly to file
      await qrImage
        .composite([
          {
            input: resizedIcon,
            left: iconPosition.left,
            top: iconPosition.top,
          },
        ])
        .toFile(filePath);

      console.log(
        `Ad mode QR code with app icon generated successfully at: ${filePath}`
      );
      // Return relative path to QR code
      return `/qrcodes/${fileName}`;
    } catch (sharpError) {
      console.error("Error in Sharp processing:", sharpError);
      console.error("Sharp error details:", sharpError.stack);

      // If Sharp processing fails, write the original QR buffer to file as fallback
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
export const generateStyledQRCode = async (
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
 * @param {string} qrCodeUrl - The URL of the QR code to delete
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
export const deleteQRCode = async (qrCodeUrl) => {
  try {
    if (!qrCodeUrl) return false;

    // Extract the filename from the URL
    const fileName = qrCodeUrl.split("/").pop();
    const filePath = path.join(QR_CODE_DIR, fileName);
    console.log(`Attempting to delete QR code at: ${filePath}`);

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
export const getQRCodeSize = async (qrCodeUrl) => {
  try {
    if (!qrCodeUrl) return 0;
    // Extract the filename from the URL
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
export const qrCodeExists = async (shortId) => {
  try {
    const filePath = path.join(QR_CODE_DIR, `${shortId}.png`);
    return fs.existsSync(filePath);
  } catch (error) {
    console.error("Error checking if QR code exists:", error);
    return false;
  }
};
