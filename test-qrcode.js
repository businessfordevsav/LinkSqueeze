// Test script for QR code generation
import { generateQRCode } from "./src/services/qrCodeService.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test function
async function testQRGeneration() {
  try {
    console.log("Starting QR code generation test...");

    // Check if QR code directory exists
    const qrCodeDir = path.join(__dirname, "public/qrcodes");
    console.log(`QR code directory path: ${qrCodeDir}`);
    console.log(`Directory exists: ${fs.existsSync(qrCodeDir)}`);

    // Generate a test QR code
    const testId = "test-" + Date.now();
    const testUrl = "https://example.com";
    console.log(`Generating QR code for ID: ${testId} and URL: ${testUrl}`);

    const qrCodePath = await generateQRCode(testId, testUrl);
    console.log(`QR code generated successfully: ${qrCodePath}`);

    // Verify file was created
    const fullPath = path.join(__dirname, "public", qrCodePath);
    console.log(`Full file path: ${fullPath}`);
    console.log(`File exists: ${fs.existsSync(fullPath)}`);

    // List directory contents after generation
    console.log("Directory contents after generation:");
    const files = fs.readdirSync(qrCodeDir);
    console.log(files);
  } catch (error) {
    console.error("Error in QR code test:", error);
  }
}

// Run the test
testQRGeneration();
