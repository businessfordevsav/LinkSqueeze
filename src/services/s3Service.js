import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';

// Load environment variables to ensure they're available
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate that required environment variables are set
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`Warning: Missing S3 environment variables: ${missingVars.join(', ')}`);
  console.warn('S3 storage operations may fail. Check your .env file configuration.');
}

// Configure AWS SDK with environment variables
// Note: Make sure to set these environment variables
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Bucket name should be set in environment variables
const bucketName = process.env.AWS_S3_BUCKET_NAME;

console.log(`S3 Service initialized with bucket: ${bucketName || 'NOT SET'}`);

/**
 * Uploads a file to S3 bucket
 * @param {string} filePath - Path to local file
 * @param {string} key - S3 key (path within bucket)
 * @returns {Promise<string>} - URL of the uploaded file
 */
export const uploadFileToS3 = async (filePath, key) => {
  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath);
    
    // Set up upload parameters
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: getContentType(filePath),
      // Removed ACL: 'public-read' as it's not supported
      CacheControl: 'max-age=31536000', // Cache for 1 year
      ContentDisposition: 'inline',  // Display in browser
    };
    
    // Upload to S3
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully to ${data.Location}`);
    
    // Return the file URL
    return data.Location;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

/**
 * Uploads a buffer to S3 bucket
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 key (path within bucket)
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} - URL of the uploaded file
 */
export const uploadBufferToS3 = async (buffer, key, contentType) => {
  try {
    // Set up upload parameters
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Removed ACL: 'public-read' as it's not supported
      CacheControl: 'max-age=31536000', // Cache for 1 year
      ContentDisposition: 'inline',  // Display in browser
    };
    
    // Upload to S3
    const data = await s3.upload(params).promise();
    console.log(`Buffer uploaded successfully to ${data.Location}`);
    
    // Return the file URL
    return data.Location;
  } catch (error) {
    console.error('Error uploading buffer to S3:', error);
    throw error;
  }
};

/**
 * Delete a file from S3 bucket
 * @param {string} key - S3 key (path within bucket)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export const deleteFileFromS3 = async (key) => {
  try {
    // If the key is a full URL, extract just the path part
    if (key.startsWith('http')) {
      const url = new URL(key);
      // Extract the path without the leading slash
      key = url.pathname.substring(1);
    }
    
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    console.log(`File deleted successfully from S3: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    return false;
  }
};

/**
 * Generate a signed URL for an S3 object
 * @param {string} key - S3 key (path within bucket)
 * @param {number} expiresIn - Expiration time in seconds (default: 60 minutes)
 * @returns {Promise<string>} - Signed URL
 */
export const getSignedUrlPromise = async (key, expiresIn = 3600) => {
  try {
    console.log('Generating signed URL for key:', key);
    
    // Check if required environment variables are set
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !bucketName) {
      console.error('Missing required S3 configuration:', {
        accessKeyDefined: !!process.env.AWS_ACCESS_KEY_ID,
        secretKeyDefined: !!process.env.AWS_SECRET_ACCESS_KEY,
        bucketName: bucketName || 'NOT SET'
      });
      throw new Error('S3 configuration incomplete');
    }
    
    // If the key is a full URL, extract just the path part
    let processedKey = key;
    if (key.startsWith('http')) {
      try {
        const url = new URL(key);
        // Extract the path without the leading slash
        processedKey = url.pathname.substring(1);
        console.log('Converted URL to key:', { originalKey: key, processedKey });
      } catch (urlError) {
        console.error('Error processing URL to key:', { key, error: urlError.message });
        // Continue with original key if URL parsing fails
      }
    }
    
    const params = {
      Bucket: bucketName,
      Key: processedKey,
      Expires: expiresIn
    };
    
    console.log('S3 getSignedUrl params:', params);
    
    const signedUrl = await s3.getSignedUrlPromise('getObject', params);
    console.log('Successfully generated signed URL for key:', processedKey);
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', {
      key,
      message: error.message,
      code: error.code,
      stack: error.stack,
      s3Config: {
        region: process.env.AWS_REGION || 'us-east-1',
        bucketName,
        accessKeyDefined: !!process.env.AWS_ACCESS_KEY_ID,
        secretKeyDefined: !!process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    throw error;
  }
};

/**
 * Get content type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} - Content type
 */
const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  
  const contentTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
};

/**
 * Migrate existing local files to S3
 * @param {string} localDirectory - Path to local directory
 * @param {string} s3Directory - Directory prefix in S3
 * @returns {Promise<Array>} - Array of migrated file URLs
 */
export const migrateLocalFilesToS3 = async (localDirectory, s3Directory) => {
  try {
    const files = await fsPromises.readdir(localDirectory);
    const results = [];
    
    for (const file of files) {
      // Skip directories and non-image files
      const filePath = path.join(localDirectory, file);
      const stats = await fsPromises.stat(filePath);
      
      if (stats.isDirectory()) continue;
      
      // Only process image files
      if (!file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue;
      
      // Upload to S3
      const s3Key = `${s3Directory}/${file}`;
      const fileUrl = await uploadFileToS3(filePath, s3Key);
      results.push({ fileName: file, s3Url: fileUrl });
    }
    
    return results;
  } catch (error) {
    console.error('Error migrating files to S3:', error);
    throw error;
  }
};