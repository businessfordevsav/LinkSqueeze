// tests/unit/url.test.js
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestDB, teardownTestDB, clearDatabase } from '../setup.js';
import URL from '../../src/models/url.js';
import mongoose from 'mongoose';

describe('URL Model Tests', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  test('should create a new URL document', async () => {
    const urlData = {
      redirectUrl: 'https://example.com', // Changed from originalUrl to redirectUrl
      shortId: 'test123',
      name: 'example-test', // Changed from customName to name
      createdAt: new Date()
    };

    const newUrl = new URL(urlData);
    const savedUrl = await newUrl.save();

    expect(savedUrl._id).toBeDefined();
    expect(savedUrl.redirectUrl).toBe(urlData.redirectUrl);
    expect(savedUrl.shortId).toBe(urlData.shortId);
    expect(savedUrl.name).toBe(urlData.name);
  });

  test('should not create URL without redirectUrl', async () => {
    const urlData = {
      shortId: 'test123',
      name: 'example-test',
      createdAt: new Date()
    };

    const newUrl = new URL(urlData);
    
    let error = null;
    try {
      await newUrl.save();
    } catch (err) {
      error = err;
    }
    
    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');
  });

  test('should validate URL format', async () => {
    const urlData = {
      redirectUrl: 'not-a-valid-url', // Changed from originalUrl to redirectUrl
      shortId: 'test123',
      createdAt: new Date()
    };

    const newUrl = new URL(urlData);
    
    let error = null;
    try {
      await newUrl.validate();
    } catch (err) {
      error = err;
    }
    
    expect(error).toBeDefined();
    expect(error.errors.redirectUrl).toBeDefined();
  });
});