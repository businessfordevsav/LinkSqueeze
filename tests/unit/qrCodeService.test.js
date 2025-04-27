// tests/unit/qrCodeService.test.js
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { generateQRCode, getProxiedUrl } from '../../src/services/qrCodeService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we're using S3 storage from env
const useS3Storage = process.env.USE_S3_STORAGE === 'true';

describe('QR Code Service Tests', () => {
  const testId = 'test-qr-' + Date.now();
  const testUrl = 'https://example.com';
  let qrCodePath;
  
  test('should generate a QR code successfully', async () => {
    // Generate a QR code
    qrCodePath = await generateQRCode(testId, testUrl);
    
    // Check if the path is returned
    expect(qrCodePath).toBeDefined();
    
    if (useS3Storage) {
      // For S3 storage, we should get a URL containing amazonaws.com
      expect(qrCodePath).toContain('amazonaws.com');
      expect(qrCodePath).toContain(testId);
    } else {
      // For local storage
      expect(qrCodePath).toContain('qrcodes');
      expect(qrCodePath).toContain(testId);
      
      // Check if the file actually exists
      const qrFullPath = path.join(process.cwd(), 'public', qrCodePath);
      const fileExists = fs.existsSync(qrFullPath);
      expect(fileExists).toBe(true);
    }
  });
  
  test('should correctly process QR code URLs', () => {
    // Test S3 URL processing
    const s3Url = 'https://linksqueeze.s3.amazonaws.com/qrcodes/test-qr-123.png';
    const proxiedS3Url = getProxiedUrl(s3Url);
    expect(proxiedS3Url).toContain('/s3-image/qrcodes/');
    
    // Test local URL processing
    const localUrl = '/qrcodes/test-qr-123.png';
    const proxiedLocalUrl = getProxiedUrl(localUrl);
    expect(proxiedLocalUrl).toBe(localUrl); // Should remain unchanged
    
    // Test filename-only processing
    const filenameOnly = 'test-qr-123.png';
    const proxiedFilename = getProxiedUrl(filenameOnly);
    expect(proxiedFilename).toContain('/s3-image/qrcodes/');
  });
  
  // Clean up the test QR code after testing
  afterAll(() => {
    if (!useS3Storage && qrCodePath) {
      const qrFullPath = path.join(process.cwd(), 'public', qrCodePath);
      if (fs.existsSync(qrFullPath)) {
        fs.unlinkSync(qrFullPath);
      }
    }
  });
});